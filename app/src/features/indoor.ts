/**
 * Indoor location from campus geodata + the phone's barometer.
 * Pure functions (no React Native imports) so they can be unit-tested in Node.
 *
 *   Building: GPS point inside a building footprint (point-in-polygon), or the
 *             nearest footprint within the GPS uncertainty ("near ...").
 *   Floor:    height above a ground-level pressure reference, from the
 *             barometric formula, divided by the building's floor height.
 *   Room:     rooms on that floor whose polygon contains the point, or whose
 *             centre lies within the GPS uncertainty. More than one candidate is
 *             reported honestly ("Classroom 1 or Classroom 2").
 */
// Self-contained (no imports) so Node's test runner can load it directly.
export type LatLon = { latitude: number; longitude: number };

/** Great-circle distance in metres (haversine). */
function distanceMetres(a: LatLon, b: LatLon): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** GeoJSON Polygon coordinates: rings of [longitude, latitude]; ring 0 is the outline. */
export type PolygonCoords = number[][][];

export type Building = {
  id: number;
  name: string | null;
  category: string;
  levels: number | null; // floors above ground, if known
  floorHeight: number; // metres per floor
  footprint: PolygonCoords;
};

export type Room = LatLon & {
  id: number;
  buildingId: number;
  name: string;
  floor: number; // 0 = ground floor
  kind: string;
  footprint: PolygonCoords | null;
};

export type Confidence = 'high' | 'medium' | 'low';

export type FloorEstimate = { floor: number; heightM: number; confidence: Confidence };

export type IndoorFix = {
  building: Building | null;
  inside: boolean; // true = inside the footprint, false = only near it
  floor: FloorEstimate | null;
  room: Room | null;
  candidates: Room[]; // rooms that fit the evidence, best first
  label: string;
};

// ---- geometry ---------------------------------------------------------------------

/** Ray-casting point-in-polygon test on the outer ring (holes subtract). */
export function pointInPolygon(p: LatLon, poly: PolygonCoords): boolean {
  const inRing = (ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const crosses = yi > p.latitude !== yj > p.latitude;
      if (crosses && p.longitude < ((xj - xi) * (p.latitude - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  if (!poly.length || !inRing(poly[0])) return false;
  return !poly.slice(1).some(inRing);
}

/** Shortest distance in metres from a point to a polygon's outline (0 if inside). */
export function distanceToPolygon(p: LatLon, poly: PolygonCoords): number {
  if (pointInPolygon(p, poly)) return 0;
  const ring = poly[0] ?? [];
  // Local flat projection around the point (accurate over a campus).
  const k = 111_320;
  const cos = Math.cos((p.latitude * Math.PI) / 180);
  const xy = ([lon, lat]: number[]) => [(lon - p.longitude) * k * cos, (lat - p.latitude) * k];
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = xy(ring[i]);
    const [bx, by] = xy(ring[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Area-weighted centre of a polygon's outline, for labels and markers. */
export function polygonCentre(poly: PolygonCoords): LatLon {
  const ring = poly[0] ?? [];
  let lat = 0;
  let lon = 0;
  const n = Math.max(1, ring.length - 1);
  for (let i = 0; i < n; i++) {
    lon += ring[i][0];
    lat += ring[i][1];
  }
  return { latitude: lat / n, longitude: lon / n };
}

/** Approximate polygon area in square metres. */
export function polygonArea(poly: PolygonCoords): number {
  const ring = poly[0] ?? [];
  if (ring.length < 4) return 0;
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const k = 111_320;
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = [ring[i][0] * k * Math.cos(lat0), ring[i][1] * k];
    const [x2, y2] = [ring[i + 1][0] * k * Math.cos(lat0), ring[i + 1][1] * k];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

// ---- barometer ------------------------------------------------------------------------

/** Height in metres of pressure p above reference pressure p0 (international barometric formula). */
export function heightFromPressure(p: number, p0: number): number {
  return 44330 * (1 - Math.pow(p / p0, 1 / 5.255));
}

/** A ground-level pressure reference ages quickly in the tropics (daily pressure tide), so confidence drops with age. */
export function referenceConfidence(ageMs: number): Confidence {
  if (ageMs <= 20 * 60_000) return 'high';
  if (ageMs <= 60 * 60_000) return 'medium';
  return 'low';
}

/** Floor number (0 = ground) from height above the ground reference. */
export function estimateFloor(heightM: number, floorHeightM: number, refAgeMs: number, levels: number | null): FloorEstimate {
  const raw = heightM / floorHeightM;
  let floor = Math.max(0, Math.round(raw));
  if (levels != null) floor = Math.min(floor, Math.max(0, levels - 1));
  let confidence = referenceConfidence(refAgeMs);
  // Halfway between two floors: be less sure.
  if (Math.abs(raw - Math.round(raw)) > 0.3 && confidence !== 'low') confidence = confidence === 'high' ? 'medium' : 'low';
  return { floor, heightM, confidence };
}

export function floorName(floor: number): string {
  if (floor < 0) return floor === -1 ? 'Basement' : `Basement ${-floor}`;
  return ['Ground floor', 'First floor', 'Second floor', 'Third floor', 'Fourth floor', 'Fifth floor'][floor] ?? `Floor ${floor}`;
}

// ---- locate --------------------------------------------------------------------------------

const ROOM_RADIUS_M = 6; // typical half-size of a classroom, for rooms recorded as a single point

export function locate(input: {
  point: LatLon;
  accuracyM: number | null;
  buildings: Building[];
  rooms: Room[];
  /** Height above the ground reference (barometer) and the reference's age, if available. */
  baro?: { heightM: number; refAgeMs: number } | null;
}): IndoorFix {
  const { point, buildings, rooms } = input;
  const accuracy = Math.max(5, input.accuracyM ?? 25);

  // 1. Building: smallest footprint containing the point, else the nearest within the uncertainty.
  let building: Building | null = null;
  let inside = false;
  const containing = buildings.filter((b) => pointInPolygon(point, b.footprint));
  if (containing.length) {
    building = containing.sort((a, b) => polygonArea(a.footprint) - polygonArea(b.footprint))[0];
    inside = true;
  } else {
    let best = Infinity;
    for (const b of buildings) {
      const d = distanceToPolygon(point, b.footprint);
      if (d <= Math.max(accuracy, 10) && d < best) {
        best = d;
        building = b;
      }
    }
  }

  // 2. Floor: only meaningful inside a building.
  const floor =
    building && input.baro ? estimateFloor(input.baro.heightM, building.floorHeight, input.baro.refAgeMs, building.levels) : null;

  // 3. Room: on that floor (or any floor if the floor is unknown).
  let candidates: Room[] = [];
  if (building) {
    const here = rooms.filter((r) => r.buildingId === building!.id && (!floor || r.floor === floor.floor));
    const byPolygon = here.filter((r) => r.footprint && pointInPolygon(point, r.footprint));
    if (byPolygon.length) {
      candidates = byPolygon;
    } else {
      candidates = here
        .map((r) => ({ r, d: distanceMetres(point, r) }))
        .filter(({ d }) => d <= accuracy + ROOM_RADIUS_M)
        .sort((a, b) => a.d - b.d)
        .map(({ r }) => r);
    }
  }
  const room = candidates.length === 1 ? candidates[0] : null;

  return { building, inside, floor, room, candidates: candidates.slice(0, 3), label: labelFor(building, inside, floor, room, candidates) };
}

function labelFor(b: Building | null, inside: boolean, f: FloorEstimate | null, room: Room | null, candidates: Room[]): string {
  if (!b) return 'Outside the mapped buildings';
  const bName = b.name ?? 'a campus building';
  if (!inside) return `Near ${bName}`;
  const floorPart = f ? (f.confidence === 'low' ? `${floorName(f.floor)}?` : floorName(f.floor)) : null;
  const roomPart = room ? room.name : candidates.length > 1 ? `${candidates[0].name} or ${candidates[1].name}` : null;
  return [roomPart, floorPart, bName].filter(Boolean).join(' · ');
}
