import test from 'node:test';
import assert from 'node:assert/strict';

import { planFocus } from '../focus-policy.js';

const screen = (name, confirm = false) => ({ screen: name, confirm });

test('the first render and any genuine screen or step change move focus to the screen target', () => {
  assert.deepEqual(planFocus({ previous: null, next: screen('home') }), { type: 'screen' });
  assert.deepEqual(
    planFocus({ previous: screen('learn:0:reveal'), next: screen('learn:0:retrieve'), activeKey: 'family-ea', availableKeys: ['family-ea'] }),
    { type: 'screen' },
  );
});

test('a same-screen re-render keeps the focused control instead of jumping to the first autofocus', () => {
  const plan = planFocus({
    previous: screen('learn:0:reveal'),
    next: screen('learn:0:reveal'),
    activeKey: 'family-ea',
    availableKeys: ['family-ea', 'family-ee'],
  });

  assert.deepEqual(plan, { type: 'restore', key: 'family-ea' });
});

test('opening the reset confirmation moves focus into it and closing it returns to the reset control', () => {
  const base = { activeKey: 'reset-open', availableKeys: ['reset-open'] };

  assert.deepEqual(planFocus({ previous: screen('home', false), next: screen('home', true), ...base }), { type: 'confirm-open' });
  assert.deepEqual(planFocus({ previous: screen('home', true), next: screen('home', false), ...base }), { type: 'confirm-close' });
});

test('ordinary feedback re-renders leave focus alone when nothing focused can be restored', () => {
  assert.deepEqual(planFocus({ previous: screen('practice:0:first'), next: screen('practice:0:first') }), { type: 'none' });
  assert.deepEqual(
    planFocus({ previous: screen('practice:0:first'), next: screen('practice:0:first'), activeKey: 'gone', availableKeys: ['answer'] }),
    { type: 'none' },
  );
});

test('a screen change wins over a confirmation change', () => {
  assert.deepEqual(planFocus({ previous: screen('home', true), next: screen('results', false) }), { type: 'screen' });
});
