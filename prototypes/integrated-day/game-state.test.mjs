import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrders } from './daily-content.js';
import {
  createGameState,
  createFirstWeekEntryState,
  collectItem,
  talkToCoach,
  startTraining,
  finishTraining,
  openShop,
  serveOrder,
  buyRepair,
  chooseSaveMoney,
  finishDay,
  advanceDay,
  beginManagementWeek,
  acknowledgeEpisodeNotice,
  chooseEpisodePromises,
  completeEpisodePromise,
  resolveEpisodeFunding,
  acknowledgeEpisodeOffer,
  startWeeklyMatch,
  chooseMatchHighlight,
  completeEpisodeHearing,
  finishManagementDay,
  advanceCampaignDay
} from './game-state.js';

test('a direct entry starts at the visible management week without erasing prologue history', () => {
  const state = createFirstWeekEntryState();
  assert.equal(state.dayIndex, 3);
  assert.equal(state.phase, 'morning');
  assert.equal(state.world.mapId, 'stadium');
  assert.equal(state.history.length, 3);
  assert.deepEqual(state.repairs, ['awning', 'net']);
  assert.equal(state.relationship.coachMet, true);
  assert.equal(state.economy.cash, 107);
});

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

function completedPrologue() {
  return {
    ...createGameState(),
    dayIndex: 2,
    phase: 'complete',
    chapterComplete: true,
    money: 100
  };
}

function finishAndAdvance(state) {
  const finished = finishManagementDay(state);
  assert.equal(finished.phase, 'complete');
  return advanceCampaignDay(finished);
}

function reachFriday(promiseIds = ['train', 'records'], fundraisingMode = 'private') {
  let state = beginManagementWeek(completedPrologue());
  state = acknowledgeEpisodeNotice(state);
  state = finishAndAdvance(state);
  state = chooseEpisodePromises(state, promiseIds);
  state = finishAndAdvance(state);
  state = completeEpisodePromise(state, promiseIds[0], promiseIds[0] === 'fundraise' ? { fundraisingMode } : {});
  state = finishAndAdvance(state);
  state = completeEpisodePromise(state, promiseIds[1], promiseIds[1] === 'fundraise' ? { fundraisingMode } : {});
  return finishAndAdvance(state);
}

function reachSundayReadyState(promiseIds = ['train', 'records'], funding = 'protect-work') {
  let state = reachFriday(promiseIds);
  state = resolveEpisodeFunding(state, funding);
  state = finishAndAdvance(state);
  state = acknowledgeEpisodeOffer(state);
  return finishAndAdvance(state);
}

test('the management week advances only after the required story action', () => {
  let state = beginManagementWeek(completedPrologue());
  assert.equal(state.dayIndex, 3);
  const blocked = finishManagementDay(state);
  assert.equal(blocked.phase, 'morning');
  state = acknowledgeEpisodeNotice(state);
  state = finishManagementDay(state);
  state = advanceCampaignDay(state);
  assert.equal(state.dayIndex, 4);
});

test('the first week starts with a fixed opponent and blank notice', () => {
  const state = beginManagementWeek(completedPrologue());
  assert.equal(state.version, 3);
  assert.equal(state.management.opponentId, 'city-university');
  assert.equal(state.episode.sceneId, 'blank-notice');
});

test('two promise days can be completed in either order', () => {
  const state = reachFriday(['records', 'train']);
  assert.deepEqual(state.episode.promisesCompleted, ['records', 'train']);
  assert.equal(state.episode.truthKnown, true);
  assert.equal(state.episode.xiaomanTrust, 2);
});

test('friday locks the missed request and maps funding into long-term state', () => {
  let state = reachFriday(['train', 'fundraise'], 'public');
  const communityBefore = state.communitySupport;
  state = resolveEpisodeFunding(state, 'pay-both');
  assert.equal(state.episode.missedRequest, 'records');
  assert.equal(state.management.shortfallPending, false);
  assert.ok(state.communitySupport >= communityBefore);
  assert.equal(state.facilities.prepared, 'floodlights');
});

test('sunday requires the hearing after three highlights', () => {
  let state = reachSundayReadyState();
  state = startWeeklyMatch(state);
  state = chooseMatchHighlight(state, 'repeat-practice');
  state = chooseMatchHighlight(state, 'ask-xiaoman');
  state = chooseMatchHighlight(state, 'share-responsibility');
  assert.equal(state.management.weekComplete, false);
  assert.ok(state.episode.xiaomanDecision);
  state = completeEpisodeHearing(state, 'five-party-week');
  assert.equal(state.management.weekComplete, true);
  assert.ok(state.management.settlement);
  assert.equal(state.management.settlement.character.xiaomanDecision, state.episode.xiaomanDecision);
  assert.deepEqual(state.management.matchResult.score, { home: 2, away: 1 });
});
