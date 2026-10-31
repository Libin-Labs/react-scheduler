import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
]) {
  globalThis[name] = dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = React;
const { Scheduler } = await import('../dist/esm/index.js');
const h = React.createElement;
const date = (hour = 0) => new Date(2026, 9, 5, hour);
const meeting = { id: 'meeting', title: 'Planning', start: date(9), end: date(10) };

async function mount(props) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      h(Scheduler, {
        events: [meeting],
        date: date(),
        onDateChange() {},
        view: 'day',
        startHour: 8,
        endHour: 12,
        ...props,
      }),
    ),
  );
  return {
    container,
    async close() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

test('navigation, view switching, slot creation and event edit callbacks', async () => {
  const dates = [];
  const views = [];
  const slots = [];
  const clicks = [];
  const app = await mount({
    onDateChange: (value) => dates.push(value),
    onViewChange: (value) => views.push(value),
    onSlotClick: (value) => slots.push(value),
    onEventClick: (value) => clicks.push(value),
  });
  try {
    await act(async () => {
      app.container.querySelector('[aria-label="Next period"]').click();
      app.container.querySelector('[aria-label="Previous period"]').click();
      app.container.querySelector('.lp-scheduler__slot').click();
      app.container.querySelector('.lp-scheduler__event').click();
      const select = app.container.querySelector('select');
      select.value = 'week';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.deepEqual(
      dates.map((item) => item.getDate()),
      [6, 4],
    );
    assert.deepEqual(views, ['week']);
    assert.equal(slots[0].getHours(), 8);
    assert.equal(clicks[0], meeting);
    assert.equal(app.container.querySelectorAll('.lp-scheduler__slot').length, 8);
  } finally {
    await app.close();
  }
});

test('keyboard movement and resizing are controlled proposals', async () => {
  const changes = [];
  const app = await mount({ onEventChange: (...args) => changes.push(args) });
  try {
    const button = app.container.querySelector('.lp-scheduler__event');
    await act(async () => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      button.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }),
      );
    });
    assert.equal(changes.length, 2);
    assert.equal(changes[0][0].start.getMinutes(), 30);
    assert.equal(changes[0][1].reason, 'move');
    assert.equal(changes[1][0].end.getHours(), 9);
    assert.equal(changes[1][0].end.getMinutes(), 30);
    assert.equal(changes[1][1].reason, 'resize');
    assert.equal(meeting.start.getHours(), 9);
    assert.equal(changes[0][1].previous, meeting);
  } finally {
    await app.close();
  }
});

test('native drag and drop requests a reschedule preserving duration', async () => {
  const changes = [];
  const app = await mount({ onEventChange: (value) => changes.push(value) });
  try {
    const button = app.container.querySelector('.lp-scheduler__event');
    const drag = new Event('dragstart', { bubbles: true });
    Object.defineProperty(drag, 'dataTransfer', {
      value: { setData() {}, effectAllowed: '' },
    });
    await act(async () => {
      button.dispatchEvent(drag);
      app.container
        .querySelector('.lp-scheduler__slot')
        .dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    });
    assert.equal(changes[0].start.getHours(), 8);
    assert.equal(changes[0].end.getHours(), 9);
  } finally {
    await app.close();
  }
});

test('overlapping events render separate lanes and disabled events cannot edit', async () => {
  const changes = [];
  const app = await mount({
    events: [
      meeting,
      {
        ...meeting,
        id: 'other',
        title: 'Other',
        disabled: true,
      },
    ],
    onEventChange: (value) => changes.push(value),
  });
  try {
    const buttons = app.container.querySelectorAll('.lp-scheduler__event');
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].style.width, '50%');
    assert.equal(buttons[1].style.left, '50%');
    assert.equal(buttons[1].disabled, true);
    assert.equal(buttons[1].draggable, false);
    assert.equal(changes.length, 0);
  } finally {
    await app.close();
  }
});
