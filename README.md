# @lp-labs/react-scheduler

Package version: `1.0.0`.

A controlled React day/week calendar with local-time event layout, overlap lanes,
navigation, slot selection, native mouse drag/drop, and keyboard move/resize
proposals. React 18.2 or 19 is the only runtime peer; there are no runtime
dependencies. ESM, CommonJS, TypeScript declarations, and optional CSS are included.

## Use

```sh
npm install @lp-labs/react-scheduler react
```

```tsx
import { useState } from "react";
import { Scheduler, type SchedulerEvent } from "@lp-labs/react-scheduler";
import "@lp-labs/react-scheduler/styles.css";

export function Calendar() {
  const [date, setDate] = useState(new Date(2026, 9, 5));
  const [view, setView] = useState<"day" | "week">("week");
  const [events, setEvents] = useState<SchedulerEvent[]>([
    {
      id: "planning",
      title: "Planning",
      start: new Date(2026, 9, 5, 9),
      end: new Date(2026, 9, 5, 10)
    }
  ]);
  return (
    <Scheduler
      date={date}
      onDateChange={setDate}
      view={view}
      onViewChange={setView}
      events={events}
      startHour={8}
      endHour={18}
      onSlotClick={(start) => {
        setEvents((items) => [...items, {
          id: crypto.randomUUID(),
          title: "New event",
          start,
          end: new Date(start.getTime() + 30 * 60_000)
        }]);
      }}
      onEventClick={(event) => {
        // Open your own title/details editor, then update events.
        console.log(event.id);
      }}
      onEventChange={(next) => {
        setEvents((items) => items.map((item) => item.id === next.id ? next : item));
      }}
    />
  );
}
```

All changes are proposals: the component never changes your event collection or
date. Persist, reject, authorize, or confirm proposals in callbacks. Pass the
accepted state back to the component. To edit a title or other application data,
open your own editor from `onEventClick`; a details editor is not bundled.

## Data and time policy

`SchedulerEvent` has `id: string`, `title: string`, `start: Date`, `end: Date`,
and optional `disabled: boolean` (default false). IDs must be nonempty and unique;
dates must be valid and end must be strictly after start. Inputs are never mutated.
Extra application fields can be stored in a separate map keyed by ID.

**The calendar uses the browser's local timezone only.** Dates represent actual
instants, but rows use local wall-clock hours in a nominal 24-hour grid.
`addDays` and day/week navigation use local calendar-date arithmetic. A calendar
day is not assumed to be 86,400,000 elapsed milliseconds. Dragging to a slot
constructs its local wall-clock time and preserves the event's elapsed duration.
Keyboard move/resize changes elapsed milliseconds.

This is not a timezone conversion or DST-aware scheduling engine. JavaScript
normalizes nonexistent local clock times during spring-forward; fall-back repeated
times share a row. An event whose projected local end precedes or equals its
projected start receives a one-minute visual footprint. Repeated instants cannot
be independently addressed through the same slot. Do not use wall-clock geometry
as a source of elapsed duration. For named-zone, recurrence, or disambiguated
appointments, normalize/validate in your application or use another calendar model.

Multi-day events are clipped and repeated in each visible day, not rendered in
a separate all-day lane. Touch drag, recurrence, resources and virtualization are
not implemented.

## Scheduler props

The exported interface is `SchedulerProps`; all callbacks below return void,
except `renderEvent(event: SchedulerEvent): ReactNode`.

| Prop | Default | Contract |
| --- | --- | --- |
| `events` | required | Readonly array of `SchedulerEvent`. |
| `date` | required | Valid `Date` anchoring the visible day/week. |
| `onDateChange(date)` | required | Previous/next moves 1 or 7 calendar days; Today proposes the current instant. |
| `view` | `"week"` | `"day"` or `"week"`. |
| `weekStartsOn` | `1` | Integer 0 (Sunday) through 6 (Saturday). |
| `onViewChange(view)` | absent | If present, displays the controlled view select. |
| `startHour`, `endHour` | `0`, `24` | Integers satisfying `0 <= startHour < endHour <= 24`. |
| `stepMinutes` | `30` | Positive integer divisor of 60, at most 60. Slot and keyboard increment. |
| `height` | `720` | Positive finite grid height per day in pixels, excluding heading. |
| `locale` | browser default | Locale passed to `Intl.DateTimeFormat` for dates/times. |
| `onSlotClick(start)` | absent | Fresh local slot date; consumer can create an event. |
| `onEventClick(event)` | absent | Selected original event; consumer can show/edit details. |
| `onEventChange(next, context)` | absent | Enables move/resize proposals; context is `{previous, reason: "move" \| "resize"}`. |
| `renderEvent(event)` | title text | Return noninteractive React content for the event button. |
| `className`, `style` | `""`, absent | Additional section class and React inline style. |
| `aria-label` | `"Scheduler"` | Accessible section name. |

With an event focused, Up/Down moves it by one increment. Shift+Up/Down
resizes its end by one increment; a resize that would make end <= start is
ignored. Native drag/drop moves an event to a slot. Disabled events do not
activate and cannot be dragged. Events outside displayed hours are clipped or
omitted. Overlap groups are assigned equal-width lanes; adjacent events do not
overlap. A connected overlap group retains its maximum lane count throughout
the group rather than expanding into temporarily empty lanes.

## Helpers

All helpers are named exports and work without mounting React.

* `assertDate(value: Date, name = "date"): void` throws `RangeError` for an invalid
  or non-Date value.
* `startOfDay(date): Date` returns a new local midnight date.
* `addDays(date, amount): Date` returns a new date with integer local calendar-day
  offset, preserving the local clock subject to JavaScript normalization.
* `visibleDays(date, view = "week", weekStartsOn = 1): Date[]` returns one or seven
  local midnight dates.
* `validateEvents(events): void` checks IDs, dates and positive elapsed durations.
* `layoutEvents(events, date): EventLayout[]` clips events to one local day and
  sorts by start minute, descending end minute, then ID. Each entry has
  `{event, startMinute, endMinute, column, columns}`; columns are zero-based and
  minutes are wall-clock offsets in the nominal grid.
* `moveEvent(event, start): SchedulerEvent` returns a shallow copy with cloned
  start and a new end preserving elapsed duration.

Invalid dates, event ranges, duplicate IDs, view/week values, hours, step, or
height throw `RangeError`; invalid locale values can produce native `Intl`
errors. Non-string event titles throw `TypeError`. Catch rendering errors in a React error boundary. Callbacks are
synchronous; exceptions are the application's responsibility.

`SchedulerEvent` and `EventLayout` are type-only exports; `EventLayout.event`
is a `SchedulerEvent`, and its four geometry/lane fields are numbers.
`startOfDay`, `visibleDays`, and `layoutEvents` take a `Date`; event collections
are readonly `SchedulerEvent[]`. `moveEvent` takes one `SchedulerEvent` and a
new start `Date`. There is no default export.

```ts
import { visibleDays, layoutEvents, moveEvent } from "@lp-labs/react-scheduler";
import type { SchedulerEvent } from "@lp-labs/react-scheduler";

const event: SchedulerEvent = {
  id: "meeting", title: "Meeting",
  start: new Date(2026, 9, 5, 9), end: new Date(2026, 9, 5, 10)
};
const date = new Date(2026, 9, 5);
console.log(visibleDays(date, "day"), layoutEvents([event], date));
console.log(moveEvent(event, new Date(2026, 9, 5, 11)));
```

No background clock, worker, remote subscription, persistence, or cancellation
API is installed. Parent applications own loading/saving and event authorization.
Import does not read browser globals. Use a DOM-capable React renderer and DOM
TypeScript declarations for the UI, not Node ambient types. Layout validates and
sorts visible events and renders every slot/event; reduce data ranges before
rendering when event counts are high. No scheduling latency guarantee is made.

## Styling and accessibility

Import the CSS export or supply your own. Stable classes are `lp-scheduler`,
`lp-scheduler__toolbar`, `__days`, `__day`, `__slot`, and `__event` (the latter
names all include the `lp-scheduler` prefix). Essential grid and event geometry
is inline; customize colors, fonts, borders and focus outlines through CSS.

```css
.my-calendar .lp-scheduler__event { background: #6d28d9; }
.my-calendar .lp-scheduler__slot { background: #fafafa; }
```

Set `className="my-calendar"`. Event renderers are inside a button: do not nest
buttons, links, or form controls. Slots and events are native labeled buttons;
navigation and the optional view select are keyboard accessible. There is no
ARIA grid/roving focus implementation: every slot is a tab stop, which can be
verbose for a full week. Screen readers receive event titles and formatted
times; no live announcement of accepted changes is provided. Add an application
live region if needed. Localized date labels do not localize navigation text.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
