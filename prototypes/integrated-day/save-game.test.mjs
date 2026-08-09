import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from './game-state.js';
import { SAVE_KEY, loadSave, writeSave, clearSave } from './save-game.js';

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
    record: { version: 1, state, position: { x: 44, y: 82 } }
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
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: {}, position: { x: 0, y: 0 } }));
  assert.equal(loadSave(storage).reason, 'invalid-shape');

  const state = createGameState();
  state.training.started = true;
  writeSave(storage, state, { x: 50, y: 89 });
  const loaded = loadSave(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.state.training.started, false);
});

test('clearSave removes only the project save key', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ anything: true }));
  storage.setItem('another-game', 'keep');
  clearSave(storage);
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(storage.getItem('another-game'), 'keep');
});
