import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrders } from './daily-content.js';
import {
  createGameState,
  collectItem,
  talkToCoach,
  startTraining,
  finishTraining,
  openShop,
  serveOrder,
  buyRepair,
  chooseSaveMoney,
  finishDay,
  advanceDay
} from './game-state.js';

function gatherAll(state) {
  for (const itemId of ['tea-a', 'tea-b', 'fruit-a', 'fruit-b']) {
    state = collectItem(state, itemId);
  }
  return state;
}

function serveAllOrders(state) {
  for (const order of getOrders(state.dayIndex)) {
    state = serveOrder(state, order.recipe);
  }
  return state;
}

function reachEvening(state) {
  state = gatherAll(state);
  state = openShop(state);
  return serveAllOrders(state);
}

function completeCurrentDay(state, choice) {
  state = reachEvening(state);
  state = choice === 'save' ? chooseSaveMoney(state) : buyRepair(state, choice);
  return finishDay(state);
}

test('repairs, money, stock, and relationship survive a new day', () => {
  let state = gatherAll(createGameState());
  state = talkToCoach(state);
  state = openShop(state);
  state = serveAllOrders(state);
  state = buyRepair(state, 'awning');
  state = finishDay(state);
  state = advanceDay(state);

  assert.equal(state.dayIndex, 1);
  assert.equal(state.phase, 'morning');
  assert.deepEqual(state.repairs, ['awning']);
  assert.equal(state.money, 20);
  assert.equal(state.relationship.coachMet, true);
  assert.equal(state.energy, 100);
  assert.deepEqual(state.collectedToday, []);
  assert.equal(state.ordersServed, 0);
});

test('training can complete once per available day', () => {
  let state = { ...createGameState(), dayIndex: 1 };
  state = startTraining(state);
  state = finishTraining(state, 5);
  const completed = state;
  state = startTraining(state);

  assert.equal(completed.training.completedToday, true);
  assert.equal(completed.training.lastScore, 5);
  assert.equal(completed.relationship.coachTrust, 1);
  assert.equal(completed.energy, 92);
  assert.equal(state.training.started, false);
  assert.equal(state.relationship.coachTrust, 1);
});

test('saving money is a valid evening choice', () => {
  let state = reachEvening(createGameState());
  state = chooseSaveMoney(state);
  state = finishDay(state);
  assert.equal(state.phase, 'complete');
  assert.equal(state.eveningChoice, 'save');
});

test('the third day ends the chapter with three history entries', () => {
  let state = createGameState();
  for (let day = 0; day < 3; day += 1) {
    state = completeCurrentDay(state, day === 0 ? 'awning' : 'save');
    if (day < 2) state = advanceDay(state);
  }
  state = advanceDay(state);
  assert.equal(state.chapterComplete, true);
  assert.equal(state.history.length, 3);
  assert.equal(state.dayIndex, 2);
});

test('items cannot be collected twice in the same morning', () => {
  let state = createGameState();
  state = collectItem(state, 'tea-a');
  const once = state;
  state = collectItem(state, 'tea-a');

  assert.deepEqual(state.inventory, once.inventory);
  assert.deepEqual(state.collectedToday, ['tea-a']);
  assert.match(state.journal.at(-1).text, /已经收好/);
});

test('wrong orders and unfinished evenings do not spend resources', () => {
  let state = openShop(gatherAll(createGameState()));
  const before = state;
  state = serveOrder(state, 'fruit');
  assert.equal(state.ordersServed, 0);
  assert.equal(state.money, 0);
  assert.deepEqual(state.inventory, before.inventory);

  state = serveAllOrders(state);
  const unfinished = finishDay(state);
  assert.equal(unfinished.phase, 'evening');
  assert.match(unfinished.journal.at(-1).text, /修缮一处|存下/);
});

test('a repaired facility cannot be purchased again on a later day', () => {
  let state = completeCurrentDay(createGameState(), 'awning');
  state = advanceDay(state);
  state = reachEvening(state);
  const before = state;
  state = buyRepair(state, 'awning');

  assert.equal(state.eveningChoice, null);
  assert.equal(state.money, before.money);
  assert.deepEqual(state.repairs, ['awning']);
});
