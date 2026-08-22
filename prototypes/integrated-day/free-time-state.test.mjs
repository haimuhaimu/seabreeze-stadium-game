import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTakeFreeAction,
  createFreeTimeState,
  finishFreeAction,
  getFreeActionTotals,
  startFreeAction
} from './free-time-state.js';

test('one action per eligible day produces a persistent reward', () => {
  let state = createFreeTimeState();
  assert.equal(canTakeFreeAction(state, 11), true);
  state = startFreeAction(state, 11, 'shop');
  state = finishFreeAction(state, { score: 1 });
  assert.equal(state.records[0].fund, 22);
  assert.equal(state.records[0].signatures, 2);
  assert.equal(canTakeFreeAction(state, 11), false);
});

test('a low activity score keeps the story moving with a smaller reward', () => {
  let state = startFreeAction(createFreeTimeState(), 12, 'repair');
  state = finishFreeAction(state, { score: 0 });
  assert.equal(state.records[0].facility, 3);
  assert.equal(state.records[0].quality, 0.5);
});

test('repeating an action on consecutive days softens the second reward', () => {
  let state = finishFreeAction(startFreeAction(createFreeTimeState(), 11, 'community'), { score: 1 });
  state = finishFreeAction(startFreeAction(state, 12, 'community'), { score: 1 });
  assert.equal(state.records[1].repeated, true);
  assert.equal(state.records[0].community, 5);
  assert.equal(state.records[1].community, 4);
});

test('rest records recovery without creating campaign resources', () => {
  const state = finishFreeAction(startFreeAction(createFreeTimeState(), 13, 'rest'), { score: 1 });
  assert.deepEqual(getFreeActionTotals(state), {
    fund: 0,
    community: 0,
    cohesion: 0,
    facility: 0,
    signatures: 0,
    evidence: 0
  });
  assert.equal(state.records[0].actionId, 'rest');
});

test('archive evidence and numeric rewards aggregate across different days', () => {
  let state = finishFreeAction(startFreeAction(createFreeTimeState(), 11, 'shop'), { score: 1 });
  state = finishFreeAction(startFreeAction(state, 12, 'community'), { score: 1 });
  state = finishFreeAction(startFreeAction(state, 13, 'archive'), { score: 1 });
  assert.deepEqual(getFreeActionTotals(state), {
    fund: 30,
    community: 8,
    cohesion: 1,
    facility: 0,
    signatures: 10,
    evidence: 1
  });
});

test('ineligible days, duplicate days, and interrupted starts are rejected', () => {
  const fresh = createFreeTimeState();
  assert.equal(canTakeFreeAction(fresh, 10), false);
  assert.throws(() => startFreeAction(fresh, 10, 'shop'), /unavailable/i);
  assert.throws(() => startFreeAction(fresh, 11, 'missing'), /unknown free action/i);

  const active = startFreeAction(fresh, 11, 'shop');
  assert.throws(() => startFreeAction(active, 12, 'repair'), /already active/i);
  assert.throws(() => finishFreeAction(fresh, { score: 1 }), /no active/i);
});
