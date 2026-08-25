import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELITE_MOMENTS,
  ELITE_OPPONENT,
  ELITE_PREPARATIONS,
  ELITE_RESULTS,
  getElitePreparation
} from './elite-content.js';

test('the elite invitation has one opponent, three preparations, and three readable moments', () => {
  assert.equal(ELITE_OPPONENT.id, 'heling-academy');
  assert.equal(Object.keys(ELITE_PREPARATIONS).length, 3);
  assert.equal(ELITE_MOMENTS.length, 3);
  assert.equal(new Set(ELITE_MOMENTS.map(moment => moment.id)).size, 3);
  assert.equal(ELITE_MOMENTS.every(moment => moment.choices.length === 3), true);
  assert.equal(new Set(ELITE_MOMENTS.flatMap(moment => moment.choices.map(choice => choice.id))).size, 9);
});

test('each elite moment recalls one distinct part of the season', () => {
  assert.deepEqual(ELITE_MOMENTS[0].choices.map(choice => choice.callback), ['ranking', null, null]);
  assert.deepEqual(ELITE_MOMENTS[1].choices.map(choice => choice.callback), ['construction', null, null]);
  assert.deepEqual(ELITE_MOMENTS[2].choices.map(choice => choice.callback), [
    'preparation:shared-plan',
    'preparation:repair-buffer',
    'preparation:open-gates'
  ]);
  assert.deepEqual(ELITE_MOMENTS[0].choices[0].effect, { home: 1 });
  assert.deepEqual(ELITE_MOMENTS[1].choices[0].effect, { away: -1 });
  assert.deepEqual(ELITE_MOMENTS[2].choices[0].effect, { home: 1 });
});

test('elite results expose deterministic long-term rewards', () => {
  assert.deepEqual(ELITE_RESULTS.champion.effects, { cash: 160, cohesion: 4, community: 8 });
  assert.deepEqual(ELITE_RESULTS.recognized.effects, { cash: 90, cohesion: 2, community: 4 });
  assert.deepEqual(ELITE_RESULTS.attended.effects, { cash: 50, cohesion: 1, community: 2 });
});

test('unknown elite preparations fail loudly', () => {
  assert.equal(getElitePreparation('shared-plan').id, 'shared-plan');
  assert.throws(() => getElitePreparation('missing'), /Unknown elite preparation/);
});
