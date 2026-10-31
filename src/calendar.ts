export interface SchedulerEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  disabled?: boolean;
}

export interface EventLayout {
  event: SchedulerEvent;
  startMinute: number;
  endMinute: number;
  column: number;
  columns: number;
}

export function assertDate(value: Date, name = 'date'): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new RangeError(`${name} must be a valid Date`);
  }
}

export function startOfDay(date: Date): Date {
  assertDate(date);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, amount: number): Date {
  assertDate(date);
  if (!Number.isInteger(amount)) throw new RangeError('amount must be an integer');
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  assertDate(result, 'result');
  return result;
}

export function visibleDays(date: Date, view: 'day' | 'week' = 'week', weekStartsOn = 1): Date[] {
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new RangeError('weekStartsOn must be an integer from 0 to 6');
  }
  if (view !== 'day' && view !== 'week') throw new RangeError('Invalid view');
  const start = startOfDay(date);
  if (view === 'week') {
    start.setDate(start.getDate() - ((start.getDay() - weekStartsOn + 7) % 7));
  }
  return Array.from({ length: view === 'day' ? 1 : 7 }, (_, index) => addDays(start, index));
}

export function validateEvents(events: readonly SchedulerEvent[]): void {
  const ids = new Set<string>();
  for (const event of events) {
    if (typeof event.id !== 'string' || !event.id || ids.has(event.id)) {
      throw new RangeError('Event IDs must be nonempty and unique');
    }
    ids.add(event.id);
    if (typeof event.title !== 'string') throw new TypeError('Event title must be a string');
    assertDate(event.start, 'event.start');
    assertDate(event.end, 'event.end');
    if (event.end <= event.start) throw new RangeError('Event end must follow start');
  }
}

function wallMinute(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/** Clip to one local calendar day, then assign columns within overlap groups. */
export function layoutEvents(events: readonly SchedulerEvent[], date: Date): EventLayout[] {
  validateEvents(events);
  const start = startOfDay(date);
  const end = addDays(start, 1);
  const entries = events
    .filter((event) => event.start < end && event.end > start)
    .map((event): EventLayout => {
      const startMinute = event.start < start ? 0 : wallMinute(event.start);
      const projectedEnd = event.end >= end ? 1440 : wallMinute(event.end);
      return {
        event,
        startMinute,
        // Repeated local clock times cannot express elapsed duration in this grid.
        endMinute: Math.min(1440, Math.max(startMinute + 1, projectedEnd)),
        column: 0,
        columns: 1,
      };
    })
    .sort(
      (a, b) =>
        a.startMinute - b.startMinute ||
        b.endMinute - a.endMinute ||
        a.event.id.localeCompare(b.event.id),
    );
  let group: EventLayout[] = [];
  let ends: number[] = [];
  let groupEnd = -1;
  const finish = () => {
    for (const entry of group) entry.columns = ends.length;
    group = [];
    ends = [];
  };
  for (const entry of entries) {
    if (entry.startMinute >= groupEnd) finish();
    let column = ends.findIndex((endMinute) => endMinute <= entry.startMinute);
    if (column === -1) column = ends.length;
    ends[column] = entry.endMinute;
    entry.column = column;
    group.push(entry);
    groupEnd = Math.max(group.length === 1 ? -1 : groupEnd, entry.endMinute);
  }
  finish();
  return entries;
}

export function moveEvent(event: SchedulerEvent, start: Date): SchedulerEvent {
  validateEvents([event]);
  assertDate(start, 'start');
  const end = new Date(start.getTime() + event.end.getTime() - event.start.getTime());
  assertDate(end, 'end');
  return { ...event, start: new Date(start), end };
}
