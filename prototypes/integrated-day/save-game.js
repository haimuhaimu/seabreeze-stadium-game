import { migrateV1Record } from './save-migration.js';

export const SAVE_KEY = 'seabreeze-club-save-v2';
export const LEGACY_SAVE_KEY = 'seabreeze-club-save-v1';

const PHASES = new Set(['morning', 'shop', 'evening', 'complete']);
const REPAIR_IDS = new Set(['net', 'awning', 'bleachers']);
const MAP_IDS = new Set(['training', 'stadium']);

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function validPosition(position) {
  return Boolean(
    position
    && Number.isFinite(position.x)
    && Number.isFinite(position.y)
    && position.x >= 0
    && position.x <= 100
    && position.y >= 0
    && position.y <= 100
  );
}

function validInventory(inventory) {
  return inventory
    && ['tea', 'fruit', 'cloth', 'water'].every(key => isFiniteNonNegative(inventory[key]));
}

function validPrologueFields(state, maxDayIndex) {
  return Boolean(
    state
    && typeof state === 'object'
    && Number.isInteger(state.dayIndex)
    && state.dayIndex >= 0
    && state.dayIndex <= maxDayIndex
    && PHASES.has(state.phase)
    && isFiniteNonNegative(state.minute)
    && isFiniteNonNegative(state.energy)
    && Number.isFinite(state.money)
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

function validV1Record(record) {
  return Boolean(
    record
    && record.version === 1
    && record.state?.version === 1
    && validPrologueFields(record.state, 2)
    && isFiniteNonNegative(record.state.money)
    && validPosition(record.position)
  );
}

function validV2State(state) {
  return Boolean(
    state?.version === 2
    && validPrologueFields(state, 9)
    && state.campaign
    && typeof state.campaign.prologueComplete === 'boolean'
    && Number.isInteger(state.campaign.week)
    && state.economy
    && Number.isFinite(state.economy.cash)
    && Array.isArray(state.economy.entries)
    && state.facilities
    && isFiniteNonNegative(state.facilities.condition)
    && state.roster
    && isFiniteNonNegative(state.roster.cohesion)
    && state.governance
    && isFiniteNonNegative(state.governance.support)
    && isFiniteNonNegative(state.governance.shenInfluence)
    && isFiniteNonNegative(state.communitySupport)
    && state.management
    && Array.isArray(state.management.completedActions)
    && Array.isArray(state.management.dailyRecords)
    && typeof state.management.shortfallPending === 'boolean'
    && typeof state.management.weekComplete === 'boolean'
    && state.world
    && MAP_IDS.has(state.world.mapId)
    && state.world.positions
    && validPosition(state.world.positions.training)
    && validPosition(state.world.positions.stadium)
  );
}

export function validateSaveRecord(record) {
  return Boolean(
    record
    && record.version === 2
    && validV2State(record.state)
    && validPosition(record.position)
    && MAP_IDS.has(record.mapId)
  );
}

function parseRecord(raw) {
  try {
    return { ok: true, record: JSON.parse(raw) };
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
}

function closeInterruptedTraining(record) {
  if (!record.state.training.started) return record;
  return {
    ...record,
    state: {
      ...record.state,
      training: { ...record.state.training, started: false }
    }
  };
}

export function loadSave(storage) {
  const currentRaw = storage.getItem(SAVE_KEY);
  if (currentRaw !== null) {
    const parsed = parseRecord(currentRaw);
    if (!parsed.ok) return parsed;
    if (!parsed.record || parsed.record.version !== 2) return { ok: false, reason: 'unsupported-version' };
    if (!validateSaveRecord(parsed.record)) return { ok: false, reason: 'invalid-shape' };
    return { ok: true, record: closeInterruptedTraining(parsed.record) };
  }

  const legacyRaw = storage.getItem(LEGACY_SAVE_KEY);
  if (legacyRaw === null) return { ok: false, reason: 'absent' };
  const parsed = parseRecord(legacyRaw);
  if (!parsed.ok) return parsed;
  if (!parsed.record || parsed.record.version !== 1) return { ok: false, reason: 'unsupported-version' };
  if (!validV1Record(parsed.record)) return { ok: false, reason: 'invalid-shape' };
  const migrated = migrateV1Record(parsed.record);
  return { ok: true, record: closeInterruptedTraining(migrated), migrated: true };
}

export function writeSave(storage, state, position, mapId = state.world?.mapId ?? 'training') {
  const record = { version: 2, state, position, mapId };
  if (!validateSaveRecord(record)) throw new TypeError('Invalid save record');
  storage.setItem(SAVE_KEY, JSON.stringify(record));
  return record;
}

export function clearSave(storage) {
  storage.removeItem(SAVE_KEY);
  storage.removeItem(LEGACY_SAVE_KEY);
}
