import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  distanceToPolygon,
  estimateFloor,
  floorName,
  heightFromPressure,
  locate,
  pointInPolygon,
  type Building,
  type Room,
} from '../src/features/indoor.ts';

// A 40 m x 40 m square building near PAU (about 0.00036 degrees on each side).
const sq = (lon: number, lat: number, d: number) => [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]];
const felix: Building = { id: 1, name: 'Felix Ohiwerei Building', category: 'Academic', levels: 3, floorHeight: 3.5, footprint: sq(3.854, 6.4865, 0.00036) };
const hostel: Building = { id: 2, name: null, category: 'Residential', levels: null, floorHeight: 3.0, footprint: sq(3.858, 6.4865, 0.0002) };
const inFelix = { latitude: 6.48668, longitude: 3.85418 };

const rooms: Room[] = [
  { id: 10, buildingId: 1, name: 'Classroom 1', floor: 0, kind: 'Classroom', latitude: 6.48660, longitude: 3.85410, footprint: null },
  { id: 11, buildingId: 1, name: 'Classroom 2', floor: 1, kind: 'Classroom', latitude: 6.48668, longitude: 3.85418, footprint: null },
  { id: 12, buildingId: 1, name: 'Lab A', floor: 1, kind: 'Lab', latitude: 6.48669, longitude: 3.85420, footprint: null },
];

test('pointInPolygon and distanceToPolygon agree with simple geometry', () => {
  assert.equal(pointInPolygon(inFelix, felix.footprint), true);
  assert.equal(pointInPolygon({ latitude: 6.4870, longitude: 3.8540 }, felix.footprint), false);
  assert.equal(distanceToPolygon(inFelix, felix.footprint), 0);
  const d = distanceToPolygon({ latitude: 6.4865, longitude: 3.85445 }, felix.footprint); // ~10 m east of the edge
  assert.ok(d > 8 && d < 12, `got ${d}`);
});

test('heightFromPressure: about 8.3 m per hPa near sea level', () => {
  const h = heightFromPressure(1012.0, 1013.0);
  assert.ok(h > 8 && h < 8.8, `got ${h}`);
  assert.equal(heightFromPressure(1013, 1013), 0);
});

test('estimateFloor rounds to floors, respects building height, and loses confidence with age', () => {
  assert.deepEqual(estimateFloor(3.6, 3.5, 5 * 60_000, 3), { floor: 1, heightM: 3.6, confidence: 'high' });
  assert.equal(estimateFloor(12, 3.5, 0, 3).floor, 2); // capped at the top floor of a 3-storey building
  assert.equal(estimateFloor(-1, 3.5, 0, null).floor, 0); // never below ground
  assert.equal(estimateFloor(5.3, 3.5, 0, null).confidence, 'medium'); // halfway between floors
  assert.equal(estimateFloor(3.5, 3.5, 2 * 60 * 60_000, null).confidence, 'low'); // stale reference
  assert.equal(floorName(0), 'Ground floor');
  assert.equal(floorName(1), 'First floor');
});

test('locate: building + floor + single matching room', () => {
  const fix = locate({ point: inFelix, accuracyM: 5, buildings: [felix, hostel], rooms: rooms.filter((r) => r.id !== 12), baro: { heightM: 3.4, refAgeMs: 60_000 } });
  assert.equal(fix.building?.id, 1);
  assert.equal(fix.floor?.floor, 1);
  assert.equal(fix.room?.name, 'Classroom 2');
  assert.equal(fix.label, 'Classroom 2 · First floor · Felix Ohiwerei Building');
});

test('locate: the barometer separates rooms stacked on different floors', () => {
  const ground = locate({ point: inFelix, accuracyM: 15, buildings: [felix], rooms: rooms.filter((r) => r.id !== 12), baro: { heightM: 0.3, refAgeMs: 60_000 } });
  assert.equal(ground.room?.name, 'Classroom 1');
});

test('locate: two rooms within the GPS uncertainty are reported honestly', () => {
  const fix = locate({ point: inFelix, accuracyM: 10, buildings: [felix], rooms, baro: { heightM: 3.5, refAgeMs: 60_000 } });
  assert.equal(fix.room, null);
  assert.equal(fix.label, 'Classroom 2 or Lab A · First floor · Felix Ohiwerei Building');
});

test('locate: near a building, unnamed buildings, and open ground', () => {
  assert.equal(locate({ point: { latitude: 6.4865, longitude: 3.85445 }, accuracyM: 15, buildings: [felix], rooms: [] }).label, 'Near Felix Ohiwerei Building');
  assert.equal(locate({ point: { latitude: 6.48655, longitude: 3.85805 }, accuracyM: 5, buildings: [hostel], rooms: [] }).label, 'a campus building');
  assert.equal(locate({ point: { latitude: 6.49, longitude: 3.86 }, accuracyM: 5, buildings: [felix], rooms: [] }).label, 'Outside the mapped buildings');
});
