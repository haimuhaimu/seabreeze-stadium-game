import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAINING_TARGETS,
  createTrainingSession,
  scoreShot,
  takeShot
} from './training-game.js';

test('shot scoring uses center, edge, and miss bands', () => {
  assert.equal(scoreShot(.50, .50), 2);
  assert.equal(scoreShot(.62, .50), 1);
  assert.equal(scoreShot(.84, .50), 0);
});

test('a session ends after exactly three shots', () => {
  let session = createTrainingSession();
  session = takeShot(session, TRAINING_TARGETS[0]);
  session = takeShot(session, TRAINING_TARGETS[1]);
  session = takeShot(session, TRAINING_TARGETS[2]);
  const finished = session;
  session = takeShot(session, .5);
  assert.equal(finished.complete, true);
  assert.equal(finished.score, 6);
  assert.deepEqual(session, finished);
});

test('pointer input is clamped to the power track', () => {
  let session = createTrainingSession();
  session = takeShot(session, -4);
  session = takeShot(session, 9);
  assert.equal(session.shots[0].pointer, 0);
  assert.equal(session.shots[1].pointer, 1);
});
