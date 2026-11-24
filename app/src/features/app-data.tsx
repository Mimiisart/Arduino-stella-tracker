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
import { AppState, Vibration } from 'react-native';

import { useMiniTag } from '@/ble/minitag-context';
import { useCampus, type CampusPlace } from './campus';
import { useIndoor } from './indoor-context';
import { distanceMetres, placeAt, pushHistory, shouldAlertAt, type LastSeen, type LatLon, type Place, type PlaceKind } from './geo';

export type AlertDelay = 5 | 10 | 30 | 60 | 120;
export const ALERT_DELAYS: AlertDelay[] = [5, 10, 30, 60, 120];

export type Prefs = {
  alertsEnabled: boolean;
  alertDelay: AlertDelay; // seconds
  rememberLastSeen: boolean;
  /** The tracker itself beeps when it is left behind (firmware 0.2+). */
  tagBeep: boolean;
  /** The phone itself keeps beeping and vibrating, not just one notification. */
  phoneBuzz: boolean;
  snoozedUntil: number | null;
};

type PendingAlert = { ids: string[]; since: number; fireAt: number; label: string };

const DEFAULT_PREFS: Prefs = {
  alertsEnabled: true,
  alertDelay: 60,
  rememberLastSeen: true,
  tagBeep: true,
  phoneBuzz: true,
  snoozedUntil: null,
};
const KEYS = {
  prefs: 'minitag.prefs',
  places: 'minitag.places',
  history: 'minitag.history',
  pending: 'minitag.pendingAlert',
};
const LOCATION_REFRESH_MS = 3 * 60_000;
const SNOOZE_MS = 60 * 60_000;
/** With phoneBuzz on: the alert repeats this many seconds after it first fires. */
const REPEAT_AFTER_S = [10, 20];
/** While MiTag is open: buzz on, buzz off (ms), for at most this long. */
const VIBRATE_PATTERN = [0, 600, 400];
const VIBRATE_FOR_MS = 60_000;
/** Bundled by the expo-notifications plugin (app.json); iOS plays up to 30 s of it. */
const ALARM_SOUND = 'mitag_alarm.wav';

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
    const p = load<(PendingAlert & { id?: string }) | null>(KEYS.pending, null);
    if (p && !p.ids && p.id) return { ...p, ids: [p.id] }; // saved by an older version
    return p && p.ids?.length ? p : null;
  });
  const [now, setNow] = useState(Date.now);
  const [locationPermission, setLocationPermission] = useState<Permission>('undetermined');
  const [notificationPermission, setNotificationPermission] = useState<Permission>('undetermined');

  // Latest values for async callbacks (updated after each render).
  const campus = useCampus();
  const indoor = useIndoor();
  const live = useRef({
    prefs,
    places,
    campus: campus.places as CampusPlace[],
    locateAt: indoor.locateAt,
    trackerName: tag.tracker?.name ?? 'MiTag',
  });
  useEffect(() => {
    live.current = { prefs, places, campus: campus.places, locateAt: indoor.locateAt, trackerName: tag.tracker?.name ?? 'MiTag' };
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
    // Then campus geodata: building footprint + barometer floor + room.
    const fix = live.current.locateAt(point, (point as LatLon & { accuracy?: number | null }).accuracy ?? null);
    if (fix?.building) return { label: fix.label, placeId: null };
    // Then the school's other campus places: the closest building whose area contains the point.
    let building: CampusPlace | null = null;
    let best = Infinity;
    for (const c of live.current.campus) {
      const d = distanceMetres(point, c);
      if (d <= c.radius && d < best) {
        building = c;
        best = d;
      }
    }
    if (building) return { label: building.name, placeId: null };
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
      p?.ids.forEach((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}));
      return null;
    });
  }, []);

  const scheduleAlert = useCallback(async (label: string, since: number) => {
    const { prefs: pr, trackerName } = live.current;
    if (!pr.alertsEnabled) return;
    if (pr.snoozedUntil && Date.now() < pr.snoozedUntil) return;
    const at = label !== 'Unknown place' ? ` at ${label}` : '';
    // A 10-second loud alarm (assets/sounds) instead of the short default chime.
    const sound = pr.phoneBuzz ? ALARM_SOUND : true;
    const schedule = (seconds: number, title: string, body: string, kind: string) =>
      Notifications.scheduleNotificationAsync({
        // Time Sensitive gets through Do Not Disturb / Focus, but only once the app is
        // signed with the time-sensitive entitlement, which needs a paid Apple
        // developer account. Until then iOS treats it as a normal alert.
        content: { title, body, data: { kind }, sound, interruptionLevel: 'timeSensitive' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
      }).catch(() => null);
    const first = await schedule(
      pr.alertDelay,
      `${trackerName} left behind?`,
      `You may have left your ${trackerName} behind${at}. MiTag is no longer connected.`,
      'left-behind',
    );
    if (!first) return;
    // Each notification beeps and vibrates the phone once; repeat it a couple of
    // times so it is hard to miss. All are cancelled when the tag reconnects.
    const repeats = pr.phoneBuzz
      ? await Promise.all(
          REPEAT_AFTER_S.map((s) =>
            schedule(pr.alertDelay + s, `${trackerName} still not connected`, `Go back for your ${trackerName}${at}.`, 'left-behind-repeat'),
          ),
        )
      : [];
    const ids = [first, ...repeats.filter((id): id is string => !!id)];
    setPending({ ids, since, fireAt: since + pr.alertDelay * 1000, label });
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

  // Arm the tracker's own left-behind beep. The tag can't know about snoozes or
  // safe places, so the app tells it (ARM / DISARM) whenever that changes.
  // Firmware 0.1 doesn't know these commands; the error is ignored.
  const { send } = tag;
  const armedSent = useRef<boolean | null>(null);
  useEffect(() => {
    if (tag.connection !== 'connected') {
      armedSent.current = null; // re-send after every reconnect
      return;
    }
    const sync = () => {
      const snoozed = prefs.snoozedUntil !== null && Date.now() < prefs.snoozedUntil;
      const want = prefs.alertsEnabled && prefs.tagBeep && !snoozed && shouldAlertAt(history[0] ?? null, places);
      if (armedSent.current === want) return;
      armedSent.current = want;
      send(want ? 'ARM' : 'DISARM').catch(() => {});
    };
    sync();
    // Re-arm when a snooze runs out.
    const until = prefs.snoozedUntil;
    if (until === null || until <= Date.now()) return;
    const t = setTimeout(sync, until - Date.now() + 1_000);
    return () => clearTimeout(t);
  }, [tag.connection, prefs, history, places, send]);

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
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [pending]);

  // Opening the app from the notification shows the alert screen.
  useEffect(() => {
    const kindOf = (n: Notifications.Notification) => n.request.content.data?.kind;
    const open = (n: Notifications.Notification) => {
      if (kindOf(n) === 'left-behind' || kindOf(n) === 'left-behind-repeat') router.push('/alert');
    };
    const received = Notifications.addNotificationReceivedListener((n) => {
      setNow(Date.now());
      if (kindOf(n) === 'left-behind') open(n); // the repeats only beep; the screen is already up
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

  // While MiTag is open, keep vibrating until the tag is back, the alert is
  // dismissed, or a minute passes. (Locked or in the background, the repeated
  // notifications do the beeping and vibrating.)
  const buzzing = !!leftBehind && prefs.phoneBuzz;
  useEffect(() => {
    if (!buzzing) return;
    const start = () => AppState.currentState === 'active' && Vibration.vibrate(VIBRATE_PATTERN, true);
    start();
    const stopAt = setTimeout(() => Vibration.cancel(), VIBRATE_FOR_MS);
    const sub = AppState.addEventListener('change', (st) => (st === 'active' ? start() : Vibration.cancel()));
    return () => {
      clearTimeout(stopAt);
      sub.remove();
      Vibration.cancel();
    };
  }, [buzzing]);

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
