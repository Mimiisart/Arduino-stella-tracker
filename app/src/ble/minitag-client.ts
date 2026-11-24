/**
 * Owns the BLE connection to one MiniTag. Not React-aware: the provider in
 * minitag-context.tsx subscribes to it and mirrors its state into components.
 */
import { Platform } from 'react-native';
import {
  BleError,
  BleManager,
  Device,
  State as BleState,
  Subscription,
} from 'react-native-ble-plx';

import {
  ADVERTISED_SERVICE_UUID,
  COMMAND_CHAR_UUID,
  Command,
  DEVICE_NAME,
  EVENT_CHAR_UUID,
  MINITAG_SERVICE_UUID,
  STATUS_CHAR_UUID,
  TagEvent,
  TagStatus,
  describeError,
  encodeCommand,
  parseEvent,
  parseStatus,
} from './protocol';

export type BluetoothAvailability = 'unknown' | 'on' | 'off' | 'unauthorized' | 'unsupported';

/**
 * idle         – no tracker selected
 * connecting   – first connection attempt in progress (user initiated)
 * connected    – services discovered and notifications subscribed
 * reconnecting – tracker selected but out of range; the OS keeps a pending
 *                connection open and completes it when the tag reappears
 */
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting';

export type ClientState = {
  bluetooth: BluetoothAvailability;
  connection: ConnectionState;
  deviceId: string | null;
  status: TagStatus | null;
  lastEvent: TagEvent | null;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
};

export type FoundDevice = { id: string; name: string; rssi: number | null };

type ReplyWaiter = {
  command: Command;
  resolve: (e: TagEvent) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const CONNECT_TIMEOUT_MS = 10_000;
const REPLY_TIMEOUT_MS = 4_000;

export class MiniTagClient {
  private _manager: BleManager | null = null;
  private listeners = new Set<(s: ClientState) => void>();
  private subscriptions: Subscription[] = [];
  private disconnectSub: Subscription | null = null;
  private waiters: ReplyWaiter[] = [];
  private wantConnected = false;

  state: ClientState = {
    bluetooth: 'unknown',
    connection: 'idle',
    deviceId: null,
    status: null,
    lastEvent: null,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
  };

  /** True once Bluetooth has been started (and iOS has asked for permission). */
  get started(): boolean {
    return this._manager !== null;
  }

  /**
   * Start Bluetooth. Creating the manager is what makes iOS show its Bluetooth
   * permission prompt, so this waits until the Welcome screen has explained why
   * (or until a paired tracker needs reconnecting). Any use of `manager` calls it.
   */
  start(): BleManager {
    if (this._manager) return this._manager;
    const manager = new BleManager({
      // Lets iOS relaunch the app in the background for BLE events
      // (needed later for leave-behind alerts).
      restoreStateIdentifier: 'minitag-central',
      restoreStateFunction: (restored) => {
        const device = restored?.connectedPeripherals?.[0];
        if (device) {
          this.wantConnected = true;
          this.set({ deviceId: device.id });
          this.setUp(device).catch(() => this.reconnect());
        }
      },
    });

    this._manager = manager;

    manager.onStateChange((s) => {
      this.set({ bluetooth: mapBleState(s) });
      if (s === BleState.PoweredOn && this.wantConnected && this.state.connection !== 'connected') {
        this.reconnect();
      }
    }, true);
    return manager;
  }

  private get manager(): BleManager {
    return this.start();
  }

  // ---- subscription -------------------------------------------------------

  subscribe(listener: (s: ClientState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<ClientState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  // ---- discovery ----------------------------------------------------------

  /** Scan for MiniTags. Returns a stop function; also stops after timeoutMs. */
  scan(onFound: (d: FoundDevice) => void, onDone: () => void, timeoutMs = 12_000): () => void {
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      this.manager.stopDeviceScan().catch(() => {});
      onDone();
    };
    const timer = setTimeout(stop, timeoutMs);

    this.manager
      .startDeviceScan([ADVERTISED_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
        if (error) {
          stop();
          return;
        }
        if (device && (device.localName === DEVICE_NAME || device.name === DEVICE_NAME)) {
          onFound({ id: device.id, name: 'MiTag', rssi: device.rssi }); // shown in the scan list; the tag still advertises as DEVICE_NAME
        }
      })
      .catch(() => stop());

    return stop;
  }

  // ---- connection ---------------------------------------------------------

  /** User-initiated connect to a tracker found by scan(), or a saved one. */
  async connect(deviceId: string): Promise<void> {
    this.wantConnected = true;
    this.set({ deviceId, connection: 'connecting' });
    try {
      const device = await this.manager.connectToDevice(deviceId, { timeout: CONNECT_TIMEOUT_MS });
      await this.setUp(device);
    } catch (err) {
      // Keep trying in the background; the caller still learns it failed now.
      this.reconnect();
      throw toError(err, 'Could not connect to MiTag.');
    }
  }

  /** Resume a saved tracker without blocking (used on app start). */
  resume(deviceId: string) {
    this.wantConnected = true;
    this.set({ deviceId });
    this.start(); // reconnects once Bluetooth reports it is on
    if (this.state.bluetooth === 'on') this.reconnect();
  }

  /** Forget the tracker: drop the connection and stop reconnecting. */
  async forget(): Promise<void> {
    this.wantConnected = false;
    const id = this.state.deviceId;
    this.tearDown();
    this.set({ connection: 'idle', deviceId: null, status: null, lastEvent: null });
    if (id) await this.manager.cancelDeviceConnection(id).catch(() => {});
  }

  /**
   * Open a pending connection with no timeout. On iOS, CoreBluetooth keeps it
   * alive (even in the background) and connects when the tag is back in
   * range. On Android, autoConnect does the same.
   */
  private reconnect() {
    const id = this.state.deviceId;
    if (!id || !this.wantConnected || this.state.bluetooth !== 'on') return;
    this.set({ connection: 'reconnecting' });
    this.manager
      .connectToDevice(id, Platform.OS === 'android' ? { autoConnect: true } : undefined)
      .then((device) => this.setUp(device))
      .catch(() => {
        // Cancelled (forget) or Bluetooth went off; onStateChange retries.
      });
  }

  private async setUp(device: Device) {
    await device.discoverAllServicesAndCharacteristics();
    this.tearDown();

    this.subscriptions.push(
      device.monitorCharacteristicForService(MINITAG_SERVICE_UUID, EVENT_CHAR_UUID, (error, ch) => {
        if (error || !ch?.value) return;
        this.handleEvent(parseEvent(ch.value));
      }),
      device.monitorCharacteristicForService(MINITAG_SERVICE_UUID, STATUS_CHAR_UUID, (error, ch) => {
        if (error || !ch?.value) return;
        this.handleStatus(ch.value);
      }),
    );

    this.disconnectSub = this.manager.onDeviceDisconnected(device.id, () => {
      this.tearDown();
      this.set({ lastDisconnectedAt: Date.now() });
      if (this.wantConnected) {
        this.reconnect();
      } else {
        this.set({ connection: 'idle' });
      }
    });

    const status = await device.readCharacteristicForService(MINITAG_SERVICE_UUID, STATUS_CHAR_UUID);
    if (status.value) this.handleStatus(status.value);

    this.set({ connection: 'connected', lastConnectedAt: Date.now() });
  }

  private tearDown() {
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];
    this.disconnectSub?.remove();
    this.disconnectSub = null;
    this.waiters.forEach((w) => {
      clearTimeout(w.timer);
      w.reject(new Error('MiTag disconnected.'));
    });
    this.waiters = [];
  }

  // ---- commands -----------------------------------------------------------

  /** Send a command and wait for the tag's OK/ERR reply. */
  async send(command: Command, seconds?: number): Promise<TagEvent> {
    const id = this.state.deviceId;
    if (!id || this.state.connection !== 'connected') {
      throw new Error('MiTag is not connected.');
    }

    const reply = new Promise<TagEvent>((resolve, reject) => {
      const waiter: ReplyWaiter = {
        command,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new Error('MiTag did not respond.'));
        }, REPLY_TIMEOUT_MS),
      };
      this.waiters.push(waiter);
    });

    try {
      await this.manager.writeCharacteristicWithResponseForDevice(
        id,
        MINITAG_SERVICE_UUID,
        COMMAND_CHAR_UUID,
        encodeCommand(command, seconds),
      );
    } catch (err) {
      // Drop the waiter we just added; its reply will never come.
      const w = this.waiters.pop();
      if (w) clearTimeout(w.timer);
      throw toError(err, 'Could not send the command to MiTag.');
    }

    const event = await reply;
    if (event.kind === 'error') throw new Error(describeError(event.code));
    return event;
  }

  private handleEvent(event: TagEvent) {
    this.set({ lastEvent: event });

    // Replies arrive in command order; the oldest waiter matches first.
    if (event.kind === 'ok' || event.kind === 'error') {
      const index =
        event.kind === 'ok'
          ? this.waiters.findIndex((w) => w.command === event.command)
          : 0;
      const waiter = this.waiters[index];
      if (waiter) {
        this.waiters.splice(index, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(event);
      }
    }
  }

  private handleStatus(base64: string) {
    try {
      this.set({ status: parseStatus(base64) });
    } catch {
      // Ignore malformed payloads rather than crash the UI.
    }
  }
}

function mapBleState(s: BleState): BluetoothAvailability {
  switch (s) {
    case BleState.PoweredOn:
      return 'on';
    case BleState.PoweredOff:
      return 'off';
    case BleState.Unauthorized:
      return 'unauthorized';
    case BleState.Unsupported:
      return 'unsupported';
    default:
      return 'unknown';
  }
}

function toError(err: unknown, fallback: string): Error {
  if (err instanceof BleError) return new Error(err.reason ?? err.message ?? fallback);
  if (err instanceof Error) return err;
  return new Error(fallback);
}
