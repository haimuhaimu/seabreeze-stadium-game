import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSTRUCTION_SCENES,
  getConstructionNpcPlacement,
  getConstructionScene,
  getConstructionVisuals
} from './construction-content.js';

const emptyProjects = Object.freeze({ stands: 0, clinic: 0, academy: 0, market: 0, lights: 0 });

test('five projects own literal map regions, patrons, and three human-scale stages', () => {
  assert.deepEqual(Object.keys(CONSTRUCTION_SCENES), ['stands', 'clinic', 'academy', 'market', 'lights']);
  assert.deepEqual(getConstructionScene('stands').visual, { x: 6, y: 20, width: 23, height: 49 });
  assert.equal(getConstructionScene('academy').mapId, 'training');
  assert.equal(getConstructionScene('market').patronId, 'aunt-xu');
  for (const scene of Object.values(CONSTRUCTION_SCENES)) {
    assert.equal(scene.levels.length, 3, scene.projectId);
    assert.equal(scene.levels.every(level => level.copy.length >= 18), true, scene.projectId);
    assert.equal(scene.levels.every(level => level.visitCopy.length >= 18), true, scene.projectId);
  }
});

test('construction visuals expose every site on its map and its actual stage', () => {
  const projects = { ...emptyProjects, stands: 2, clinic: 3, academy: 1 };
  const stadium = getConstructionVisuals('stadium', projects);
  assert.equal(stadium.length, 4);
  assert.deepEqual(stadium.map(item => item.projectId), ['stands', 'clinic', 'market', 'lights']);
  assert.deepEqual(stadium.find(item => item.projectId === 'stands'), {
    projectId: 'stands', mapId: 'stadium', level: 2,
    x: 6, y: 20, width: 23, height: 49,
    stageLabel: '遮雨座席', complete: false
  });
  assert.equal(stadium.find(item => item.projectId === 'clinic').complete, true);
  assert.deepEqual(getConstructionVisuals('training', projects).map(item => [item.projectId, item.level]), [['academy', 1]]);
});

test('a built project moves its patron beside the facility with level-specific dialogue', () => {
  const season = { projects: { ...emptyProjects, market: 2, clinic: 1 } };
  assert.deepEqual(getConstructionNpcPlacement(season, 'aunt-xu'), {
    projectId: 'market', mapId: 'stadium', x: 82, y: 63,
    copy: CONSTRUCTION_SCENES.market.levels[1].copy
  });
  assert.equal(getConstructionNpcPlacement(season, 'lin-chuan'), null);
  assert.equal(getConstructionNpcPlacement(season, 'shen-qiao'), null);
});

test('construction getters reject unknown maps, ids, and malformed levels', () => {
  assert.throws(() => getConstructionScene('missing'), /Unknown construction scene/);
  assert.throws(() => getConstructionVisuals('warehouse', emptyProjects), /Unknown construction map/);
  assert.throws(() => getConstructionVisuals('stadium', { ...emptyProjects, stands: 4 }), /Invalid construction level/);
  assert.throws(() => getConstructionNpcPlacement({ projects: emptyProjects }, 'missing'), /Unknown construction NPC/);
});
