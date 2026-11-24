/**
 * MiniTag BLE protocol v1 — mirrors docs/ble-protocol.md and the firmware's config.h.
 * Pure functions only (no React Native imports) so this file can be unit-tested in Node.
 */
import { Buffer } from 'buffer';

export const DEVICE_NAME = 'MiniTag';

/** Advertised by the StellaUWB library; used as the scan filter. */
export const ADVERTISED_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

export const MINITAG_SERVICE_UUID = '1c400001-524a-4696-9523-dd1cee737c33';
export const COMMAND_CHAR_UUID = '1c400002-524a-4696-9523-dd1cee737c33';
export const EVENT_CHAR_UUID = '1c400003-524a-4696-9523-dd1cee737c33';
export const STATUS_CHAR_UUID = '1c400004-524a-4696-9523-dd1cee737c33';

export const SUPPORTED_PROTOCOL_VERSION = 1;
export const FIND_DEFAULT_SECONDS = 30;
export const FIND_MAX_SECONDS = 120;

export type TagStatus = {
  protocolVersion: number;
  buzzing: boolean;
  uwbActive: boolean;
  batteryValid: boolean;
  usbPowered: boolean;
  /** Firmware 0.2+: the tag will beep by itself if it loses the phone. */
  awayArmed: boolean;
  millivolts: number;
  firmware: string;
};

export type Command = 'FIND' | 'STOP' | 'STATUS' | 'BATTERY' | 'ARM' | 'DISARM';

export type TagEvent =
  | { kind: 'ok'; command: string; arg?: string; raw: string }
  | { kind: 'error'; code: string; raw: string }
  | { kind: 'button'; raw: string }
  | { kind: 'findTimeout'; raw: string }
  | { kind: 'ready'; raw: string }
  | { kind: 'unknown'; raw: string };

/** Decode the 6-byte status characteristic (base64, as ble-plx delivers it). */
export function parseStatus(base64: string): TagStatus {
  const b = Buffer.from(base64, 'base64');
  if (b.length < 6) {
    throw new Error(`Status payload too short: ${b.length} bytes`);
  }
  const flags = b.readUInt8(1);
  return {
    protocolVersion: b.readUInt8(0),
    buzzing: (flags & 0x01) !== 0,
    uwbActive: (flags & 0x02) !== 0,
    batteryValid: (flags & 0x04) !== 0,
    usbPowered: (flags & 0x08) !== 0,
    awayArmed: (flags & 0x10) !== 0,
    millivolts: b.readUInt16LE(2),
    firmware: `${b.readUInt8(4)}.${b.readUInt8(5)}`,
  };
}

/** Build a command string, e.g. encodeCommand('FIND', 20) -> base64 of "FIND 20". */
export function encodeCommand(command: Command, seconds?: number): string {
  let text: string = command;
  if (command === 'FIND' && seconds !== undefined) {
    const s = Math.round(seconds);
    if (!Number.isFinite(s) || s < 1) throw new Error(`Invalid FIND duration: ${seconds}`);
    text += ` ${Math.min(s, FIND_MAX_SECONDS)}`;
  }
  return Buffer.from(text, 'utf8').toString('base64');
}

/** Decode an event notification into a typed event. */
export function parseEvent(base64: string): TagEvent {
  const raw = Buffer.from(base64, 'base64').toString('utf8').trim();
  const [head, second, ...rest] = raw.split(' ');
  if (head === 'OK' && second) {
    return { kind: 'ok', command: second, arg: rest.length ? rest.join(' ') : undefined, raw };
  }
  if (head === 'ERR' && second) return { kind: 'error', code: second, raw };
  if (head === 'EVT') {
    if (second === 'BUTTON') return { kind: 'button', raw };
    if (second === 'FIND_TIMEOUT') return { kind: 'findTimeout', raw };
    if (second === 'READY') return { kind: 'ready', raw };
  }
  return { kind: 'unknown', raw };
}

export type BatteryLevel = 'usb' | 'good' | 'low' | 'replace' | 'unknown';

/**
 * Rough CR2032 level from the tag's supply voltage. Coin cells have a flat
 * discharge curve, so a percentage would be misleading (see the spec's
 * "only display battery if reliable" rule).
 */
export function batteryLevel(status: TagStatus | null): BatteryLevel {
  if (!status) return 'unknown';
  if (status.usbPowered) return 'usb';
  if (!status.batteryValid || status.millivolts === 0) return 'unknown';
  if (status.millivolts >= 2800) return 'good';
  if (status.millivolts >= 2500) return 'low';
  return 'replace';
}

/** Human-readable message for an error code returned by the tag. */
export function describeError(code: string): string {
  switch (code) {
    case 'BAD_ARG':
      return 'The tracker rejected the command value.';
    case 'UNKNOWN_CMD':
      return 'The tracker did not recognise the command. Its firmware may be out of date.';
    case 'UWB_VIA_NI':
      return 'Precision Find uses Nearby Interaction, not a tracker command.';
    default:
      return `Tracker error: ${code}`;
  }
}
