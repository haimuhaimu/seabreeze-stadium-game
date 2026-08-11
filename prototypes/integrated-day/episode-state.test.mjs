import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEpisodeState,
  acknowledgeNotice,
  choosePromises,
  completePromise,
  lockMissedRequest,
  resolveFridayFunding,
  recordEpisodeMatchChoice,
  resolveXiaomanDecision,
  acknowledgeShenOffer,
  chooseHearing,
  buildEpisodeConsequence
} from './episode-state.js';

test('the notice is acknowledged without deciding who leaves', () => {
  const start = createEpisodeState();
  const next = acknowledgeNotice(start);
  assert.deepEqual(next.sceneHistory, ['blank-notice']);
  assert.equal(next.xiaomanDecision, null);
  assert.deepEqual(start.sceneHistory, []);
});

test('exactly two different promises can be chosen', () => {
  const start = createEpisodeState();
  assert.throws(() => choosePromises(start, ['train']), /two promises/i);
  assert.throws(() => choosePromises(start, ['train', 'train']), /two promises/i);
  const chosen = choosePromises(start, ['train', 'records']);
  assert.deepEqual(chosen.promisesChosen, ['train', 'records']);
  assert.deepEqual(start.promisesChosen, []);
});

test('the unchosen request becomes a visible missed request', () => {
  let episode = choosePromises(createEpisodeState(), ['train', 'records']);
  episode = completePromise(episode, 'train');
  episode = completePromise(episode, 'records');
  episode = lockMissedRequest(episode);
  assert.equal(episode.missedRequest, 'fundraise');
  assert.equal(episode.xiaomanTrust, 2);
  assert.equal(episode.truthKnown, true);
});

test('public fundraising earns more but costs trust', () => {
  let episode = choosePromises(createEpisodeState(), ['train', 'fundraise']);
  episode = completePromise(episode, 'fundraise', { fundraisingMode: 'public' });
  assert.equal(episode.fundraisingTotal, 48);
  assert.equal(episode.xiaomanTrust, -1);
});

test('paying both is unlocked only by the public fundraiser total', () => {
  let privateEpisode = choosePromises(createEpisodeState(), ['fundraise', 'records']);
  privateEpisode = completePromise(privateEpisode, 'fundraise', { fundraisingMode: 'private' });
  assert.throws(() => resolveFridayFunding(privateEpisode, 'pay-both'), /fundraising target/i);

  let publicEpisode = choosePromises(createEpisodeState(), ['fundraise', 'records']);
  publicEpisode = completePromise(publicEpisode, 'fundraise', { fundraisingMode: 'public' });
  publicEpisode = resolveFridayFunding(publicEpisode, 'pay-both');
  assert.equal(publicEpisode.fridayFundingChoice, 'pay-both');
});

test('xiaoman makes his own decision before the hearing', () => {
  let episode = choosePromises(createEpisodeState(), ['train', 'records']);
  episode = completePromise(episode, 'train');
  episode = recordEpisodeMatchChoice(episode, 'middle', 'ask-xiaoman');
  episode = resolveXiaomanDecision(episode);
  assert.equal(episode.xiaomanDecision, 'stay-trial');
  episode = chooseHearing(episode, 'manager-signs');
  assert.equal(episode.xiaomanDecision, 'stay-trial');
});

test('xiaoman accepts the real job when the week repeatedly removes his agency', () => {
  let episode = choosePromises(createEpisodeState(), ['fundraise', 'records']);
  episode = completePromise(episode, 'fundraise', { fundraisingMode: 'public' });
  episode = recordEpisodeMatchChoice(episode, 'middle', 'replace-xiaoman');
  episode = acknowledgeShenOffer(episode);
  episode = resolveXiaomanDecision(episode);
  assert.equal(episode.xiaomanDecision, 'accept-shen');
});

test('funding and hearing choices create a human-readable consequence', () => {
  let episode = choosePromises(createEpisodeState(), ['fundraise', 'records']);
  episode = completePromise(episode, 'fundraise', { fundraisingMode: 'private' });
  episode = completePromise(episode, 'records');
  episode = lockMissedRequest(episode);
  episode = resolveFridayFunding(episode, 'shen-advance');
  episode = acknowledgeShenOffer(episode);
  episode = resolveXiaomanDecision(episode);
  episode = chooseHearing(episode, 'five-party-week');
  const result = buildEpisodeConsequence(episode, { outcome: 'draw', score: { home: 1, away: 1 } });
  assert.equal(result.shenAdvantage, '取得书面干预权');
  assert.match(result.missedCopy, /陪小满/);
  assert.equal(result.xiaomanDecision, 'stay-trial');
});
