import test from 'node:test';
import assert from 'node:assert/strict';
import { SEASON_EVENTS, getSeasonEvent, getSeasonEventChoice } from './season-events.js';

const EFFECT_KEYS = ['cash', 'attack', 'defense', 'cohesion', 'community', 'facility', 'energy', 'support', 'shenInfluence'];
const CALLBACK_TAGS = new Set(['attack', 'defense', 'youth', 'market', 'community', 'stands', 'clinic', 'coach', 'cohesion']);

test('the first season follows seven authored incidents and season two rotates them', () => {
  const first = Array.from({ length: 7 }, (_, index) => getSeasonEvent(index, 1).id);
  const second = Array.from({ length: 7 }, (_, index) => getSeasonEvent(index, 2).id);
  assert.equal(new Set(first).size, 7);
  assert.notDeepEqual(second, first);
  assert.deepEqual(first.slice(0, 3), ['shared-pitch', 'storm-drain', 'sore-knee']);
  assert.deepEqual(second.slice(0, 3), ['broadcast-contract', 'missing-wage', 'early-supporters']);
});

test('the incident deck has nine complete human-scale conflicts', () => {
  assert.equal(SEASON_EVENTS.length, 9);
  assert.equal(new Set(SEASON_EVENTS.map(event => event.id)).size, 9);
  for (const event of SEASON_EVENTS) {
    assert.ok(event.title.length >= 6, event.id);
    assert.ok(['training', 'stadium'].includes(event.mapId), event.id);
    assert.ok(event.locationId, event.id);
    assert.ok(event.speakerId, event.id);
    assert.ok(event.beats.length >= 2 && event.beats.length <= 3, event.id);
    assert.equal(event.choices.length, 3, event.id);
  }
});

test('every incident choice has explicit tradeoffs, callbacks, and relationship consequences', () => {
  for (const event of SEASON_EVENTS) {
    assert.equal(new Set(event.choices.map(choice => choice.id)).size, 3, event.id);
    for (const choice of event.choices) {
      assert.ok(choice.label.length >= 4, `${event.id}:${choice.id}`);
      assert.ok(choice.detail.length >= 8, `${event.id}:${choice.id}`);
      assert.ok(choice.resultCopy.length >= 10, `${event.id}:${choice.id}`);
      assert.equal(CALLBACK_TAGS.has(choice.tag), true, `${event.id}:${choice.id}`);
      assert.deepEqual(Object.keys(choice.effects).sort(), [...EFFECT_KEYS].sort(), `${event.id}:${choice.id}`);
      assert.equal(Object.values(choice.effects).every(Number.isFinite), true, `${event.id}:${choice.id}`);
      assert.ok(Object.keys(choice.relationships).length >= 1, `${event.id}:${choice.id}`);
      assert.equal(Object.values(choice.relationships).every(value => [-1, 0, 1].includes(value)), true, `${event.id}:${choice.id}`);
    }
  }
});

test('incident getters reject unknown rounds, seasons, events, and choices', () => {
  assert.throws(() => getSeasonEvent(-1, 1), /round/i);
  assert.throws(() => getSeasonEvent(7, 1), /round/i);
  assert.throws(() => getSeasonEvent(0, 0), /season/i);
  assert.throws(() => getSeasonEventChoice('missing', 'choice'), /event/i);
  assert.throws(() => getSeasonEventChoice('shared-pitch', 'missing'), /choice/i);
});
