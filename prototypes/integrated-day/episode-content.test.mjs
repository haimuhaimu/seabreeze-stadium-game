import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EPISODE_ID,
  PROMISES,
  getEpisodeDay,
  getStoryScene
} from './episode-content.js';

test('last roster slot exposes three plain-language requests', () => {
  assert.equal(EPISODE_ID, 'last-roster-slot');
  assert.deepEqual(Object.keys(PROMISES), ['train', 'fundraise', 'records']);
  assert.equal(PROMISES.train.worldObjectId, 'coach');
  assert.equal(PROMISES.fundraise.worldObjectId, 'shop');
  assert.equal(PROMISES.records.worldObjectId, 'stadium-office');
});

test('the management week follows the approved episode rhythm', () => {
  assert.equal(getEpisodeDay(3).sceneId, 'blank-notice');
  assert.equal(getEpisodeDay(4).sceneId, 'seven-bib');
  assert.equal(getEpisodeDay(7).sceneId, 'friday-funding');
  assert.equal(getEpisodeDay(8).sceneId, 'shen-offer');
  assert.equal(getEpisodeDay(9).sceneId, 'sunday-match');
});

test('story scenes stay short and use physical props', () => {
  const notice = getStoryScene('blank-notice');
  assert.equal(notice.propId, 'notice');
  assert.ok(notice.beats.length <= 3);
  assert.ok(notice.choices.length <= 3);
});

