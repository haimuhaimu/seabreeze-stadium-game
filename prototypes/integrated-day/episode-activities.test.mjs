import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEpisodeActivity,
  takePass,
  serveFundraiser,
  inspectArchiveClue
} from './episode-activities.js';

test('three passes complete even when timing is imperfect', () => {
  let session = createEpisodeActivity('train');
  session = takePass(session, 0.1);
  session = takePass(session, 0.68);
  session = takePass(session, 0.9);
  assert.equal(session.complete, true);
  assert.equal(session.attempts.length, 3);
  assert.deepEqual(session.attempts.map(attempt => attempt.quality), ['late', 'clean', 'late']);
});

test('pass pointers are clamped without mutating the prior session', () => {
  const session = createEpisodeActivity('train');
  const next = takePass(session, -4);
  assert.equal(next.attempts[0].pointer, 0);
  assert.equal(session.attempts.length, 0);
});

test('the fundraiser queue only advances on the requested item', () => {
  let session = createEpisodeActivity('fundraise');
  const unchanged = serveFundraiser(session, 'towel');
  assert.equal(unchanged.step, 0);
  for (const order of session.orders) session = serveFundraiser(session, order.itemId);
  assert.equal(session.complete, true);
  assert.equal(session.customersServed, 3);
});

test('archive clues can be inspected in any order without duplicates', () => {
  let session = createEpisodeActivity('records');
  session = inspectArchiveClue(session, 'photo');
  session = inspectArchiveClue(session, 'signature');
  session = inspectArchiveClue(session, 'photo');
  session = inspectArchiveClue(session, 'date');
  assert.deepEqual(session.cluesFound, ['photo', 'signature', 'date']);
  assert.equal(session.complete, true);
});

test('unknown activities and clues are rejected', () => {
  assert.throws(() => createEpisodeActivity('unknown'), /unknown episode activity/i);
  const session = createEpisodeActivity('records');
  assert.throws(() => inspectArchiveClue(session, 'drawer'), /unknown archive clue/i);
});

