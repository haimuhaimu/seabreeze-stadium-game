import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, canStandOnMap } from './world-content.js';
import { getNpcSchedule } from './npc-schedules.js';

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
