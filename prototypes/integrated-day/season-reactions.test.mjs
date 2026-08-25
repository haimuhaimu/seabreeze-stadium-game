import test from 'node:test';
import assert from 'node:assert/strict';
import { getSeasonNpc } from './season-content.js';
import { SEASON_EVENTS } from './season-events.js';
import {
  SEASON_EVENT_REACTIONS,
  getSeasonEventReaction,
  getSeasonEventReactionNpcIds
} from './season-reactions.js';

test('every incident choice gives exactly two recurring NPCs an authored reaction', () => {
  let choiceCount = 0;
  let reactionCount = 0;
  for (const event of SEASON_EVENTS) {
    for (const choice of event.choices) {
      choiceCount += 1;
      const npcIds = getSeasonEventReactionNpcIds(event.id, choice.id);
      assert.equal(npcIds.length, 2, `${event.id}/${choice.id}`);
      assert.equal(new Set(npcIds).size, 2, `${event.id}/${choice.id} repeats an NPC`);
      for (const npcId of npcIds) {
        assert.doesNotThrow(() => getSeasonNpc(npcId));
        const copy = getSeasonEventReaction(event.id, choice.id, npcId);
        assert.equal(typeof copy, 'string');
        assert.ok(copy.length >= 16, `${event.id}/${choice.id}/${npcId} is too generic`);
        reactionCount += 1;
      }
    }
  }
  assert.equal(choiceCount, 27);
  assert.equal(reactionCount, 54);
  assert.equal(Object.keys(SEASON_EVENT_REACTIONS).length, 9);
});

test('the shared-pitch reactions remember the actual choice from two positions', () => {
  assert.equal(
    getSeasonEventReaction('shared-pitch', 'share-half', 'xiaoman'),
    '孩子们问下周还能不能用那道白线。我告诉他们，约好的时段不会只算一次。'
  );
  assert.equal(
    getSeasonEventReaction('shared-pitch', 'share-half', 'coach-guo'),
    '半场训练比我想的更挤，但队员开始抬头看人。那道白线没有毁掉备战。'
  );
});

test('reaction getters reject unknown events, choices, and NPCs', () => {
  assert.throws(() => getSeasonEventReactionNpcIds('missing', 'share-half'), /event/i);
  assert.throws(() => getSeasonEventReactionNpcIds('shared-pitch', 'missing'), /choice/i);
  assert.throws(() => getSeasonEventReaction('shared-pitch', 'share-half', 'missing'), /NPC/i);
});

