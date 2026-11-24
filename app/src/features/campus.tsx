/**
 * The shared campus map (a small GIS of the university), from Supabase:
 *   campus_buildings  footprints from OpenStreetMap, floor counts
 *   campus_rooms      rooms on each floor
 *   campus_places     other points of interest (gates, car parks ...)
 * All public campus data. Downloaded when the app opens and saved on the phone,
 * so the map, search and room detection keep working offline.
 */
import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/backend/supabase';
import type { IconName } from '@/components/minitag/ui';

import type { LatLon } from './geo';
import { floorName, polygonCentre, type Building, type PolygonCoords, type Room } from './indoor';

export type CampusPlace = LatLon & {
  id: number;
  name: string;
  category: string;
  description: string | null;
  radius: number;
  verified: boolean;
};

type Cache = { places: CampusPlace[]; buildings: Building[]; rooms: Room[]; fetchedAt: number | null };

const CACHE_KEY = 'minitag.campus.v2';
const REFRESH_EVERY_MS = 6 * 60 * 60_000; // re-check for updates at most every 6 hours
const EMPTY: Cache = { places: [], buildings: [], rooms: [], fetchedAt: null };

type CampusValue = Cache & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const CampusContext = createContext<CampusValue | null>(null);

function loadCache(): Cache {
  try {
    const raw = Storage.getItemSync(CACHE_KEY);
    const v = raw ? (JSON.parse(raw) as Cache) : null;
    return v && Array.isArray(v.buildings) ? v : EMPTY;
  } catch {
    return EMPTY;
  }
}

const coords = (geo: unknown): PolygonCoords | null => {
  const g = geo as { type?: string; coordinates?: PolygonCoords } | null;
  return g && g.type === 'Polygon' && Array.isArray(g.coordinates) ? g.coordinates : null;
};

export function CampusProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Cache>(loadCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [placesRes, buildingsRes, roomsRes] = await Promise.all([
      supabase.from('campus_places').select('id, name, category, description, latitude, longitude, radius_m, verified').order('name'),
      supabase.from('campus_buildings').select('id, name, category, levels, floor_height_m, footprint'),
      supabase.from('campus_rooms').select('id, building_id, name, floor, kind, latitude, longitude, footprint').order('floor'),
    ]);
    setLoading(false);
    if (placesRes.error && buildingsRes.error) {
      setError('Couldn’t update the campus map. Showing the saved copy.');
      return;
    }
    const next: Cache = {
      fetchedAt: Date.now(),
      places: (placesRes.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        description: r.description,
        latitude: r.latitude,
        longitude: r.longitude,
        radius: r.radius_m,
        verified: r.verified,
      })),
      buildings: (buildingsRes.data ?? []).flatMap((r) => {
        const footprint = coords(r.footprint);
        return footprint
          ? [{ id: r.id, name: r.name, category: r.category, levels: r.levels, floorHeight: r.floor_height_m, footprint }]
          : [];
      }),
      rooms: (roomsRes.data ?? []).flatMap((r) => {
        const footprint = coords(r.footprint);
        const centre = r.latitude != null && r.longitude != null ? { latitude: r.latitude, longitude: r.longitude } : footprint ? polygonCentre(footprint) : null;
        return centre ? [{ id: r.id, buildingId: r.building_id, name: r.name, floor: r.floor, kind: r.kind, footprint, ...centre }] : [];
      }),
    };
    setError(null);
    setCache(next);
    try {
      Storage.setItemSync(CACHE_KEY, JSON.stringify(next));
    } catch {
      // Still shown this session.
    }
  }, []);

  // Fetch on launch, and when the app comes back after a while.
  useEffect(() => {
    let last = 0;
    const maybe = () => {
      if (Date.now() - last < REFRESH_EVERY_MS) return;
      last = Date.now();
      refresh();
    };
    maybe();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && maybe());
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo<CampusValue>(() => ({ ...cache, loading, error, refresh }), [cache, loading, error, refresh]);
  return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
}

export function useCampus(): CampusValue {
  const ctx = useContext(CampusContext);
  if (!ctx) throw new Error('useCampus must be used inside <CampusProvider>');
  return ctx;
}

// ---- search ----------------------------------------------------------------------------

export type SearchHit = {
  key: string;
  kind: 'building' | 'room' | 'place';
  id: number;
  name: string;
  subtitle: string;
  icon: Extract<IconName, string>;
  point: LatLon;
  buildingId: number | null;
};

/** Case-insensitive search over buildings, rooms and other campus places. */
export function searchCampus(c: Pick<Cache, 'places' | 'buildings' | 'rooms'>, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const byId = new Map(c.buildings.map((b) => [b.id, b]));
  const hits: SearchHit[] = [
    ...c.buildings
      .filter((b) => b.name)
      .map((b) => ({
        key: `b${b.id}`,
        kind: 'building' as const,
        id: b.id,
        name: b.name!,
        subtitle: b.category,
        icon: campusIcon(b.category),
        point: polygonCentre(b.footprint),
        buildingId: b.id,
      })),
    ...c.rooms.map((r) => ({
      key: `r${r.id}`,
      kind: 'room' as const,
      id: r.id,
      name: r.name,
      subtitle: `${floorName(r.floor)} · ${byId.get(r.buildingId)?.name ?? 'Campus building'}`,
      icon: campusIcon(r.kind),
      point: { latitude: r.latitude, longitude: r.longitude },
      buildingId: r.buildingId,
    })),
    ...c.places.map((p) => ({
      key: `p${p.id}`,
      kind: 'place' as const,
      id: p.id,
      name: p.name,
      subtitle: p.category,
      icon: campusIcon(p.category),
      point: { latitude: p.latitude, longitude: p.longitude },
      buildingId: null,
    })),
  ];
  return hits
    .filter((h) => `${h.name} ${h.subtitle}`.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
    .slice(0, 8);
}

/** SF Symbol for a campus category or room kind. */
export function campusIcon(category: string): Extract<IconName, string> {
  const c = category.toLowerCase();
  if (c.includes('classroom') || c.includes('lecture') || c.includes('academic') || c.includes('faculty')) return 'graduationcap';
  if (c.includes('lab')) return 'flask';
  if (c.includes('office')) return 'briefcase';
  if (c.includes('library') || c.includes('study') || c.includes('service')) return 'books.vertical';
  if (c.includes('food') || c.includes('shop') || c.includes('cafeteria') || c.includes('facilit')) return 'fork.knife';
  if (c.includes('culture') || c.includes('museum')) return 'building.columns';
  if (c.includes('access') || c.includes('gate') || c.includes('parking') || c.includes('bus')) return 'car';
  if (c.includes('residen') || c.includes('hostel') || c.includes('dorm')) return 'bed.double';
  if (c.includes('health') || c.includes('clinic')) return 'cross.case';
  if (c.includes('sport')) return 'figure.run';
  return 'building.2';
}
