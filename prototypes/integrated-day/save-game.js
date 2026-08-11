import { migrateV1Record, migrateV2Record } from './save-migration.js';

export const SAVE_KEY = 'seabreeze-club-save-v3';
export const V2_SAVE_KEY = 'seabreeze-club-save-v2';
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

function validManagementState(state) {
  return Boolean(
    state.campaign
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

function validEpisode(episode) {
  return Boolean(
    episode?.id === 'last-roster-slot'
    && Array.isArray(episode.sceneHistory)
    && Array.isArray(episode.promisesChosen)
    && Array.isArray(episode.promisesCompleted)
    && Array.isArray(episode.matchChoices)
    && Number.isFinite(episode.xiaomanTrust)
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

function validV2Record(record) {
  return Boolean(
    record
    && record.version === 2
    && record.state?.version === 2
    && validPrologueFields(record.state, 9)
    && validManagementState(record.state)
    && validPosition(record.position)
    && MAP_IDS.has(record.mapId)
  );
}

function validV3State(state) {
  return Boolean(
    state?.version === 3
    && validPrologueFields(state, 9)
    && validManagementState(state)
    && validEpisode(state.episode)
  );
}

export function validateSaveRecord(record) {
  return Boolean(
    record
    && record.version === 3
    && validV3State(record.state)
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

function closeInterruptedActivities(record) {
  const trainingStarted = record.state.training.started;
  const episodeStarted = Boolean(record.state.episode.activePromise);
  if (!trainingStarted && !episodeStarted) return record;
  return {
    ...record,
    state: {
      ...record.state,
      training: { ...record.state.training, started: false },
      episode: { ...record.state.episode, activePromise: null }
    }
  };
}

function loadAndValidate(raw, version) {
  const parsed = parseRecord(raw);
  if (!parsed.ok) return parsed;
  if (!parsed.record || parsed.record.version !== version) return { ok: false, reason: 'unsupported-version' };
  const valid = version === 3
    ? validateSaveRecord(parsed.record)
    : version === 2
      ? validV2Record(parsed.record)
      : validV1Record(parsed.record);
  if (!valid) return { ok: false, reason: 'invalid-shape' };
  return parsed;
}

export function loadSave(storage) {
  const currentRaw = storage.getItem(SAVE_KEY);
  if (currentRaw !== null) {
    const loaded = loadAndValidate(currentRaw, 3);
    if (!loaded.ok) return loaded;
    return { ok: true, record: closeInterruptedActivities(loaded.record) };
  }

  const versionTwoRaw = storage.getItem(V2_SAVE_KEY);
  if (versionTwoRaw !== null) {
    const loaded = loadAndValidate(versionTwoRaw, 2);
    if (!loaded.ok) return loaded;
    return { ok: true, record: closeInterruptedActivities(migrateV2Record(loaded.record)), migrated: true };
  }

  const legacyRaw = storage.getItem(LEGACY_SAVE_KEY);
  if (legacyRaw === null) return { ok: false, reason: 'absent' };
  const loaded = loadAndValidate(legacyRaw, 1);
  if (!loaded.ok) return loaded;
  return { ok: true, record: closeInterruptedActivities(migrateV1Record(loaded.record)), migrated: true };
}

export function writeSave(storage, state, position, mapId = state.world?.mapId ?? 'training') {
  const record = { version: 3, state, position, mapId };
  if (!validateSaveRecord(record)) throw new TypeError('Invalid save record');
  storage.setItem(SAVE_KEY, JSON.stringify(record));
  return record;
}

export function clearSave(storage) {
  storage.removeItem(SAVE_KEY);
  storage.removeItem(V2_SAVE_KEY);
  storage.removeItem(LEGACY_SAVE_KEY);
}

