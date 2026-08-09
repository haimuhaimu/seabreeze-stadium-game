import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from './game-state.js';
import { migrateV1Record } from './save-migration.js';

test('a completed version one prologue migrates without losing progress', () => {
  const legacy = {
    ...createGameState(),
    version: 1,
    dayIndex: 2,
    phase: 'complete',
    chapterComplete: true,
    money: 37,
    repairs: ['awning'],
    relationship: { coachMet: true, coachTrust: 2 }
  };
  delete legacy.campaign;
  delete legacy.economy;
  delete legacy.facilities;
  delete legacy.roster;
  delete legacy.governance;
  delete legacy.management;
  delete legacy.world;
  delete legacy.communitySupport;

  const migrated = migrateV1Record({
    version: 1,
    state: legacy,
    position: { x: 50, y: 89 }
  });

  assert.equal(migrated.version, 2);
  assert.equal(migrated.state.money, 37);
  assert.equal(migrated.state.economy.cash, 37);
  assert.deepEqual(migrated.state.repairs, ['awning']);
  assert.equal(migrated.state.relationship.coachTrust, 2);
  assert.equal(migrated.state.world.mapId, 'training');
  assert.deepEqual(migrated.state.world.positions.training, { x: 50, y: 89 });
});
