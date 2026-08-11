import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, canStandOnMap } from './world-content.js';
import { getNpcSchedule } from './npc-schedules.js';

test('training and stadium maps have reciprocal exits and safe spawn points', () => {
  assert.equal(MAPS.training.exits[0].targetMap, 'stadium');
  assert.equal(MAPS.stadium.exits[0].targetMap, 'training');
  assert.equal(canStandOnMap('stadium', MAPS.stadium.start.x, MAPS.stadium.start.y), true);
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
  assert.match(shen.copy, /债务|合作/);
});
