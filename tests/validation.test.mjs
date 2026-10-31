import test from 'node:test';
import assert from 'node:assert/strict';
import { Scheduler } from '../dist/esm/index.js';

test('component rejects invalid hours, step, height and event data before mounting', () => {
  const props = { events: [], date: new Date(), onDateChange() {} };
  for (const invalid of [
    { startHour: -1 },
    { startHour: 12, endHour: 10 },
    { endHour: 25 },
    { stepMinutes: 7 },
    { stepMinutes: 0 },
    { height: Infinity },
    { height: 0 },
    { date: new Date(NaN) },
  ]) {
    assert.throws(() => Scheduler({ ...props, ...invalid }), RangeError);
  }
});
