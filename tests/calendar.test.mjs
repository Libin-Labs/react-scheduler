import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  addDays,
  assertDate,
  layoutEvents,
  moveEvent,
  startOfDay,
  validateEvents,
  visibleDays,
} from '../dist/esm/index.js';

const date = (day = 5, hour = 0, minute = 0) => new Date(2026, 9, day, hour, minute);
const event = (id, from, to) => ({
  id,
  title: id,
  start: date(5, from),
  end: date(5, to),
});

test('CJS and ESM expose the same API', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.equal(typeof cjs.Scheduler, 'function');
  assert.deepEqual(
    Object.keys(cjs).sort(),
    [
      'Scheduler',
      'addDays',
      'assertDate',
      'layoutEvents',
      'moveEvent',
      'startOfDay',
      'validateEvents',
      'visibleDays',
    ].sort(),
  );
});

test('day and week navigation returns fresh local calendar dates', () => {
  const original = date(7, 14);
  const days = visibleDays(original);
  assert.equal(days.length, 7);
  assert.equal(days[0].getDay(), 1);
  assert.equal(days[0].getDate(), 5);
  assert.equal(visibleDays(original, 'day')[0].getHours(), 0);
  assert.equal(visibleDays(original, 'week', 0)[0].getDay(), 0);
  assert.equal(addDays(original, -7).getMonth(), 8);
  assert.equal(original.getDate(), 7);
  assert.notEqual(startOfDay(original), original);
});

test('dates, views, week boundaries, events and unique IDs are validated', () => {
  assert.throws(() => assertDate(new Date(NaN)), RangeError);
  assert.throws(() => startOfDay('2026-10-05'), RangeError);
  assert.throws(() => addDays(date(), 1.5), RangeError);
  assert.throws(() => visibleDays(date(), 'month'), RangeError);
  assert.throws(() => visibleDays(date(), 'week', 7), RangeError);
  assert.throws(() => validateEvents([event('x', 10, 9)]), RangeError);
  assert.throws(() => validateEvents([event('x', 9, 10), event('x', 11, 12)]), RangeError);
  assert.throws(() => validateEvents([{ ...event('x', 9, 10), start: new Date(NaN) }]), RangeError);
});

test('overlap groups get stable separate columns and adjacent events reuse full width', () => {
  const result = layoutEvents(
    [event('a', 9, 11), event('b', 10, 12), event('c', 10, 11), event('d', 12, 13)],
    date(),
  );
  const byId = Object.fromEntries(result.map((entry) => [entry.event.id, entry]));
  assert.equal(byId.a.columns, 3);
  assert.equal(new Set([byId.a.column, byId.b.column, byId.c.column]).size, 3);
  assert.equal(byId.d.columns, 1);
  assert.equal(byId.d.column, 0);
});

test('multi-day events clip to each local day and exclude exact boundary endings', () => {
  const overnight = { id: 'overnight', title: 'Night', start: date(4, 23), end: date(6, 2) };
  const middle = layoutEvents([overnight], date());
  assert.equal(middle[0].startMinute, 0);
  assert.equal(middle[0].endMinute, 1440);
  assert.equal(layoutEvents([overnight], date(6))[0].endMinute, 120);
  assert.equal(layoutEvents([overnight], date(7)).length, 0);
  assert.equal(layoutEvents([event('x', 0, 1)], date(4)).length, 0);
});

test('moveEvent preserves elapsed duration and does not mutate input dates', () => {
  const original = event('x', 9, 10);
  const moved = moveEvent(original, date(8, 15, 30));
  assert.equal(moved.end - moved.start, 3600000);
  assert.equal(moved.start.getDate(), 8);
  assert.equal(original.start.getDate(), 5);
  assert.notEqual(moved.start, original.start);
});
