import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoster, chooseTrainingFocus } from './roster-state.js';
import { createMatch, getAvailableHighlights, resolveHighlight, finishMatch } from './match-engine.js';

test('training focus changes roster without mutating its input', () => {
  const roster = createRoster();
  const trained = chooseTrainingFocus(roster, 'shape');
  assert.equal(roster.trainingFocus, null);
  assert.equal(trained.defense, 53);
  assert.equal(trained.cohesion, 48);
});

test('three highlight choices produce a deterministic match result', () => {
  const episode = { promisesCompleted: ['train'] };
  let match = createMatch({ opponentDifficulty: 62, attack: 48, defense: 48, cohesion: 46, facilityBonus: 0 });
  match = resolveHighlight(match, 'repeat-practice', episode);
  match = resolveHighlight(match, 'ask-xiaoman', episode);
  match = resolveHighlight(match, 'share-responsibility', episode);
  const result = finishMatch(match);
  assert.equal(match.highlightIndex, 3);
  assert.deepEqual(result.score, { home: 2, away: 1 });
  assert.equal(result.complete, true);
});

test('the practice callback appears only after training with Xiaoman', () => {
  const match = createMatch({ opponentDifficulty: 62, attack: 48, defense: 48, cohesion: 46, facilityBonus: 0 });
  const withoutTraining = getAvailableHighlights(match, { promisesCompleted: ['records'] });
  const withTraining = getAvailableHighlights(match, { promisesCompleted: ['train'] });
  assert.equal(withoutTraining.choices.some(choice => choice.id === 'repeat-practice'), false);
  assert.equal(withTraining.choices.some(choice => choice.id === 'repeat-practice'), true);
});

test('an unfinished match cannot be settled', () => {
  const match = createMatch({ opponentDifficulty: 62, attack: 48, defense: 48, cohesion: 46, facilityBonus: 0 });
  assert.throws(() => finishMatch(match), /three highlights/i);
});
