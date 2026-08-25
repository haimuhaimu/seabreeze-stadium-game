import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloneEliteState,
  createEliteState,
  declineEliteInvitation,
  getEliteMatchMoment,
  offerEliteInvitation,
  resolveEliteMatchMoment,
  startEliteMatch
} from './elite-state.js';

const readySnapshot = Object.freeze({ ranking: true, construction: true });

function play(invited, preparationId, choiceIds) {
  let state = startEliteMatch(invited, preparationId, readySnapshot);
  for (const choiceId of choiceIds) state = resolveEliteMatchMoment(state, choiceId);
  return state;
}

test('a fully recalled season beats the elite opponent two to one', () => {
  const empty = createEliteState();
  const invited = offerEliteInvitation(empty, 1);
  assert.equal(empty.status, 'idle');
  assert.equal(invited.status, 'invited');
  let match = startEliteMatch(invited, 'shared-plan', readySnapshot);
  assert.equal(getEliteMatchMoment(match).choices[0].callbackReady, true);
  match = resolveEliteMatchMoment(match, 'use-league-shape');
  assert.deepEqual({ home: match.match.homeGoals, away: match.match.awayGoals }, { home: 1, away: 2 });
  match = resolveEliteMatchMoment(match, 'open-built-route');
  assert.deepEqual({ home: match.match.homeGoals, away: match.match.awayGoals }, { home: 1, away: 1 });
  assert.deepEqual(getEliteMatchMoment(match).choices.map(choice => choice.callbackReady), [true, false, false]);
  const complete = resolveEliteMatchMoment(match, 'follow-shared-plan');
  assert.equal(complete.status, 'complete');
  assert.deepEqual({ home: complete.result.homeGoals, away: complete.result.awayGoals }, { home: 2, away: 1 });
  assert.equal(complete.result.id, 'champion');
  assert.equal(complete.bestResultId, 'champion');
  assert.equal(complete.history.length, 1);
  assert.equal(invited.history.length, 0);
});

test('missing one callback draws and missing two loses without randomness', () => {
  const invited = offerEliteInvitation(createEliteState(), 2);
  const draw = play(invited, 'shared-plan', [
    'use-league-shape', 'open-built-route', 'use-repair-buffer'
  ]);
  assert.deepEqual({ id: draw.result.id, home: draw.result.homeGoals, away: draw.result.awayGoals }, {
    id: 'recognized', home: 1, away: 1
  });
  const loss = play(invited, 'open-gates', [
    'rush-the-middle', 'close-the-stand', 'follow-shared-plan'
  ]);
  assert.deepEqual({ id: loss.result.id, home: loss.result.homeGoals, away: loss.result.awayGoals }, {
    id: 'attended', home: 0, away: 2
  });
});

test('elite invitations validate their lifecycle and ids', () => {
  const empty = createEliteState();
  assert.throws(() => startEliteMatch(empty, 'shared-plan', readySnapshot), /invitation/i);
  const invited = offerEliteInvitation(empty, 1);
  assert.throws(() => offerEliteInvitation(invited, 1), /already active/i);
  assert.throws(() => startEliteMatch(invited, 'missing', readySnapshot), /Unknown elite preparation/);
  assert.throws(() => startEliteMatch(invited, 'shared-plan', { ranking: true }), /snapshot/i);
  const match = startEliteMatch(invited, 'repair-buffer', readySnapshot);
  assert.throws(() => resolveEliteMatchMoment(match, 'missing'), /choice/i);
  assert.throws(() => declineEliteInvitation(match), /match is active/i);
  const complete = ['use-league-shape', 'open-built-route', 'use-repair-buffer']
    .reduce((state, choiceId) => resolveEliteMatchMoment(state, choiceId), match);
  assert.throws(() => resolveEliteMatchMoment(complete, 'follow-shared-plan'), /No active elite match/i);
});

test('declining or closing an invitation keeps permanent history and best result', () => {
  const complete = play(offerEliteInvitation(createEliteState(), 3), 'open-gates', [
    'use-league-shape', 'open-built-route', 'call-open-gates'
  ]);
  const reset = declineEliteInvitation(complete);
  assert.equal(reset.status, 'idle');
  assert.equal(reset.result, null);
  assert.equal(reset.match, null);
  assert.equal(reset.invitedSeasonNumber, null);
  assert.equal(reset.history.length, 1);
  assert.equal(reset.bestResultId, 'champion');
  const clonedLegacy = cloneEliteState(undefined);
  assert.deepEqual(clonedLegacy, createEliteState());
});
