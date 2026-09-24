import test from 'node:test';
import assert from 'node:assert/strict';
import { getSeasonNpcMemory } from './season-memory.js';
import { beginSeason, createSeasonState, resolveSeasonEvent } from './season-state.js';

function emptyNextWeek(season, roundIndex) {
  return {
    ...season,
    roundIndex,
    week: {
      actions: [],
      talkedNpcIds: [],
      npcResponses: {},
      helpTags: [],
      eventId: null,
      eventChoiceId: null,
      eventTag: null,
      memoryNpcIds: [],
      result: null,
      roundComplete: false
    },
    match: null
  };
}

test('a resolved incident immediately changes the two affected NPC conversations', () => {
  let season = beginSeason(createSeasonState());
  season = resolveSeasonEvent(season, 'shared-pitch', 'share-half');
  assert.deepEqual(getSeasonNpcMemory(season, 'xiaoman'), {
    eventId: 'shared-pitch',
    choiceId: 'share-half',
    eventTitle: '谁先用半块场地',
    choiceLabel: '把半块场地画出来',
    npcId: 'xiaoman',
    round: 1,
    seasonNumber: 1,
    timing: 'current',
    label: '回应刚刚的决定',
    copy: '孩子们问下周还能不能用那道白线。我告诉他们，约好的时段不会只算一次。'
  });
  assert.match(getSeasonNpcMemory(season, 'coach-guo').copy, /半场训练/);
  assert.equal(getSeasonNpcMemory(season, 'director-luo'), null);
});

test('the immediately previous incident remains visible until the new incident is resolved', () => {
  let season = beginSeason(createSeasonState());
  season = resolveSeasonEvent(season, 'shared-pitch', 'share-half');
  season = emptyNextWeek(season, 1);
  const previous = getSeasonNpcMemory(season, 'xiaoman');
  assert.equal(previous.timing, 'previous');
  assert.equal(previous.label, '还记得第 1 轮');
  assert.equal(previous.choiceLabel, '把半块场地画出来');

  season = resolveSeasonEvent(season, 'storm-drain', 'hire-repair');
  assert.equal(getSeasonNpcMemory(season, 'xiaoman'), null);
  assert.equal(getSeasonNpcMemory(season, 'lin-chuan').timing, 'current');
  assert.match(getSeasonNpcMemory(season, 'lin-chuan').copy, /验收照片/);
});

test('memory follows the rotated incident deck in later seasons', () => {
  let season = beginSeason(createSeasonState());
  season = emptyNextWeek({ ...season, seasonNumber: 2 }, 0);
  season = resolveSeasonEvent(season, 'broadcast-contract', 'publish-terms');
  const memory = getSeasonNpcMemory(season, 'shen-qiao');
  assert.equal(memory.seasonNumber, 2);
  assert.equal(memory.round, 1);
  assert.equal(memory.eventTitle, '直播合同多了一行字');
  assert.equal(memory.choiceLabel, '公开条件后再签');
});

test('inactive seasons and unknown NPCs do not create false memories', () => {
  assert.equal(getSeasonNpcMemory(createSeasonState(), 'xiaoman'), null);
  const season = beginSeason(createSeasonState());
  assert.throws(() => getSeasonNpcMemory(season, 'missing'), /NPC/i);
});

