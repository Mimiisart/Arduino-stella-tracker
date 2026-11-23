/** Pure location helpers (no React Native imports) so they can be unit-tested in Node. */

export type LatLon = { latitude: number; longitude: number };

export type PlaceKind = 'safe' | 'watch';

export type Place = LatLon & {
  id: string;
  name: string;
  radius: number; // metres
  kind: PlaceKind;
  createdAt: number;
};

export type LastSeen = LatLon & {
  at: number; // when the phone was last connected to the tag
  label: string; // saved place name, street, or "Unknown place"
  placeId: string | null;
  accuracy: number | null; // metres
};

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceMetres(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The closest saved place whose circle contains the point, if any. */
export function placeAt(point: LatLon, places: Place[]): Place | null {
  let best: Place | null = null;
  let bestDist = Infinity;
  for (const p of places) {
    const d = distanceMetres(point, p);
    if (d <= p.radius && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Whether a left-behind alert should fire for this disconnect point.
 * Safe places suppress alerts; everywhere else (watched or unknown) alerts.
 */
export function shouldAlertAt(point: LatLon | null, places: Place[]): boolean {
  if (!point) return true;
  return placeAt(point, places)?.kind !== 'safe';
}

/** Keep the most recent entries first, dropping near-duplicates of the newest. */
export function pushHistory(history: LastSeen[], entry: LastSeen, max = 10): LastSeen[] {
  const [newest, ...rest] = history;
  const sameSpot = newest && distanceMetres(newest, entry) < 25 && newest.label === entry.label;
  const next = sameSpot ? [entry, ...rest] : [entry, ...history];
  return next.slice(0, max);
}
