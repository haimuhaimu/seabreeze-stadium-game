import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from './game-state.js';
import { SAVE_KEY, LEGACY_SAVE_KEY, loadSave, writeSave, clearSave } from './save-game.js';

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
  const state = createGameState();
  writeSave(storage, state, { x: 44, y: 82 });
  assert.deepEqual(loadSave(storage), {
    ok: true,
    record: { version: 2, state, position: { x: 44, y: 82 }, mapId: 'training' }
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
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, state: {}, position: { x: 0, y: 0 }, mapId: 'training' }));
  assert.equal(loadSave(storage).reason, 'invalid-shape');

  const state = createGameState();
  state.training.started = true;
  writeSave(storage, state, { x: 50, y: 89 });
  const loaded = loadSave(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.state.training.started, false);
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
  assert.equal(loaded.record.version, 2);
  assert.equal(loaded.record.state.economy.cash, 29);
  assert.equal(storage.getItem(LEGACY_SAVE_KEY), raw);
  assert.equal(storage.getItem(SAVE_KEY), null);
});

test('clearSave removes only the project save key', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ anything: true }));
  storage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ legacy: true }));
  storage.setItem('another-game', 'keep');
  clearSave(storage);
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(storage.getItem(LEGACY_SAVE_KEY), null);
  assert.equal(storage.getItem('another-game'), 'keep');
});
