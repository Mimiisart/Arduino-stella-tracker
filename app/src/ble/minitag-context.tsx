import Storage from 'expo-sqlite/kv-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { ClientState, FoundDevice, MiniTagClient } from './minitag-client';
import { Command, TagEvent } from './protocol';

const TRACKER_KEY = 'minitag.tracker';
/** Set by the Welcome screen once permissions have been explained. */
export const ONBOARDED_KEY = 'minitag.onboarded';
const LAST_CONNECTED_KEY = 'minitag.lastConnectedAt';

export type SavedTracker = { id: string; name: string };

type MiniTagContextValue = ClientState & {
  tracker: SavedTracker | null;
  scan: (onFound: (d: FoundDevice) => void, onDone: () => void) => () => void;
  pair: (device: FoundDevice, name: string) => Promise<void>;
  rename: (name: string) => void;
  forget: () => Promise<void>;
  send: (command: Command, seconds?: number) => Promise<TagEvent>;
  /** Start Bluetooth (shows iOS's permission prompt the first time). */
  startBluetooth: () => void;
};

const MiniTagContext = createContext<MiniTagContextValue | null>(null);

// One BleManager for the whole app (ble-plx requires a single instance).
let sharedClient: MiniTagClient | null = null;
function getClient() {
  if (!sharedClient) sharedClient = new MiniTagClient();
  return sharedClient;
}

function loadTracker(): SavedTracker | null {
  try {
    const raw = Storage.getItemSync(TRACKER_KEY);
    return raw ? (JSON.parse(raw) as SavedTracker) : null;
  } catch {
    return null;
  }
}

export function MiniTagProvider({ children }: { children: ReactNode }) {
  const client = getClient();
  const state = useSyncExternalStore(
    (cb) => client.subscribe(cb),
    () => client.state,
  );
  const [tracker, setTracker] = useState<SavedTracker | null>(loadTracker);
  const [storedLastConnected] = useState<number | null>(() => {
    const raw = Storage.getItemSync(LAST_CONNECTED_KEY);
    return raw ? Number(raw) : null;
  });

  // Reconnect to the saved tracker on launch. Bluetooth starts here only for
  // people who have been through Welcome, so iOS never asks before we explain.
  useEffect(() => {
    if (tracker && client.state.deviceId !== tracker.id) client.resume(tracker.id);
    else if (Storage.getItemSync(ONBOARDED_KEY)) client.start();
    // Only on first mount; pair()/forget() handle later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the last successful connection time for the dashboard.
  useEffect(() => {
    if (state.lastConnectedAt) Storage.setItemSync(LAST_CONNECTED_KEY, String(state.lastConnectedAt));
  }, [state.lastConnectedAt]);

  const pair = useCallback(
    async (device: FoundDevice, name: string) => {
      await client.connect(device.id);
      const saved = { id: device.id, name: name.trim() || 'School ID' };
      Storage.setItemSync(TRACKER_KEY, JSON.stringify(saved));
      setTracker(saved);
    },
    [client],
  );

  const rename = useCallback((name: string) => {
    setTracker((t) => {
      if (!t) return t;
      const next = { ...t, name: name.trim() || t.name };
      Storage.setItemSync(TRACKER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const forget = useCallback(async () => {
    // Removing the tracker on purpose must not set off its left-behind beep.
    if (client.state.connection === 'connected') await client.send('DISARM').catch(() => {});
    await client.forget();
    Storage.removeItemSync(TRACKER_KEY);
    Storage.removeItemSync(LAST_CONNECTED_KEY);
    setTracker(null);
  }, [client]);

  const value = useMemo<MiniTagContextValue>(
    () => ({
      ...state,
      lastConnectedAt: state.lastConnectedAt ?? (tracker ? storedLastConnected : null),
      tracker,
      scan: (onFound, onDone) => client.scan(onFound, onDone),
      pair,
      rename,
      forget,
      send: (command, seconds) => client.send(command, seconds),
      startBluetooth: () => {
        client.start();
      },
    }),
    [state, tracker, storedLastConnected, client, pair, rename, forget],
  );

  return <MiniTagContext.Provider value={value}>{children}</MiniTagContext.Provider>;
}

export function useMiniTag(): MiniTagContextValue {
  const ctx = useContext(MiniTagContext);
  if (!ctx) throw new Error('useMiniTag must be used inside <MiniTagProvider>');
  return ctx;
}
