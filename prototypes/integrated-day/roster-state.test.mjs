import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAINING_FOCUS, createRoster, chooseTrainingFocus } from './roster-state.js';

test('a new roster starts from the documented baseline', () => {
  const roster = createRoster();
  assert.deepEqual(
    [roster.attack, roster.defense, roster.cohesion, roster.injuryRisk, roster.youthTrust],
    [48, 48, 46, 0, 0]
  );
  assert.equal(roster.trainingFocus, null);
});

test('each focus adds its authored effects once', () => {
  const pressing = chooseTrainingFocus(createRoster(), 'pressing');
  assert.equal(pressing.trainingFocus, 'pressing');
  assert.equal(pressing.attack, 54);
  assert.equal(pressing.injuryRisk, 2);

  const shape = chooseTrainingFocus(createRoster(), 'shape');
  assert.equal(shape.defense, 53);
  assert.equal(shape.cohesion, 48);

  const youth = chooseTrainingFocus(createRoster(), 'youth');
  assert.equal(youth.attack, 50);
  assert.equal(youth.cohesion, 49);
  assert.equal(youth.youthTrust, 2);
});

test('a focus can only be chosen once and unknown ids are rejected', () => {
  let roster = chooseTrainingFocus(createRoster(), 'shape');
  assert.throws(() => chooseTrainingFocus(roster, 'pressing'), /Invalid training focus/);
  assert.throws(() => chooseTrainingFocus(createRoster(), 'missing'), /Invalid training focus/);
});

test('all three focuses are authored for the weekly training choice', () => {
  assert.deepEqual(Object.keys(TRAINING_FOCUS), ['pressing', 'shape', 'youth']);
});
