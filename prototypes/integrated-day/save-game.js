import { migrateV1Record, migrateV2Record, migrateV3Record, migrateV4Record } from './save-migration.js';

export const SAVE_KEY = 'seabreeze-club-save-v5';
export const V4_SAVE_KEY = 'seabreeze-club-save-v4';
export const V3_SAVE_KEY = 'seabreeze-club-save-v3';
export const V2_SAVE_KEY = 'seabreeze-club-save-v2';
export const LEGACY_SAVE_KEY = 'seabreeze-club-save-v1';

const PHASES = new Set(['morning', 'shop', 'evening', 'complete']);
const REPAIR_IDS = new Set(['net', 'awning', 'bleachers']);
const MAP_IDS = new Set(['training', 'stadium']);
const SEASON_PROJECT_IDS = ['stands', 'clinic', 'academy', 'market', 'lights'];
const SEASON_NPC_IDS = ['coach-guo', 'lin-chuan', 'aunt-xu', 'xiaoman', 'shen-qiao', 'director-luo'];

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

function validNamingRights(namingRights) {
  const validMatch = namingRights?.match === null || Boolean(
    Number.isInteger(namingRights.match.highlightIndex)
    && isFiniteNonNegative(namingRights.match.homeGoals)
    && isFiniteNonNegative(namingRights.match.awayGoals)
    && Array.isArray(namingRights.match.choices)
    && Array.isArray(namingRights.match.callbackIds)
    && typeof namingRights.match.complete === 'boolean'
  );
  return Boolean(
    namingRights?.id === 'naming-rights'
    && Array.isArray(namingRights.sceneHistory)
    && namingRights.freeTime
    && Array.isArray(namingRights.freeTime.records)
    && (namingRights.freeTime.activeAction === null || typeof namingRights.freeTime.activeAction === 'object')
    && (namingRights.voteRoute === null || ['co-name', 'community-save', 'delay'].includes(namingRights.voteRoute))
    && (namingRights.response === null || ['restore-history', 'name-as-repair', 'after-match'].includes(namingRights.response))
    && typeof namingRights.weekComplete === 'boolean'
    && validMatch
    && (namingRights.settlement === null || typeof namingRights.settlement === 'object')
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

function validV3Record(record) {
  return Boolean(
    record
    && record.version === 3
    && validV3State(record.state)
    && validPosition(record.position)
    && MAP_IDS.has(record.mapId)
  );
}

function validV4State(state) {
  return Boolean(
    state?.version === 4
    && validPrologueFields(state, 16)
    && validManagementState(state)
    && validEpisode(state.episode)
    && validNamingRights(state.namingRights)
  );
}

function validSeasonMatch(match) {
  return match === null || Boolean(
    match
    && typeof match.opponentId === 'string'
    && typeof match.playerHome === 'boolean'
    && Number.isInteger(match.highlightIndex)
    && isFiniteNonNegative(match.homeGoals)
    && isFiniteNonNegative(match.awayGoals)
    && Array.isArray(match.choices)
    && Array.isArray(match.callbackIds)
    && typeof match.complete === 'boolean'
    && match.snapshot
    && ['attack', 'defense', 'cohesion', 'facility', 'cash'].every(key => Number.isFinite(match.snapshot[key]))
  );
}

function validSeason(season) {
  return Boolean(
    season?.id === 'haifeng-league'
    && typeof season.active === 'boolean'
    && Number.isInteger(season.seasonNumber)
    && season.seasonNumber >= 0
    && Number.isInteger(season.roundIndex)
    && season.roundIndex >= 0
    && season.roundIndex <= 6
    && season.week
    && Array.isArray(season.week.actions)
    && Array.isArray(season.week.talkedNpcIds)
    && season.week.npcResponses
    && typeof season.week.npcResponses === 'object'
    && Array.isArray(season.week.helpTags)
    && typeof season.week.roundComplete === 'boolean'
    && SEASON_PROJECT_IDS.every(id => Number.isInteger(season.projects?.[id]) && season.projects[id] >= 0 && season.projects[id] <= 3)
    && SEASON_NPC_IDS.every(id => Number.isInteger(season.relationships?.[id]) && season.relationships[id] >= 0 && season.relationships[id] <= 5)
    && Array.isArray(season.standings)
    && season.standings.length === 8
    && season.standings.every(row => row && typeof row.teamId === 'string' && Number.isInteger(row.played) && isFiniteNonNegative(row.points))
    && validSeasonMatch(season.match)
    && Array.isArray(season.roundHistory)
    && typeof season.seasonComplete === 'boolean'
    && typeof season.eliteQualified === 'boolean'
    && (season.goals === null || typeof season.goals === 'object')
  );
}

function validV5State(state) {
  return Boolean(
    state?.version === 5
    && validPrologueFields(state, 23)
    && validManagementState(state)
    && validEpisode(state.episode)
    && validNamingRights(state.namingRights)
    && validSeason(state.season)
  );
}

export function validateSaveRecord(record) {
  return Boolean(
    record
    && record.version === 5
    && validV5State(record.state)
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
  const freeActionStarted = Boolean(record.state.namingRights?.freeTime?.activeAction);
  const seasonMatchStarted = Boolean(record.state.season?.match && !record.state.season.week.roundComplete);
  if (!trainingStarted && !episodeStarted && !freeActionStarted && !seasonMatchStarted) return record;
  return {
    ...record,
    state: {
      ...record.state,
      training: { ...record.state.training, started: false },
      episode: { ...record.state.episode, activePromise: null },
      namingRights: record.state.namingRights ? {
        ...record.state.namingRights,
        freeTime: { ...record.state.namingRights.freeTime, activeAction: null, available: true }
      } : record.state.namingRights,
      season: seasonMatchStarted ? { ...record.state.season, match: null } : record.state.season
    }
  };
}

function loadAndValidate(raw, version) {
  const parsed = parseRecord(raw);
  if (!parsed.ok) return parsed;
  if (!parsed.record || parsed.record.version !== version) return { ok: false, reason: 'unsupported-version' };
  const valid = version === 5
    ? validateSaveRecord(parsed.record)
    : version === 4
      ? Boolean(validV4State(parsed.record.state) && validPosition(parsed.record.position) && MAP_IDS.has(parsed.record.mapId))
      : version === 3
      ? validV3Record(parsed.record)
      : version === 2
        ? validV2Record(parsed.record)
        : validV1Record(parsed.record);
  if (!valid) return { ok: false, reason: 'invalid-shape' };
  return parsed;
}

export function loadSave(storage) {
  const currentRaw = storage.getItem(SAVE_KEY);
  if (currentRaw !== null) {
    const loaded = loadAndValidate(currentRaw, 5);
    if (!loaded.ok) return loaded;
    return { ok: true, record: closeInterruptedActivities(loaded.record) };
  }

  const versionFourRaw = storage.getItem(V4_SAVE_KEY);
  if (versionFourRaw !== null) {
    const loaded = loadAndValidate(versionFourRaw, 4);
    if (!loaded.ok) return loaded;
    return { ok: true, record: closeInterruptedActivities(migrateV4Record(loaded.record)), migrated: true };
  }

  const versionThreeRaw = storage.getItem(V3_SAVE_KEY);
  if (versionThreeRaw !== null) {
    const loaded = loadAndValidate(versionThreeRaw, 3);
    if (!loaded.ok) return loaded;
    return { ok: true, record: closeInterruptedActivities(migrateV3Record(loaded.record)), migrated: true };
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
  const record = { version: 5, state, position, mapId };
  if (!validateSaveRecord(record)) throw new TypeError('Invalid save record');
  storage.setItem(SAVE_KEY, JSON.stringify(record));
  return record;
}

export function clearSave(storage) {
  storage.removeItem(SAVE_KEY);
  storage.removeItem(V4_SAVE_KEY);
  storage.removeItem(V3_SAVE_KEY);
  storage.removeItem(V2_SAVE_KEY);
  storage.removeItem(LEGACY_SAVE_KEY);
}
