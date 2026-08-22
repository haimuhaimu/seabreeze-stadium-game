import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseNamingResponse,
  chooseNamingVote,
  completeNamingScene,
  createNamingRightsState,
  getAvailableVoteRoutes,
  getNamingMatchMoment,
  resolveNamingHighlight,
  settleNamingWeek,
  startNamingMatch
} from './naming-rights-state.js';
import { finishFreeAction, startFreeAction } from './free-time-state.js';

function withAction(state, dayIndex, actionId, score = 1) {
  return {
    ...state,
    freeTime: finishFreeAction(startFreeAction(state.freeTime, dayIndex, actionId), { score })
  };
}

function readyForVote() {
  let state = createNamingRightsState();
  state = withAction(state, 11, 'shop');
  state = withAction(state, 12, 'community');
  state = withAction(state, 13, 'shop');
  return state;
}

function playMatch(state, choiceIds) {
  let next = startNamingMatch(state);
  for (const choiceId of choiceIds) next = resolveNamingHighlight(next, choiceId);
  return next;
}

test('community save unlocks only after visible local support', () => {
  const fresh = createNamingRightsState();
  const locked = getAvailableVoteRoutes(fresh).find(route => route.id === 'community-save');
  assert.equal(locked.disabled, true);
  assert.equal(locked.missingFund, 45);
  assert.equal(locked.missingSignatures, 10);
  assert.throws(() => chooseNamingVote(fresh, 'community-save'), /not unlocked/i);

  const supported = readyForVote();
  const unlocked = getAvailableVoteRoutes(supported).find(route => route.id === 'community-save');
  assert.equal(unlocked.disabled, false);
  assert.equal(unlocked.missingFund, 0);
  assert.equal(unlocked.missingSignatures, 0);
});

test('story scenes are recorded once without mutating the prior state', () => {
  const fresh = createNamingRightsState();
  const next = completeNamingScene(fresh, 'blue-banner');
  assert.deepEqual(fresh.sceneHistory, []);
  assert.deepEqual(next.sceneHistory, ['blue-banner']);
  assert.equal(completeNamingScene(next, 'blue-banner'), next);
  assert.throws(() => completeNamingScene(fresh, 'missing'), /unknown naming scene/i);
});

test('all three vote routes remain playable and produce different authority', () => {
  const supported = readyForVote();
  const outcomes = {
    'co-name': ['澜岸·海风球场', '赞助方获得一个运营否决席位'],
    'community-save': ['海风球场', '五把椅子保留最终决定权'],
    delay: ['海风球场', '临时委员会只保住了本周']
  };

  for (const [routeId, [stadiumName, authority]] of Object.entries(outcomes)) {
    let state = chooseNamingVote(supported, routeId);
    state = chooseNamingResponse(state, routeId === 'co-name' ? 'name-as-repair' : 'restore-history');
    state = playMatch(state, ['keep-gates-open', 'trust-the-bench', 'let-name-show']);
    const settlement = settleNamingWeek(state);
    assert.equal(settlement.stadiumName, stadiumName);
    assert.equal(settlement.authority, authority);
  }
});

test('the match remembers free-time actions instead of asking for football expertise', () => {
  let state = readyForVote();
  state = chooseNamingVote(state, 'community-save');
  state = chooseNamingResponse(state, 'restore-history');
  state = startNamingMatch(state);

  const crowdMoment = getNamingMatchMoment(state);
  assert.equal(crowdMoment.id, 'wind-crowd');
  assert.equal(crowdMoment.choices.find(choice => choice.id === 'keep-gates-open').callbackReady, true);
  state = resolveNamingHighlight(state, 'keep-gates-open');

  const benchMoment = getNamingMatchMoment(state);
  assert.equal(benchMoment.id, 'hesitant-substitute');
  assert.equal(benchMoment.choices.find(choice => choice.id === 'trust-the-bench').callbackReady, false);
  state = resolveNamingHighlight(state, 'steady-everyone');

  const signMoment = getNamingMatchMoment(state);
  assert.equal(signMoment.id, 'tearing-banner');
  state = resolveNamingHighlight(state, 'let-name-show');
  assert.equal(state.match.complete, true);
  assert.deepEqual(state.match.choices, ['keep-gates-open', 'steady-everyone', 'let-name-show']);
});

test('resting and a low score never block vote, response, match, or settlement', () => {
  let state = createNamingRightsState();
  state = withAction(state, 11, 'rest', 0);
  state = chooseNamingVote(state, 'delay');
  state = chooseNamingResponse(state, 'after-match');
  state = playMatch(state, ['move-under-roof', 'steady-everyone', 'tie-blue-cloth']);
  const settlement = settleNamingWeek(state);
  assert.ok(Number.isInteger(settlement.score.home));
  assert.ok(Number.isInteger(settlement.score.away));
  assert.equal(settlement.route, 'delay');
});

test('invalid vote, response, highlight, and early settlement are rejected', () => {
  const fresh = createNamingRightsState();
  assert.throws(() => chooseNamingVote(fresh, 'missing'), /unknown vote route/i);
  assert.throws(() => chooseNamingResponse(fresh, 'restore-history'), /vote first/i);
  assert.throws(() => startNamingMatch(fresh), /vote and respond/i);

  let state = chooseNamingResponse(chooseNamingVote(fresh, 'delay'), 'after-match');
  assert.throws(() => settleNamingWeek(state), /three match moments/i);
  state = startNamingMatch(state);
  assert.throws(() => resolveNamingHighlight(state, 'missing'), /invalid match choice/i);
});
