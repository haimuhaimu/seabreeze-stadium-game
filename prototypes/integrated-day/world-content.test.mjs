import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, canStandOnMap, getNamingActionObjects, getSeasonWorldObjects } from './world-content.js';
import { getNpcSchedule } from './npc-schedules.js';
import { beginSeason, createSeasonState, recordSeasonAction, upgradeSeasonProject } from './season-state.js';

test('training and stadium maps have reciprocal exits and safe spawn points', () => {
  assert.equal(MAPS.training.exits[0].targetMap, 'stadium');
  assert.equal(MAPS.stadium.exits[0].targetMap, 'training');
  assert.equal(canStandOnMap('stadium', MAPS.stadium.start.x, MAPS.stadium.start.y), true);
});

test('stadium mainline routes stay on walkable paths', () => {
  for (const object of [...MAPS.stadium.objects, ...MAPS.stadium.exits]) {
    const route = [...object.route, object.approach];
    for (const point of route) {
      assert.equal(
        canStandOnMap('stadium', point.x, point.y),
        true,
        `${object.id} route enters a blocked area at ${point.x},${point.y}`
      );
    }
  }
});

test('Lin Xu and Xiaoman all appear during the first week', () => {
  const names = new Set();
  for (let dayIndex = 3; dayIndex <= 9; dayIndex += 1) {
    for (const npc of getNpcSchedule(dayIndex, 'morning')) names.add(npc.name);
  }
  assert.equal(names.has('林川'), true);
  assert.equal(names.has('许姨'), true);
  assert.equal(names.has('小满'), true);
});

test('Shen Qiao enters at the main stadium on spring 15', () => {
  const shen = getNpcSchedule(3, 'morning').find(npc => npc.id === 'shen-qiao');
  assert.equal(shen.mapId, 'stadium');
  assert.match(shen.copy, /债务|决定权/);
});

test('Xiaoman is outside the meeting on spring 16', () => {
  const xiaoman = getNpcSchedule(4, 'morning').find(npc => npc.id === 'xiaoman');
  assert.equal(xiaoman.mapId, 'training');
  assert.match(xiaoman.copy, /门外|听见/);
});

test('spring 17 can expose all three promise locations on existing maps', () => {
  assert.equal(MAPS.training.objects.some(item => item.id === 'shop'), true);
  assert.equal(MAPS.training.objects.some(item => item.id === 'coach'), true);
  assert.equal(MAPS.stadium.objects.some(item => item.id === 'stadium-office'), true);
});

test('each core character takes initiative in the episode', () => {
  const ids = new Set([3, 4, 5, 6, 7, 8, 9].flatMap(day => getNpcSchedule(day).map(npc => npc.id)));
  for (const id of ['coach-guo', 'lin-chuan', 'aunt-xu', 'xiaoman', 'shen-qiao']) assert.ok(ids.has(id));
});

test('second-week free time exposes human-scale actions on walkable stadium paths', () => {
  const namingRights = {
    freeTime: { available: true, activeAction: null, records: [] }
  };
  const objects = getNamingActionObjects('stadium', 12, namingRights);
  assert.deepEqual(objects.map(item => item.actionId).sort(), [
    'free:community',
    'free:repair',
    'free:rest',
    'free:shop',
    'free:training'
  ]);
  for (const object of objects) {
    assert.equal(canStandOnMap('stadium', object.approach.x, object.approach.y), true);
  }
});

test('the archive appears only after the scratched plaque is discovered', () => {
  const namingRights = {
    freeTime: { available: true, activeAction: null, records: [] }
  };
  assert.equal(getNamingActionObjects('stadium', 12, namingRights).some(item => item.actionId === 'free:archive'), false);
  assert.equal(getNamingActionObjects('stadium', 13, namingRights).some(item => item.actionId === 'free:archive'), true);
  assert.equal(getNamingActionObjects('stadium', 15, namingRights).some(item => item.actionId === 'free:archive'), true);
});

test('spent or inactive free time removes action targets', () => {
  const spent = {
    freeTime: { available: false, activeAction: null, records: [{ dayIndex: 11, actionId: 'rest' }] }
  };
  assert.deepEqual(getNamingActionObjects('stadium', 11, spent), []);
  assert.deepEqual(getNamingActionObjects('training', 11, spent), []);
});

test('the second week lets every central character take a position on the name', () => {
  const ids = new Set([10, 11, 12, 13, 14, 15, 16].flatMap(day => getNpcSchedule(day).map(npc => npc.id)));
  for (const id of ['coach-guo', 'lin-chuan', 'aunt-xu', 'xiaoman', 'shen-qiao', 'director-luo']) assert.ok(ids.has(id));
  const plaqueDay = getNpcSchedule(13);
  assert.match(plaqueDay.find(npc => npc.id === 'coach-guo').copy, /没拦|刮掉|对不起/);
  assert.match(plaqueDay.find(npc => npc.id === 'shen-qiao').copy, /创办|名字|欠/);
});

test('the league places seven weekly actions and five construction sites in the physical world', () => {
  const season = beginSeason(createSeasonState());
  const objects = ['training', 'stadium'].flatMap(mapId => getSeasonWorldObjects(mapId, season));
  assert.equal(objects.filter(item => item.kind === 'season-action').length, 7);
  assert.equal(objects.filter(item => item.kind === 'season-project').length, 5);
  for (const object of objects) {
    assert.equal(canStandOnMap(object.mapId, object.approach.x, object.approach.y), true, object.id);
    const map = MAPS[object.mapId];
    const interactionDistance = Math.hypot(
      (object.x - object.approach.x) * map.width / 100,
      (object.y - object.approach.y) * map.height / 100
    );
    assert.ok(interactionDistance <= 112, `${object.id} stops too far away to interact`);
    for (const point of object.route) assert.equal(canStandOnMap(object.mapId, point.x, point.y), true, object.id);
  }
});

test('completed league work leaves the map and the match target opens after three actions', () => {
  let season = beginSeason(createSeasonState());
  season = recordSeasonAction(season, 'train-attack');
  season = recordSeasonAction(season, 'shop-day');
  season = upgradeSeasonProject(season, 'stands');
  const objects = ['training', 'stadium'].flatMap(mapId => getSeasonWorldObjects(mapId, season));
  assert.equal(objects.some(item => item.actionId === 'train-attack'), false);
  assert.equal(objects.some(item => item.actionId === 'shop-day'), false);
  assert.equal(objects.some(item => item.projectId === 'stands'), false);
  assert.deepEqual(objects.filter(item => item.kind === 'season-match').map(item => item.mapId), ['stadium']);
});

test('all six recurring NPCs are available during every league round with response choices', () => {
  const season = beginSeason(createSeasonState());
  for (let roundIndex = 0; roundIndex < 7; roundIndex += 1) {
    season.roundIndex = roundIndex;
    const schedule = getNpcSchedule(17 + roundIndex, 'morning', { season });
    assert.deepEqual(schedule.map(npc => npc.id).sort(), [
      'aunt-xu', 'coach-guo', 'director-luo', 'lin-chuan', 'shen-qiao', 'xiaoman'
    ]);
    assert.equal(schedule.every(npc => npc.seasonNpc && npc.responses.length === 3), true);
  }
});
