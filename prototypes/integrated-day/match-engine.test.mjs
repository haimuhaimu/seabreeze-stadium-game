import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoster, chooseTrainingFocus } from './roster-state.js';
import { createMatch, resolveHighlight, finishMatch } from './match-engine.js';

test('training focus changes roster without mutating its input', () => {
  const roster = createRoster();
  const trained = chooseTrainingFocus(roster, 'shape');
  assert.equal(roster.trainingFocus, null);
  assert.equal(trained.defense, 53);
  assert.equal(trained.cohesion, 48);
});

test('three highlight choices produce a deterministic match result', () => {
  let match = createMatch({ opponentDifficulty: 48, attack: 48, defense: 53, cohesion: 48, facilityBonus: 4 });
  match = resolveHighlight(match, 'patient-build');
  match = resolveHighlight(match, 'protect-youngster');
  match = resolveHighlight(match, 'press-late');
  const result = finishMatch(match);
  assert.equal(match.highlightIndex, 3);
  assert.deepEqual(result.score, { home: 2, away: 1 });
  assert.equal(result.complete, true);
});

test('an unfinished match cannot be settled', () => {
  const match = createMatch({ opponentDifficulty: 62, attack: 48, defense: 48, cohesion: 46, facilityBonus: 0 });
  assert.throws(() => finishMatch(match), /three highlights/i);
});
