import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_ACTIONS,
  NAMING_DAYS,
  NAMING_SCENES,
  REVEAL_RESPONSES,
  VOTE_ROUTES,
  getFreeAction,
  getNamingDay,
  getNamingScene
} from './naming-rights-content.js';

test('the second week gives every day a physical story scene', () => {
  assert.equal(NAMING_DAYS.length, 7);
  assert.deepEqual(NAMING_DAYS.map(day => day.dayIndex), [10, 11, 12, 13, 14, 15, 16]);
  for (const day of NAMING_DAYS) {
    const scene = getNamingScene(day.sceneId);
    assert.ok(scene.propId);
    assert.ok(scene.beats.length >= 2 && scene.beats.length <= 4);
  }
  assert.equal(getNamingDay(13).sceneId, 'scratched-name');
});

test('free actions expose distinct human-scale work and consequences', () => {
  assert.deepEqual(Object.keys(FREE_ACTIONS), ['shop', 'training', 'repair', 'community', 'archive', 'rest']);
  assert.equal(getFreeAction('shop').label, '去场边小店');
  assert.ok(FREE_ACTIONS.community.signatures > FREE_ACTIONS.shop.signatures);
  assert.ok(FREE_ACTIONS.repair.facility > 0);
  assert.ok(FREE_ACTIONS.training.cohesion > 0);
  assert.equal(FREE_ACTIONS.archive.evidence, 1);
  for (const action of Object.values(FREE_ACTIONS)) assert.ok(action.resultCopy.length > 18);
});

test('votes and responses preserve three genuinely different positions', () => {
  assert.deepEqual(Object.keys(VOTE_ROUTES), ['co-name', 'community-save', 'delay']);
  assert.deepEqual(Object.keys(REVEAL_RESPONSES), ['restore-history', 'name-as-repair', 'after-match']);
  assert.equal(VOTE_ROUTES['co-name'].stadiumName, '澜岸·海风球场');
  assert.equal(VOTE_ROUTES['community-save'].stadiumName, '海风球场');
  assert.match(NAMING_SCENES['scratched-name'].beats.join(''), /沈峤|名字|刮/);
});

test('unknown naming content is rejected instead of silently clamped', () => {
  assert.throws(() => getNamingDay(9), /unknown naming day/i);
  assert.throws(() => getNamingScene('missing'), /unknown naming scene/i);
  assert.throws(() => getFreeAction('missing'), /unknown free action/i);
});
