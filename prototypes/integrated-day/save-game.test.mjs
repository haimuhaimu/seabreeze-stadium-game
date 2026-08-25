import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from './game-state.js';
import { createEpisodeState } from './episode-state.js';
import { SAVE_KEY, V4_SAVE_KEY, V3_SAVE_KEY, V2_SAVE_KEY, LEGACY_SAVE_KEY, loadSave, writeSave, clearSave } from './save-game.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test('a save record round-trips without losing state', () => {
  const storage = memoryStorage();
  const state = { ...createGameState(), episode: createEpisodeState() };
  writeSave(storage, state, { x: 44, y: 82 });
  assert.deepEqual(loadSave(storage), {
    ok: true,
    record: { version: 5, state, position: { x: 44, y: 82 }, mapId: 'training' }
  });
});

test('bad JSON and unsupported versions are rejected without deletion', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{broken');
  assert.equal(loadSave(storage).reason, 'invalid-json');
  assert.equal(storage.getItem(SAVE_KEY), '{broken');

  const wrongVersion = JSON.stringify({ version: 99 });
  storage.setItem(SAVE_KEY, wrongVersion);
  assert.equal(loadSave(storage).reason, 'unsupported-version');
  assert.equal(storage.getItem(SAVE_KEY), wrongVersion);
});

test('invalid shapes are rejected and an interrupted training round is closed', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 5, state: {}, position: { x: 0, y: 0 }, mapId: 'training' }));
  assert.equal(loadSave(storage).reason, 'invalid-shape');

  const state = { ...createGameState(), episode: { ...createEpisodeState(), activePromise: 'train' } };
  state.training.started = true;
  state.namingRights.freeTime.activeAction = { dayIndex: 11, actionId: 'shop' };
  writeSave(storage, state, { x: 50, y: 89 });
  const loaded = loadSave(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.state.training.started, false);
  assert.equal(loaded.record.state.episode.activePromise, null);
  assert.equal(loaded.record.state.namingRights.freeTime.activeAction, null);
});

test('a valid version one save migrates in memory without overwriting the legacy record', () => {
  const storage = memoryStorage();
  const current = createGameState();
  const legacyState = {
    ...current,
    version: 1,
    dayIndex: 2,
    phase: 'complete',
    chapterComplete: true,
    money: 29
  };
  for (const key of ['campaign', 'economy', 'facilities', 'roster', 'governance', 'management', 'world', 'communitySupport']) {
    delete legacyState[key];
  }
  const raw = JSON.stringify({ version: 1, state: legacyState, position: { x: 50, y: 89 } });
  storage.setItem(LEGACY_SAVE_KEY, raw);

  const loaded = loadSave(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.record.version, 5);
  assert.equal(loaded.record.state.economy.cash, 29);
  assert.equal(loaded.record.state.episode.id, 'last-roster-slot');
  assert.equal(storage.getItem(LEGACY_SAVE_KEY), raw);
  assert.equal(storage.getItem(SAVE_KEY), null);
});

test('an unfinished version two management week restarts spring 15 in memory', () => {
  const storage = memoryStorage();
  const current = createGameState();
  const v2State = {
    ...current,
    version: 2,
    dayIndex: 6,
    phase: 'morning',
    money: 63,
    repairs: ['awning'],
    relationship: { coachMet: true, coachTrust: 2 },
    management: { ...current.management, completedActions: ['review-ledger'], dailyRecords: [], weekComplete: false }
  };
  delete v2State.episode;
  const raw = JSON.stringify({ version: 2, state: v2State, position: { x: 70, y: 67 }, mapId: 'stadium' });
  storage.setItem(V2_SAVE_KEY, raw);
  const loaded = loadSave(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.record.version, 5);
  assert.equal(loaded.record.state.dayIndex, 3);
  assert.equal(loaded.record.state.phase, 'morning');
  assert.deepEqual(loaded.record.state.repairs, ['awning']);
  assert.equal(loaded.record.state.relationship.coachTrust, 2);
  assert.equal(loaded.record.state.episode.sceneId, 'blank-notice');
  assert.equal(storage.getItem(V2_SAVE_KEY), raw);
});

test('clearSave removes only the project save key', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ anything: true }));
  storage.setItem(V4_SAVE_KEY, JSON.stringify({ namingWeek: true }));
  storage.setItem(V2_SAVE_KEY, JSON.stringify({ legacyWeek: true }));
  storage.setItem(V3_SAVE_KEY, JSON.stringify({ legacyEpisode: true }));
  storage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ legacy: true }));
  storage.setItem('another-game', 'keep');
  clearSave(storage);
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(storage.getItem(V4_SAVE_KEY), null);
  assert.equal(storage.getItem(V2_SAVE_KEY), null);
  assert.equal(storage.getItem(V3_SAVE_KEY), null);
  assert.equal(storage.getItem(LEGACY_SAVE_KEY), null);
  assert.equal(storage.getItem('another-game'), 'keep');
});

test('a version four naming-week save migrates in memory to an inactive league', () => {
  const storage = memoryStorage();
  const current = createGameState();
  const state = {
    ...current,
    version: 4,
    dayIndex: 16,
    phase: 'complete',
    namingRights: {
      ...current.namingRights,
      weekComplete: true,
      settlement: { stadiumName: '海风球场', route: 'community-save' }
    }
  };
  delete state.season;
  const raw = JSON.stringify({ version: 4, state, position: { x: 52, y: 68 }, mapId: 'stadium' });
  storage.setItem(V4_SAVE_KEY, raw);

  const loaded = loadSave(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.record.version, 5);
  assert.equal(loaded.record.state.namingRights.settlement.stadiumName, '海风球场');
  assert.equal(loaded.record.state.season.active, false);
  assert.equal(storage.getItem(V4_SAVE_KEY), raw);
  assert.equal(storage.getItem(SAVE_KEY), null);
});

test('an interrupted league match restarts without spending weekly preparation', () => {
  const storage = memoryStorage();
  const state = createGameState();
  state.season.active = true;
  state.season.seasonNumber = 1;
  state.season.week.actions = ['train-attack', 'shop-day', 'community-open'];
  state.season.match = {
    opponentId: 'harbor-workers',
    playerHome: true,
    highlightIndex: 1,
    homeGoals: 1,
    awayGoals: 0,
    choices: ['use-attack-work'],
    callbackIds: ['attack'],
    complete: false,
    snapshot: { attack: 50, defense: 50, cohesion: 50, facility: 50, cash: 80 }
  };
  writeSave(storage, state, { x: 52, y: 68 }, 'stadium');
  const loaded = loadSave(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.state.season.match, null);
  assert.deepEqual(loaded.record.state.season.week.actions, ['train-attack', 'shop-day', 'community-open']);
});
