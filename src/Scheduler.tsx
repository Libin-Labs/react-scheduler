import { useId, useRef, type CSSProperties, type ReactNode } from 'react';
import {
  addDays,
  assertDate,
  layoutEvents,
  moveEvent,
  validateEvents,
  visibleDays,
  type SchedulerEvent,
} from './calendar.js';

export interface SchedulerProps {
  events: readonly SchedulerEvent[];
  date: Date;
  onDateChange: (date: Date) => void;
  view?: 'day' | 'week';
  weekStartsOn?: number;
  startHour?: number;
  endHour?: number;
  stepMinutes?: number;
  height?: number;
  locale?: string;
  onViewChange?: (view: 'day' | 'week') => void;
  onSlotClick?: (start: Date) => void;
  onEventClick?: (event: SchedulerEvent) => void;
  onEventChange?: (
    event: SchedulerEvent,
    context: { previous: SchedulerEvent; reason: 'move' | 'resize' },
  ) => void;
  renderEvent?: (event: SchedulerEvent) => ReactNode;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

export function Scheduler({
  events,
  date,
  onDateChange,
  view = 'week',
  weekStartsOn = 1,
  startHour = 0,
  endHour = 24,
  stepMinutes = 30,
  height = 720,
  locale,
  onViewChange,
  onSlotClick,
  onEventClick,
  onEventChange,
  renderEvent,
  className = '',
  style,
  'aria-label': label = 'Scheduler',
}: SchedulerProps) {
  assertDate(date);
  validateEvents(events);
  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    endHour > 24 ||
    startHour >= endHour
  )
    throw new RangeError('Hours must be integers with 0 <= startHour < endHour <= 24');
  if (
    !Number.isInteger(stepMinutes) ||
    stepMinutes < 1 ||
    stepMinutes > 60 ||
    60 % stepMinutes !== 0
  )
    throw new RangeError('stepMinutes must be a positive divisor of 60');
  if (!Number.isFinite(height) || height <= 0) {
    throw new RangeError('height must be positive');
  }
  const days = visibleDays(date, view, weekStartsOn);
  const dragging = useRef<string | null>(null);
  const titleId = useId();
  const dateFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const minutes = (endHour - startHour) * 60;
  const slots = Array.from(
    { length: minutes / stepMinutes },
    (_, index) => startHour * 60 + index * stepMinutes,
  );
  const propose = (previous: SchedulerEvent, next: SchedulerEvent, reason: 'move' | 'resize') => {
    validateEvents([next]);
    onEventChange?.(next, { previous, reason });
  };
  return (
    <section className={`lp-scheduler ${className}`} style={style} aria-label={label}>
      <header className="lp-scheduler__toolbar">
        <button
          type="button"
          aria-label="Previous period"
          onClick={() => onDateChange(addDays(date, view === 'day' ? -1 : -7))}
        >
          Previous
        </button>
        <button type="button" onClick={() => onDateChange(new Date())}>
          Today
        </button>
        <button
          type="button"
          aria-label="Next period"
          onClick={() => onDateChange(addDays(date, view === 'day' ? 1 : 7))}
        >
          Next
        </button>
        <strong id={titleId}>
          {dateFormat.format(days[0])}
          {days.length > 1 ? ` - ${dateFormat.format(days[days.length - 1])}` : ''}
        </strong>
        {onViewChange && (
          <select
            aria-label="Calendar view"
            value={view}
            onChange={(event) => onViewChange(event.target.value as 'day' | 'week')}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
        )}
      </header>
      <div
        className="lp-scheduler__days"
        aria-labelledby={titleId}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${days.length}, minmax(100px, 1fr))`,
        }}
      >
        {days.map((day) => (
          <div className="lp-scheduler__day" key={day.getTime()}>
            <h3>{dateFormat.format(day)}</h3>
            <div style={{ position: 'relative', height }}>
              {slots.map((minute) => {
                const start = new Date(day);
                start.setMinutes(minute);
                return (
                  <button
                    type="button"
                    className="lp-scheduler__slot"
                    key={minute}
                    aria-label={`Create event ${dateFormat.format(day)} ${timeFormat.format(start)}`}
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: '100%',
                      top: `${((minute - startHour * 60) / minutes) * 100}%`,
                      height: `${(stepMinutes / minutes) * 100}%`,
                    }}
                    onClick={() => onSlotClick?.(new Date(start))}
                    onDragOver={(event) => {
                      if (onEventChange) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const previous = events.find((item) => item.id === dragging.current);
                      dragging.current = null;
                      if (previous && !previous.disabled && onEventChange) {
                        propose(previous, moveEvent(previous, start), 'move');
                      }
                    }}
                  >
                    <span>{timeFormat.format(start)}</span>
                  </button>
                );
              })}
              {layoutEvents(events, day).map((entry) => {
                const top = Math.max(startHour * 60, entry.startMinute);
                const bottom = Math.min(endHour * 60, entry.endMinute);
                if (bottom <= top) return null;
                const event = entry.event;
                return (
                  <button
                    type="button"
                    key={event.id}
                    className="lp-scheduler__event"
                    disabled={event.disabled}
                    draggable={Boolean(onEventChange) && !event.disabled}
                    aria-label={`${event.title}, ${timeFormat.format(event.start)} to ${timeFormat.format(event.end)}`}
                    style={{
                      position: 'absolute',
                      top: `${((top - startHour * 60) / minutes) * 100}%`,
                      height: `${((bottom - top) / minutes) * 100}%`,
                      left: `${(entry.column / entry.columns) * 100}%`,
                      width: `${100 / entry.columns}%`,
                    }}
                    onClick={() => onEventClick?.(event)}
                    onDragStart={(nativeEvent) => {
                      dragging.current = event.id;
                      nativeEvent.dataTransfer.setData('text/plain', event.id);
                      nativeEvent.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      dragging.current = null;
                    }}
                    onKeyDown={(keyEvent) => {
                      if (!onEventChange || !['ArrowUp', 'ArrowDown'].includes(keyEvent.key))
                        return;
                      keyEvent.preventDefault();
                      const delta = (keyEvent.key === 'ArrowUp' ? -1 : 1) * stepMinutes * 60000;
                      if (keyEvent.shiftKey) {
                        const end = new Date(event.end.getTime() + delta);
                        if (end > event.start) propose(event, { ...event, end }, 'resize');
                      } else {
                        propose(
                          event,
                          moveEvent(event, new Date(event.start.getTime() + delta)),
                          'move',
                        );
                      }
                    }}
                  >
                    {renderEvent ? renderEvent(event) : event.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
