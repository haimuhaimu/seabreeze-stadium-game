import { createGameState } from './game-state.js';
import { createEconomy } from './economy-state.js';

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
    version: 2,
    state: {
      ...base,
      ...legacy,
      version: 2,
      inventory: { ...base.inventory, ...legacy.inventory },
      collectedToday: [...legacy.collectedToday],
      repairs: [...legacy.repairs],
      relationship: { ...base.relationship, ...legacy.relationship },
      training: { ...base.training, ...legacy.training, started: false },
      events: [...legacy.events],
      journal: legacy.journal.map(entry => ({ ...entry })),
      history: legacy.history.map(entry => ({ ...entry })),
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
