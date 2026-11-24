// Run with: npm test   (Node's built-in test runner; Node >= 23 strips TS types)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Buffer } from 'buffer';

import {
  batteryLevel,
  encodeCommand,
  parseEvent,
  parseStatus,
  type TagStatus,
} from '../src/ble/protocol.ts';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');
const text = (base64: string) => Buffer.from(base64, 'base64').toString('utf8');

test('parseStatus decodes the payload captured from the real Stella', () => {
  // From tools/ble_test.py on hardware: v1 flags=[batt_valid, usb] mv=3253 fw=0.1
  const s = parseStatus(b64([1, 0x0c, 0xb5, 0x0c, 0, 1]));
  assert.deepEqual(s, {
    protocolVersion: 1,
    buzzing: false,
    uwbActive: false,
    batteryValid: true,
    usbPowered: true,
    awayArmed: false,
    millivolts: 3253,
    firmware: '0.1',
  });
});

test('parseStatus reads the buzzer and UWB flags', () => {
  const s = parseStatus(b64([1, 0x03, 0, 0, 0, 1]));
  assert.equal(s.buzzing, true);
  assert.equal(s.uwbActive, true);
  assert.equal(s.batteryValid, false);
});

test('parseStatus reads the left-behind armed flag (firmware 0.2)', () => {
  const s = parseStatus(b64([1, 0x10 | 0x04, 0x0a, 0x0b, 0, 2]));
  assert.equal(s.awayArmed, true);
  assert.equal(s.buzzing, false);
  assert.equal(s.firmware, '0.2');
});

test('parseStatus rejects short payloads', () => {
  assert.throws(() => parseStatus(b64([1, 0])));
});

test('encodeCommand builds the text the firmware expects', () => {
  assert.equal(text(encodeCommand('FIND')), 'FIND');
  assert.equal(text(encodeCommand('FIND', 20)), 'FIND 20');
  assert.equal(text(encodeCommand('FIND', 999)), 'FIND 120');
  assert.equal(text(encodeCommand('STOP')), 'STOP');
  assert.equal(text(encodeCommand('ARM')), 'ARM');
  assert.equal(text(encodeCommand('DISARM')), 'DISARM');
  assert.throws(() => encodeCommand('FIND', 0));
});

test('parseEvent understands every firmware event', () => {
  const ev = (s: string) => parseEvent(Buffer.from(s).toString('base64'));
  assert.deepEqual(ev('OK FIND 30'), { kind: 'ok', command: 'FIND', arg: '30', raw: 'OK FIND 30' });
  assert.deepEqual(ev('OK STOP'), { kind: 'ok', command: 'STOP', arg: undefined, raw: 'OK STOP' });
  assert.deepEqual(ev('OK ARM'), { kind: 'ok', command: 'ARM', arg: undefined, raw: 'OK ARM' });
  assert.deepEqual(ev('ERR BAD_ARG'), { kind: 'error', code: 'BAD_ARG', raw: 'ERR BAD_ARG' });
  assert.equal(ev('EVT BUTTON').kind, 'button');
  assert.equal(ev('EVT FIND_TIMEOUT').kind, 'findTimeout');
  assert.equal(ev('EVT READY').kind, 'ready');
  assert.equal(ev('something else').kind, 'unknown');
});

test('batteryLevel maps voltages to coarse levels', () => {
  const at = (mv: number, usb = false): TagStatus => ({
    protocolVersion: 1, buzzing: false, uwbActive: false,
    batteryValid: true, usbPowered: usb, awayArmed: false, millivolts: mv, firmware: '0.1',
  });
  assert.equal(batteryLevel(null), 'unknown');
  assert.equal(batteryLevel(at(3253, true)), 'usb');
  assert.equal(batteryLevel(at(3000)), 'good');
  assert.equal(batteryLevel(at(2600)), 'low');
  assert.equal(batteryLevel(at(2300)), 'replace');
});
