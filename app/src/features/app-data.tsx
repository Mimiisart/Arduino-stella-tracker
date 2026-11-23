/**
 * Everything MiniTag remembers besides the tracker itself: alert settings,
 * saved places, last-seen history, and the left-behind alert logic.
 *
 * Left-behind flow: when the tag drops its connection, record where the phone
 * is, and unless that spot is a safe place, schedule a local notification after
 * the chosen delay. If the tag reconnects first, cancel it. iOS can wake the app
 * for Bluetooth events in the background (bluetooth-central mode), which is when
 * the notification gets scheduled.
 */
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useMiniTag } from '@/ble/minitag-context';
import { placeAt, pushHistory, shouldAlertAt, type LastSeen, type LatLon, type Place, type PlaceKind } from './geo';

export type AlertDelay = 30 | 60 | 120;
export const ALERT_DELAYS: AlertDelay[] = [30, 60, 120];

export type Prefs = {
  alertsEnabled: boolean;
  alertDelay: AlertDelay; // seconds
  rememberLastSeen: boolean;
  snoozedUntil: number | null;
};

type PendingAlert = { id: string; since: number; fireAt: number; label: string };

const DEFAULT_PREFS: Prefs = { alertsEnabled: true, alertDelay: 60, rememberLastSeen: true, snoozedUntil: null };
const KEYS = {
  prefs: 'minitag.prefs',
  places: 'minitag.places',
  history: 'minitag.history',
  pending: 'minitag.pendingAlert',
};
const LOCATION_REFRESH_MS = 3 * 60_000;
const SNOOZE_MS = 60 * 60_000;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = Storage.getItemSync(key);
    return raw ? { ...(fallback as object), ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function loadList<T>(key: string): T[] {
  try {
    const raw = Storage.getItemSync(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function save(key: string, value: unknown) {
  try {
    if (value == null) Storage.removeItemSync(key);
    else Storage.setItemSync(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the value still lives in memory this session.
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Permission = 'granted' | 'denied' | 'undetermined';

type AppDataValue = {
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  places: Place[];
  addPlace: (place: Omit<Place, 'id' | 'createdAt'>) => void;
  setPlaceKind: (id: string, kind: PlaceKind) => void;
  removePlace: (id: string) => void;
  history: LastSeen[];
  lastSeen: LastSeen | null;
  clearHistory: () => void;
  /** Set while a left-behind alert is active (fired and the tag still away). */
  leftBehind: { since: number; label: string } | null;
  dismissAlert: () => void;
  snooze: () => void;
  locationPermission: Permission;
  notificationPermission: Permission;
  requestLocation: () => Promise<boolean>;
  requestNotifications: () => Promise<boolean>;
  /** Current phone location (asks permission if needed); null if unavailable. */
  currentLocation: () => Promise<(LatLon & { accuracy: number | null }) | null>;
};

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const tag = useMiniTag();
  const [prefs, setPrefsState] = useState<Prefs>(() => load(KEYS.prefs, DEFAULT_PREFS));
  const [places, setPlaces] = useState<Place[]>(() => loadList<Place>(KEYS.places));
  const [history, setHistory] = useState<LastSeen[]>(() => loadList<LastSeen>(KEYS.history));
  const [pending, setPending] = useState<PendingAlert | null>(() => {
    const p = load<PendingAlert | null>(KEYS.pending, null);
    return p && p.id ? p : null;
  });
  const [now, setNow] = useState(Date.now);
  const [locationPermission, setLocationPermission] = useState<Permission>('undetermined');
  const [notificationPermission, setNotificationPermission] = useState<Permission>('undetermined');

  // Latest values for async callbacks (updated after each render).
  const live = useRef({ prefs, places, trackerName: tag.tracker?.name ?? 'MiniTag' });
  useEffect(() => {
    live.current = { prefs, places, trackerName: tag.tracker?.name ?? 'MiniTag' };
  });

  // ---- persistence ------------------------------------------------------------
  useEffect(() => save(KEYS.prefs, prefs), [prefs]);
  useEffect(() => save(KEYS.places, places), [places]);
  useEffect(() => save(KEYS.history, history), [history]);
  useEffect(() => save(KEYS.pending, pending), [pending]);

  // ---- permissions ------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      Promise.all([
        Location.getForegroundPermissionsAsync().catch(() => null),
        Notifications.getPermissionsAsync().catch(() => null),
      ]).then(([loc, notif]) => {
        if (!alive) return;
        if (loc) setLocationPermission(loc.status as Permission);
        if (notif) setNotificationPermission(notif.status as Permission);
      });
    refresh();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const requestLocation = useCallback(async () => {
    const res = await Location.requestForegroundPermissionsAsync().catch(() => null);
    setLocationPermission((res?.status as Permission) ?? 'denied');
    return res?.status === 'granted';
  }, []);

  const requestNotifications = useCallback(async () => {
    const res = await Notifications.requestPermissionsAsync().catch(() => null);
    setNotificationPermission((res?.status as Permission) ?? 'denied');
    return res?.status === 'granted';
  }, []);

  // ---- location -----------------------------------------------------------------
  const currentLocation = useCallback(async () => {
    const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
    if (perm?.status !== 'granted') return null;
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000 }).catch(() => null);
    const pos =
      recent ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null));
    if (!pos) return null;
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
  }, []);

  const labelFor = useCallback(async (point: LatLon): Promise<{ label: string; placeId: string | null }> => {
    const place = placeAt(point, live.current.places);
    if (place) return { label: place.name, placeId: place.id };
    const addr = await Location.reverseGeocodeAsync(point).catch(() => []);
    const a = addr[0];
    const label = a?.name || a?.street || a?.district || a?.city || 'Unknown place';
    return { label, placeId: null };
  }, []);

  /** Save where the phone is now as the tag's last-seen point. */
  const recordLastSeen = useCallback(
    async (at: number): Promise<LastSeen | null> => {
      if (!live.current.prefs.rememberLastSeen) return null;
      const point = await currentLocation();
      if (!point) return null;
      const { label, placeId } = await labelFor(point);
      const entry: LastSeen = { ...point, at, label, placeId };
      setHistory((h) => pushHistory(h, entry));
      return entry;
    },
    [currentLocation, labelFor],
  );

  // ---- alerts ---------------------------------------------------------------------
  const cancelPending = useCallback(() => {
    setPending((p) => {
      if (p) Notifications.cancelScheduledNotificationAsync(p.id).catch(() => {});
      return null;
    });
  }, []);

  const scheduleAlert = useCallback(async (label: string, since: number) => {
    const { prefs: pr, trackerName } = live.current;
    if (!pr.alertsEnabled) return;
    if (pr.snoozedUntil && Date.now() < pr.snoozedUntil) return;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${trackerName} left behind?`,
        body: `You may have left your ${trackerName} behind${label !== 'Unknown place' ? ` at ${label}` : ''}. MiniTag is no longer connected.`,
        data: { kind: 'left-behind' },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: pr.alertDelay },
    }).catch(() => null);
    if (id) setPending({ id, since, fireAt: since + pr.alertDelay * 1000, label });
  }, []);

  // React to connection changes. The connection is an external system (the BLE
  // client), so syncing alert state to its transitions here is intended.
  const prevConnection = useRef(tag.connection);
  useEffect(() => {
    const prev = prevConnection.current;
    prevConnection.current = tag.connection;

    if (tag.connection === 'connected' && prev !== 'connected') {
      cancelPending();
      recordLastSeen(Date.now());
    }
    if (prev === 'connected' && tag.connection === 'reconnecting') {
      const at = tag.lastDisconnectedAt ?? Date.now();
      (async () => {
        const entry = await recordLastSeen(at);
        const point = entry ?? history[0] ?? null;
        if (shouldAlertAt(point, live.current.places)) await scheduleAlert(point?.label ?? 'Unknown place', at);
      })();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tracker removed
    if (tag.connection === 'idle') cancelPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag.connection]);

  // Keep the last-seen point fresh while connected and the app is open.
  useEffect(() => {
    if (tag.connection !== 'connected') return;
    const t = setInterval(() => {
      if (AppState.currentState === 'active') recordLastSeen(Date.now());
    }, LOCATION_REFRESH_MS);
    return () => clearInterval(t);
  }, [tag.connection, recordLastSeen]);

  // Tick so a pending alert turns into an active one on screen.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, [pending]);

  // Opening the app from the notification shows the alert screen.
  useEffect(() => {
    const open = (n: Notifications.Notification) => {
      if (n.request.content.data?.kind === 'left-behind') router.push('/alert');
    };
    const received = Notifications.addNotificationReceivedListener((n) => {
      setNow(Date.now());
      open(n);
    });
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    const last = Notifications.getLastNotificationResponse();
    if (last && Date.now() - last.notification.date < 10 * 60_000) open(last.notification);
    return () => {
      received.remove();
      tapped.remove();
    };
  }, []);

  const leftBehind = useMemo(
    () =>
      pending && now >= pending.fireAt && tag.connection !== 'connected'
        ? { since: pending.since, label: pending.label }
        : null,
    [pending, now, tag.connection],
  );

  // ---- actions ---------------------------------------------------------------------
  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => {
      setPrefsState((p) => ({ ...p, ...patch }));
      if (patch.alertsEnabled === false) cancelPending();
    },
    [cancelPending],
  );

  const addPlace = useCallback((place: Omit<Place, 'id' | 'createdAt'>) => {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setPlaces((list) => [...list, { ...place, id, createdAt: Date.now() }]);
  }, []);

  const setPlaceKind = useCallback((id: string, kind: PlaceKind) => {
    setPlaces((list) => list.map((p) => (p.id === id ? { ...p, kind } : p)));
  }, []);

  const removePlace = useCallback((id: string) => setPlaces((list) => list.filter((p) => p.id !== id)), []);

  const value = useMemo<AppDataValue>(
    () => ({
      prefs,
      setPrefs,
      places,
      addPlace,
      setPlaceKind,
      removePlace,
      history,
      lastSeen: history[0] ?? null,
      clearHistory: () => setHistory([]),
      leftBehind,
      dismissAlert: cancelPending,
      snooze: () => {
        cancelPending();
        setPrefsState((p) => ({ ...p, snoozedUntil: Date.now() + SNOOZE_MS }));
      },
      locationPermission,
      notificationPermission,
      requestLocation,
      requestNotifications,
      currentLocation,
    }),
    [
      prefs, setPrefs, places, addPlace, setPlaceKind, removePlace, history, leftBehind, cancelPending,
      locationPermission, notificationPermission, requestLocation, requestNotifications, currentLocation,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
}
