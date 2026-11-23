import assert from 'node:assert/strict';
import { test } from 'node:test';

import { distanceMetres, placeAt, pushHistory, shouldAlertAt, type LastSeen, type Place } from '../src/features/geo.ts';

const library: Place = { id: 'lib', name: 'Library', latitude: 51.5, longitude: -0.12, radius: 60, kind: 'watch', createdAt: 0 };
const dorm: Place = { id: 'dorm', name: 'Dorm', latitude: 51.501, longitude: -0.12, radius: 40, kind: 'safe', createdAt: 0 };

test('distanceMetres is about 111 m per 0.001 degree of latitude', () => {
  const d = distanceMetres({ latitude: 51.5, longitude: -0.12 }, { latitude: 51.501, longitude: -0.12 });
  assert.ok(Math.abs(d - 111) < 2, `got ${d}`);
});

test('placeAt finds the place whose circle contains the point', () => {
  assert.equal(placeAt({ latitude: 51.5001, longitude: -0.12 }, [library, dorm])?.id, 'lib');
  assert.equal(placeAt({ latitude: 51.501, longitude: -0.1201 }, [library, dorm])?.id, 'dorm');
  assert.equal(placeAt({ latitude: 51.6, longitude: -0.12 }, [library, dorm]), null);
});

test('shouldAlertAt stays quiet only inside safe places', () => {
  assert.equal(shouldAlertAt({ latitude: 51.501, longitude: -0.12 }, [library, dorm]), false); // dorm (safe)
  assert.equal(shouldAlertAt({ latitude: 51.5, longitude: -0.12 }, [library, dorm]), true); // library (watched)
  assert.equal(shouldAlertAt({ latitude: 40, longitude: 0 }, [library, dorm]), true); // nowhere saved
  assert.equal(shouldAlertAt(null, [dorm]), true); // no location: alert to be safe
});

test('pushHistory keeps newest first and merges repeats at the same spot', () => {
  const at = (t: number, lat: number, label: string): LastSeen => ({
    at: t, latitude: lat, longitude: 0, label, placeId: null, accuracy: 10,
  });
  let h: LastSeen[] = [];
  h = pushHistory(h, at(1, 10, 'A'));
  h = pushHistory(h, at(2, 10.00001, 'A')); // same spot: replaces
  h = pushHistory(h, at(3, 11, 'B'));
  assert.deepEqual(h.map((e) => e.at), [3, 2]);
  for (let i = 0; i < 20; i++) h = pushHistory(h, at(10 + i, 20 + i, `P${i}`));
  assert.equal(h.length, 10);
});
