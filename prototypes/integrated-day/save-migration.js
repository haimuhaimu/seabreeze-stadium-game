import { createGameState } from './game-state.js';
import { createEconomy, postLedgerEntry } from './economy-state.js';
import { createEpisodeState } from './episode-state.js';

function copyCommon(base, legacy) {
  return {
    ...base,
    ...legacy,
    version: 3,
    inventory: { ...base.inventory, ...legacy.inventory },
    collectedToday: [...legacy.collectedToday],
    repairs: [...legacy.repairs],
    relationship: { ...base.relationship, ...legacy.relationship },
    training: { ...base.training, ...legacy.training, started: false },
    events: [...legacy.events],
    journal: legacy.journal.map(entry => ({ ...entry })),
    history: legacy.history.map(entry => ({ ...entry })),
    episode: createEpisodeState()
  };
}

function createOpeningWeekEconomy(startCash) {
  let economy = createEconomy(startCash);
  economy = postLedgerEntry(economy, { id: 'community-deposit', label: '社区预约金', amount: 120 });
  economy = postLedgerEntry(economy, { id: 'weekly-wages', label: '本周工资', amount: -70 });
  economy = postLedgerEntry(economy, { id: 'basic-maintenance', label: '基础维护', amount: -30 });
  return economy;
}

export function migrateV1Record(record) {
  if (record?.version !== 1 || record?.state?.version !== 1) {
    throw new TypeError('Unsupported legacy save');
  }
  if (!record.position || !Number.isFinite(record.position.x) || !Number.isFinite(record.position.y)) {
    throw new TypeError('Invalid legacy position');
  }

  const base = createGameState();
  const legacy = record.state;
  return {
    version: 3,
    state: {
      ...copyCommon(base, legacy),
      campaign: {
        ...base.campaign,
        prologueComplete: Boolean(legacy.chapterComplete)
      },
      economy: createEconomy(legacy.money),
      facilities: { ...base.facilities },
      roster: { ...base.roster },
      governance: { ...base.governance },
      management: {
        ...base.management,
        completedActions: [],
        dailyRecords: []
      },
      world: {
        ...base.world,
        mapId: 'training',
        positions: {
          ...base.world.positions,
          training: { ...record.position }
        }
      }
    },
    position: { ...record.position },
    mapId: 'training'
  };
}

export function migrateV2Record(record) {
  if (record?.version !== 2 || record?.state?.version !== 2) {
    throw new TypeError('Unsupported version two save');
  }
  const legacy = record.state;
  const base = createGameState();
  const migrated = copyCommon(base, legacy);

  if (legacy.dayIndex < 3) {
    migrated.campaign = { ...base.campaign, ...legacy.campaign };
    migrated.economy = { ...legacy.economy, entries: legacy.economy.entries.map(entry => ({ ...entry })) };
    migrated.facilities = { ...base.facilities, ...legacy.facilities };
    migrated.roster = { ...base.roster, ...legacy.roster };
    migrated.governance = { ...base.governance, ...legacy.governance };
    migrated.management = {
      ...base.management,
      completedActions: [],
      dailyRecords: []
    };
    migrated.world = {
      ...base.world,
      ...legacy.world,
      positions: Object.fromEntries(Object.entries(legacy.world.positions).map(([id, point]) => [id, { ...point }]))
    };
    return { version: 3, state: migrated, position: { ...record.position }, mapId: record.mapId };
  }

  const prologueCash = legacy.history.at(-1)?.money ?? legacy.money;
  migrated.dayIndex = 3;
  migrated.phase = 'morning';
  migrated.minute = 550;
  migrated.energy = 100;
  migrated.money = prologueCash + 20;
  migrated.chapterComplete = false;
  migrated.campaign = {
    ...base.campaign,
    prologueComplete: true,
    week: 1,
    legacyWeekComplete: Boolean(legacy.management.weekComplete)
  };
  migrated.economy = createOpeningWeekEconomy(prologueCash);
  migrated.facilities = { ...base.facilities };
  migrated.roster = { ...base.roster };
  migrated.governance = { ...base.governance };
  migrated.communitySupport = base.communitySupport;
  migrated.management = {
    ...base.management,
    completedActions: [],
    dailyRecords: [],
    opponentId: 'city-university'
  };
  migrated.world = {
    ...base.world,
    mapId: 'stadium',
    positions: Object.fromEntries(Object.entries(base.world.positions).map(([id, point]) => [id, { ...point }]))
  };
  migrated.journal = [{
    kind: 'mainline',
    text: '新的第一周从办公室桌上的空白通知重新开始。',
    minute: 550
  }];

  return {
    version: 3,
    state: migrated,
    position: { ...migrated.world.positions.stadium },
    mapId: 'stadium'
  };
}

