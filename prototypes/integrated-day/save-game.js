export const SAVE_KEY = 'seabreeze-club-save-v1';

const PHASES = new Set(['morning', 'shop', 'evening', 'complete']);
const REPAIR_IDS = new Set(['net', 'awning', 'bleachers']);

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function validInventory(inventory) {
  return inventory
    && ['tea', 'fruit', 'cloth', 'water'].every(key => isFiniteNonNegative(inventory[key]));
}

function validState(state) {
  return Boolean(
    state
    && typeof state === 'object'
    && state.version === 1
    && Number.isInteger(state.dayIndex)
    && state.dayIndex >= 0
    && state.dayIndex <= 2
    && PHASES.has(state.phase)
    && isFiniteNonNegative(state.minute)
    && isFiniteNonNegative(state.energy)
    && isFiniteNonNegative(state.money)
    && validInventory(state.inventory)
    && Array.isArray(state.collectedToday)
    && Number.isInteger(state.ordersServed)
    && state.ordersServed >= 0
    && Array.isArray(state.repairs)
    && state.repairs.every(repair => REPAIR_IDS.has(repair))
    && state.relationship
    && typeof state.relationship.coachMet === 'boolean'
    && isFiniteNonNegative(state.relationship.coachTrust)
    && state.training
    && typeof state.training.started === 'boolean'
    && typeof state.training.completedToday === 'boolean'
    && Array.isArray(state.events)
    && Array.isArray(state.journal)
    && Array.isArray(state.history)
    && typeof state.chapterComplete === 'boolean'
  );
}

export function validateSaveRecord(record) {
  return Boolean(
    record
    && typeof record === 'object'
    && record.version === 1
    && validState(record.state)
    && record.position
    && Number.isFinite(record.position.x)
    && Number.isFinite(record.position.y)
    && record.position.x >= 0
    && record.position.x <= 100
    && record.position.y >= 0
    && record.position.y <= 100
  );
}

export function loadSave(storage) {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return { ok: false, reason: 'absent' };

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }

  if (!record || record.version !== 1) {
    return { ok: false, reason: 'unsupported-version' };
  }
  if (!validateSaveRecord(record)) {
    return { ok: false, reason: 'invalid-shape' };
  }

  if (record.state.training.started) {
    record.state = {
      ...record.state,
      training: { ...record.state.training, started: false }
    };
  }
  return { ok: true, record };
}

export function writeSave(storage, state, position) {
  const record = { version: 1, state, position };
  if (!validateSaveRecord(record)) throw new TypeError('Invalid save record');
  storage.setItem(SAVE_KEY, JSON.stringify(record));
  return record;
}

export function clearSave(storage) {
  storage.removeItem(SAVE_KEY);
}
