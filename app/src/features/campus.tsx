/**
 * The shared campus map (a small GIS of each university), from Supabase:
 *   campuses          the universities people can choose (Lagos to start)
 *   campus_buildings  footprints from OpenStreetMap, floor counts
 *   campus_rooms      rooms on each floor
 *   campus_places     other points of interest (gates, car parks ...)
 * All public data. The chosen campus is downloaded and saved on the phone, so
 * the map, search and room detection keep working offline.
 *
 * Which campus: signed-in people's choice lives in their profile (so it follows
 * them to a new phone); otherwise it is kept on this phone.
 */
import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/backend/auth-context';
import { supabase } from '@/backend/supabase';
import type { IconName } from '@/components/minitag/ui';

import type { LatLon } from './geo';
import { floorName, polygonCentre, type Building, type PolygonCoords, type Room } from './indoor';

export type Campus = {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  area: string | null;
  centre: LatLon;
};

export type CampusPlace = LatLon & {
  id: number;
  name: string;
  category: string;
  description: string | null;
  radius: number;
  verified: boolean;
};

type Cache = { places: CampusPlace[]; buildings: Building[]; rooms: Room[]; fetchedAt: number | null };

const CAMPUSES_KEY = 'minitag.campuses';
const CHOICE_KEY = 'minitag.campus.slug';
const cacheKey = (slug: string) => `minitag.campus.v3.${slug}`;
const LEGACY_PAU_CACHE = 'minitag.campus.v2'; // from before there were several campuses
const REFRESH_EVERY_MS = 6 * 60 * 60_000; // re-check for updates at most every 6 hours
const PAGE = 1000; // Supabase returns at most 1000 rows per request
const EMPTY: Cache = { places: [], buildings: [], rooms: [], fetchedAt: null };

type CampusValue = Cache & {
  campuses: Campus[];
  /** The campus the person chose, or null if they haven't yet. */
  campus: Campus | null;
  selectCampus: (slug: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const CampusContext = createContext<CampusValue | null>(null);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = Storage.getItemSync(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function initialChoice(): string | null {
  const saved = Storage.getItemSync(CHOICE_KEY);
  if (saved) return saved;
  // People who used MiniTag before campuses existed were all at PAU.
  return Storage.getItemSync(LEGACY_PAU_CACHE) ? 'pau' : null;
}

const coords = (geo: unknown): PolygonCoords | null => {
  const g = geo as { type?: string; coordinates?: PolygonCoords } | null;
  return g && g.type === 'Polygon' && Array.isArray(g.coordinates) ? g.coordinates : null;
};

/** Fetch every row of a query, 1000 at a time. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function fetchCampusData(campusId: number): Promise<Cache> {
  const [places, buildings, rooms] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from('campus_places')
        .select('id, name, category, description, latitude, longitude, radius_m, verified')
        .eq('campus_id', campusId)
        .order('id')
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from('campus_buildings')
        .select('id, name, category, levels, floor_height_m, footprint')
        .eq('campus_id', campusId)
        .order('id')
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from('campus_rooms')
        .select('id, building_id, name, floor, kind, latitude, longitude, footprint, campus_buildings!inner(campus_id)')
        .eq('campus_buildings.campus_id', campusId)
        .order('id')
        .range(a, b),
    ),
  ]);
  return {
    fetchedAt: Date.now(),
    places: places.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      latitude: r.latitude,
      longitude: r.longitude,
      radius: r.radius_m,
      verified: r.verified,
    })),
    buildings: buildings.flatMap((r) => {
      const footprint = coords(r.footprint);
      return footprint
        ? [{ id: r.id, name: r.name, category: r.category, levels: r.levels, floorHeight: r.floor_height_m, footprint }]
        : [];
    }),
    rooms: rooms.flatMap((r) => {
      const footprint = coords(r.footprint);
      const centre =
        r.latitude != null && r.longitude != null
          ? { latitude: r.latitude, longitude: r.longitude }
          : footprint
            ? polygonCentre(footprint)
            : null;
      return centre ? [{ id: r.id, buildingId: r.building_id, name: r.name, floor: r.floor, kind: r.kind, footprint, ...centre }] : [];
    }),
  };
}

export function CampusProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>(() => readJson<Campus[]>(CAMPUSES_KEY, []));
  const [localChoice, setLocalChoice] = useState<string | null>(initialChoice);
  // Downloaded data, tagged with its campus so switching never shows the old one.
  const [loaded, setLoaded] = useState<{ slug: string; data: Cache } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A signed-in person's profile choice wins over this phone's.
  const profileSlug = campuses.find((c) => c.id === auth.profile?.campusId)?.slug ?? null;
  const slug = profileSlug ?? localChoice;
  const campus = campuses.find((c) => c.slug === slug) ?? null;
  const saved = useMemo(() => (slug ? readJson<Cache>(cacheKey(slug), EMPTY) : EMPTY), [slug]);
  const data = loaded && loaded.slug === slug ? loaded.data : saved;

  const loadCampuses = useCallback(async () => {
    const { data: rows, error: err } = await supabase
      .from('campuses')
      .select('id, slug, name, short_name, area, centre_lat, centre_lon')
      .order('name');
    if (err || !rows) return null;
    const list: Campus[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      shortName: r.short_name,
      area: r.area,
      centre: { latitude: r.centre_lat, longitude: r.centre_lon },
    }));
    setCampuses(list);
    Storage.setItemSync(CAMPUSES_KEY, JSON.stringify(list));
    return list;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = (await loadCampuses()) ?? campuses;
      const target = list.find((c) => c.slug === slug);
      if (!target) return;
      const next = await fetchCampusData(target.id);
      setLoaded({ slug: target.slug, data: next });
      setError(null);
      try {
        Storage.setItemSync(cacheKey(target.slug), JSON.stringify(next));
      } catch {
        // Still shown this session.
      }
    } catch {
      setError('Couldn’t update the campus map. Showing the saved copy.');
    } finally {
      setLoading(false);
    }
  }, [loadCampuses, campuses, slug]);

  const { session, setProfileCampus } = auth;
  const selectCampus = useCallback(
    async (next: string) => {
      Storage.setItemSync(CHOICE_KEY, next);
      setLocalChoice(next);
      const c = campuses.find((x) => x.slug === next);
      if (session && c) await setProfileCampus(c.id).catch(() => {});
    },
    [campuses, session, setProfileCampus],
  );

  // Accounts made before campuses existed have none: give them this phone's choice.
  const profileCampus = auth.profile ? auth.profile.campusId : undefined;
  useEffect(() => {
    if (profileCampus !== null || !localChoice) return;
    const c = campuses.find((x) => x.slug === localChoice);
    if (c) setProfileCampus(c.id).catch(() => {});
  }, [profileCampus, localChoice, campuses, setProfileCampus]);

  // Fetch on launch, when the campus changes, and when the app comes back after a while.
  useEffect(() => {
    let last = 0;
    const maybe = () => {
      if (Date.now() - last < REFRESH_EVERY_MS) return;
      last = Date.now();
      refresh();
    };
    maybe();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && maybe());
    return () => sub.remove();
    // Re-run only when the chosen campus changes, not on every refresh identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const value = useMemo<CampusValue>(
    () => ({ ...data, campuses, campus, selectCampus, loading, error, refresh }),
    [data, campuses, campus, selectCampus, loading, error, refresh],
  );
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
