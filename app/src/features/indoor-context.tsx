/**
 * Live indoor position: where the phone is on campus right now (building,
 * floor, room), from GPS + campus footprints + the barometer.
 *
 * Floor needs a ground-level pressure reference. It is taken automatically
 * whenever the phone is clearly outdoors (good GPS, outside every footprint),
 * or by hand with "I'm on the ground floor". Pressure drifts through the day
 * (in Lagos the daily pressure tide is about 1-2 hPa, roughly 10-15 m), so the
 * reference's age sets the floor's confidence.
 *
 * Runs only while the app is open and only after the person has allowed
 * Location (and Motion for the barometer).
 */
import * as Location from 'expo-location';
import { Barometer } from 'expo-sensors';
import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useCampus } from './campus';
import { distanceToPolygon, heightFromPressure, locate, type IndoorFix } from './indoor';
import type { LatLon } from './geo';

type Reading = { pressure: number; relativeAltitude: number | null; at: number; session: number };
type GroundRef = Reading & { source: 'outdoor' | 'manual' };
type Fix = LatLon & { accuracy: number | null; at: number };
type Perm = 'granted' | 'denied' | 'undetermined';

const REF_KEY = 'minitag.groundRef';
const OUTDOOR_ACCURACY_M = 15; // GPS must be this good to trust "outdoors"
const OUTDOOR_CLEARANCE_M = 8; // and at least this far from every building
const REF_MAX_AGE_MS = 6 * 60 * 60_000;

type IndoorValue = {
  /** Where the phone is now (null without a GPS fix or campus data). */
  here: IndoorFix | null;
  accuracy: number | null;
  barometerAvailable: boolean;
  motionPermission: Perm;
  groundRef: { at: number; source: 'outdoor' | 'manual' } | null;
  requestMotion: () => Promise<boolean>;
  /** Use the current pressure as ground level ("I'm on the ground floor"). */
  calibrateGround: () => boolean;
  /** Building / floor / room for any point, using the latest barometer reading. */
  locateAt: (point: LatLon, accuracy: number | null) => IndoorFix | null;
};

const IndoorContext = createContext<IndoorValue | null>(null);

function loadRef(): GroundRef | null {
  try {
    const raw = Storage.getItemSync(REF_KEY);
    const r = raw ? (JSON.parse(raw) as GroundRef) : null;
    return r && Date.now() - r.at < REF_MAX_AGE_MS ? { ...r, session: -1 } : null; // old session: use pressure only
  } catch {
    return null;
  }
}

export function IndoorProvider({ children }: { children: ReactNode }) {
  const campus = useCampus();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [motionPermission, setMotionPermission] = useState<Perm>('undetermined');
  const [locationGranted, setLocationGranted] = useState(false);
  const [barometerAvailable, setBarometerAvailable] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [groundRef, setGroundRef] = useState<GroundRef | null>(loadRef);
  const session = useRef(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  // Permissions (checked, never prompted here; Welcome or the Map asks).
  useEffect(() => {
    if (!active) return;
    let alive = true;
    Promise.all([
      Barometer.isAvailableAsync().catch(() => false),
      Barometer.getPermissionsAsync().catch(() => null),
      Location.getForegroundPermissionsAsync().catch(() => null),
    ]).then(([avail, motion, loc]) => {
      if (!alive) return;
      setBarometerAvailable(!!avail);
      if (motion) setMotionPermission(motion.status as Perm);
      setLocationGranted(loc?.status === 'granted');
    });
    return () => {
      alive = false;
    };
  }, [active]);

  // Barometer while the app is open.
  useEffect(() => {
    if (!active || !barometerAvailable || motionPermission !== 'granted') return;
    session.current += 1;
    const mySession = session.current;
    Barometer.setUpdateInterval(1000);
    const sub = Barometer.addListener(({ pressure, relativeAltitude }) =>
      setReading({ pressure, relativeAltitude: relativeAltitude ?? null, at: Date.now(), session: mySession }),
    );
    return () => sub.remove();
  }, [active, barometerAvailable, motionPermission]);

  // GPS while the app is open.
  useEffect(() => {
    if (!active || !locationGranted) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 4000 }, (pos) =>
      setFix({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null, at: Date.now() }),
    )
      .then((s) => (cancelled ? s.remove() : (sub = s)))
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active, locationGranted]);

  const saveRef = useCallback((r: GroundRef) => {
    setGroundRef(r);
    try {
      Storage.setItemSync(REF_KEY, JSON.stringify(r));
    } catch {
      // Kept in memory.
    }
  }, []);

  // Automatic ground calibration: good GPS, clearly outside every building.
  useEffect(() => {
    const r = reading;
    if (!fix || !r || fix.at - r.at > 10_000) return;
    if (fix.accuracy == null || fix.accuracy > OUTDOOR_ACCURACY_M || !campus.buildings.length) return;
    const clearance = Math.min(...campus.buildings.map((b) => distanceToPolygon(fix, b.footprint)));
    // Syncing to external sensors (GPS + barometer), which is what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (clearance >= OUTDOOR_CLEARANCE_M) saveRef({ ...r, source: 'outdoor' });
    // Only when a new GPS fix arrives, not on every barometer tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix, campus.buildings, saveRef]);

  const calibrateGround = useCallback(() => {
    if (!reading) return false;
    saveRef({ ...reading, source: 'manual' });
    return true;
  }, [reading, saveRef]);

  const requestMotion = useCallback(async () => {
    const res = await Barometer.requestPermissionsAsync().catch(() => null);
    setMotionPermission((res?.status as Perm) ?? 'denied');
    return res?.status === 'granted';
  }, []);

  /** Height above the ground reference: iOS's fused relative altitude when both readings share a session, else raw pressure. */
  const heightFrom = useCallback(
    (r: Reading | null, at: number): { heightM: number; refAgeMs: number } | null => {
      if (!r || !groundRef) return null;
      const sameSession = r.session === groundRef.session && r.relativeAltitude != null && groundRef.relativeAltitude != null;
      const heightM = sameSession ? r.relativeAltitude! - groundRef.relativeAltitude! : heightFromPressure(r.pressure, groundRef.pressure);
      return { heightM, refAgeMs: at - groundRef.at };
    },
    [groundRef],
  );

  // For callbacks (e.g. labelling a disconnect): the freshest barometer reading.
  const locateAt = useCallback(
    (point: LatLon, accuracy: number | null) => {
      if (!campus.buildings.length) return null;
      return locate({ point, accuracyM: accuracy, buildings: campus.buildings, rooms: campus.rooms, baro: heightFrom(reading, Date.now()) });
    },
    [campus.buildings, campus.rooms, heightFrom, reading],
  );

  // For rendering: the published reading (updated every few seconds).
  const here = useMemo(() => {
    if (!fix || !campus.buildings.length) return null;
    return locate({ point: fix, accuracyM: fix.accuracy, buildings: campus.buildings, rooms: campus.rooms, baro: heightFrom(reading, reading?.at ?? fix.at) });
  }, [fix, campus.buildings, campus.rooms, heightFrom, reading]);

  const value = useMemo<IndoorValue>(
    () => ({
      here,
      accuracy: fix?.accuracy ?? null,
      barometerAvailable,
      motionPermission,
      groundRef: groundRef ? { at: groundRef.at, source: groundRef.source } : null,
      requestMotion,
      calibrateGround,
      locateAt,
    }),
    [here, fix?.accuracy, barometerAvailable, motionPermission, groundRef, requestMotion, calibrateGround, locateAt],
  );
  return <IndoorContext.Provider value={value}>{children}</IndoorContext.Provider>;
}

export function useIndoor(): IndoorValue {
  const ctx = useContext(IndoorContext);
  if (!ctx) throw new Error('useIndoor must be used inside <IndoorProvider>');
  return ctx;
}
