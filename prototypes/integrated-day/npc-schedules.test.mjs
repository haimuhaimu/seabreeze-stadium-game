import test from 'node:test';
import assert from 'node:assert/strict';
import { getNpcSchedule } from './npc-schedules.js';
import { beginSeason, createSeasonState, resolveSeasonEvent } from './season-state.js';

test('built facilities move their everyday patrons beside the work', () => {
  const season = beginSeason(createSeasonState());
  season.projects.market = 2;
  season.projects.clinic = 1;
  const schedule = getNpcSchedule(17, 'morning', { season });
  const aunt = schedule.find(npc => npc.id === 'aunt-xu');
  const xiaoman = schedule.find(npc => npc.id === 'xiaoman');
  assert.deepEqual({ mapId: aunt.mapId, x: aunt.x, y: aunt.y }, { mapId: 'stadium', x: 82, y: 63 });
  assert.match(aunt.copy, /遮雨摊位|普通日子|值班/);
  assert.deepEqual({ mapId: xiaoman.mapId, x: xiaoman.x, y: xiaoman.y }, { mapId: 'stadium', x: 70, y: 65 });
  assert.match(xiaoman.copy, /急救|绷带|冰袋/);
});

test('an incident memory overrides facility copy without moving the patron away', () => {
  let season = beginSeason(createSeasonState());
  season.projects.clinic = 1;
  season = resolveSeasonEvent(season, 'shared-pitch', 'share-half');
  const xiaoman = getNpcSchedule(17, 'morning', { season }).find(npc => npc.id === 'xiaoman');
  assert.deepEqual({ mapId: xiaoman.mapId, x: xiaoman.x, y: xiaoman.y }, { mapId: 'stadium', x: 70, y: 65 });
  assert.equal(xiaoman.copy, '孩子们问下周还能不能用那道白线。我告诉他们，约好的时段不会只算一次。');
  assert.equal(xiaoman.memory.choiceLabel, '把半块场地画出来');
});

test('unbuilt projects leave the original league schedule unchanged', () => {
  const season = beginSeason(createSeasonState());
  const schedule = getNpcSchedule(17, 'morning', { season });
  assert.deepEqual(
    schedule.map(npc => [npc.id, npc.mapId]),
    [
      ['coach-guo', 'training'], ['lin-chuan', 'stadium'], ['aunt-xu', 'training'],
      ['xiaoman', 'training'], ['shen-qiao', 'stadium'], ['director-luo', 'stadium']
    ]
  );
});
