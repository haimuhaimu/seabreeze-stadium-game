import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from './game-state.js';
import { migrateV1Record, migrateV2Record, migrateV3Record } from './save-migration.js';

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
  delete legacy.namingRights;

  const migrated = migrateV1Record({
    version: 1,
    state: legacy,
    position: { x: 50, y: 89 }
  });

  assert.equal(migrated.version, 4);
  assert.equal(migrated.state.version, 4);
  assert.equal(migrated.state.money, 37);
  assert.equal(migrated.state.economy.cash, 37);
  assert.deepEqual(migrated.state.repairs, ['awning']);
  assert.equal(migrated.state.relationship.coachTrust, 2);
  assert.equal(migrated.state.world.mapId, 'training');
  assert.deepEqual(migrated.state.world.positions.training, { x: 50, y: 89 });
  assert.equal(migrated.state.episode.id, 'last-roster-slot');
  assert.equal(migrated.state.namingRights.id, 'naming-rights');
});

function versionTwoRecord({ dayIndex, weekComplete }) {
  const state = createGameState();
  const legacy = {
    ...state,
    version: 2,
    dayIndex,
    phase: weekComplete ? 'complete' : 'morning',
    money: 74,
    repairs: ['net'],
    campaign: { prologueComplete: true, week: 1 },
    management: {
      ...state.management,
      completedActions: ['review-ledger'],
      dailyRecords: [],
      weekComplete
    }
  };
  delete legacy.episode;
  return { version: 2, state: legacy, position: { x: 52, y: 59 }, mapId: 'stadium' };
}

test('an unfinished version two week restarts the new spring 15 episode', () => {
  const migrated = migrateV2Record(versionTwoRecord({ dayIndex: 6, weekComplete: false }));
  assert.equal(migrated.version, 4);
  assert.equal(migrated.state.dayIndex, 3);
  assert.equal(migrated.state.phase, 'morning');
  assert.equal(migrated.state.episode.sceneId, 'blank-notice');
  assert.deepEqual(migrated.state.repairs, ['net']);
});

test('a completed version two week is retained as a memory flag', () => {
  const migrated = migrateV2Record(versionTwoRecord({ dayIndex: 9, weekComplete: true }));
  assert.equal(migrated.state.dayIndex, 3);
  assert.equal(migrated.state.campaign.legacyWeekComplete, true);
});

test('a version three record gains second-week state without losing the first-week settlement', () => {
  const state = createGameState();
  const legacy = {
    ...state,
    version: 3,
    dayIndex: 9,
    phase: 'complete',
    campaign: { prologueComplete: true, week: 1 },
    management: {
      ...state.management,
      weekComplete: true,
      settlement: {
        score: { home: 2, away: 1 },
        metrics: { cash: 90 },
        character: { nextCrisis: '一份新的债权文件' }
      }
    }
  };
  delete legacy.namingRights;
  const record = { version: 3, state: legacy, position: { x: 54, y: 71 }, mapId: 'stadium' };
  const migrated = migrateV3Record(record);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.state.version, 4);
  assert.equal(migrated.state.dayIndex, 9);
  assert.deepEqual(migrated.state.management.settlement.score, { home: 2, away: 1 });
  assert.equal(migrated.state.namingRights.id, 'naming-rights');
});
