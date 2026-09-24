import { getFreeAction } from './naming-rights-content.js';

const FREE_TIME_DAYS = new Set([11, 12, 13, 15]);
const REWARD_KEYS = Object.freeze(['fund', 'community', 'cohesion', 'facility', 'signatures']);

export function createFreeTimeState() {
  return {
    available: false,
    activeAction: null,
    records: []
  };
}

export function cloneFreeTimeState(state) {
  return {
    ...state,
    activeAction: state.activeAction ? { ...state.activeAction } : null,
    records: state.records.map(record => ({ ...record }))
  };
}

export function canTakeFreeAction(state, dayIndex) {
  return Boolean(
    state
    && FREE_TIME_DAYS.has(dayIndex)
    && !state.activeAction
    && !state.records.some(record => record.dayIndex === dayIndex)
  );
}

export function startFreeAction(state, dayIndex, actionId) {
  getFreeAction(actionId);
  if (state.activeAction) throw new Error('Free action already active');
  if (!canTakeFreeAction(state, dayIndex)) throw new Error('Free action unavailable');
  return {
    ...cloneFreeTimeState(state),
    available: true,
    activeAction: { dayIndex, actionId }
  };
}

export function finishFreeAction(state, result = {}) {
  if (!state.activeAction) throw new Error('No active free action');
  const action = getFreeAction(state.activeAction.actionId);
  const previous = state.records.at(-1);
  const repeated = previous?.actionId === state.activeAction.actionId;
  const numericScore = Number(result.score);
  const quality = Math.max(0.5, Math.min(1, Number.isFinite(numericScore) ? numericScore : 0.5));
  const repetitionMultiplier = repeated ? 0.75 : 1;
  const reward = key => Math.round(action[key] * quality * repetitionMultiplier);
  const record = {
    ...state.activeAction,
    repeated,
    quality,
    fund: reward('fund'),
    community: reward('community'),
    cohesion: reward('cohesion'),
    facility: reward('facility'),
    signatures: reward('signatures'),
    evidence: action.evidence || result.evidence ? 1 : 0
  };
  return {
    available: false,
    activeAction: null,
    records: [...state.records.map(item => ({ ...item })), record]
  };
}

export function getFreeActionTotals(state) {
  return state.records.reduce((totals, record) => {
    for (const key of REWARD_KEYS) totals[key] += Number(record[key]) || 0;
    totals.evidence += Number(record.evidence) || 0;
    return totals;
  }, {
    fund: 0,
    community: 0,
    cohesion: 0,
    facility: 0,
    signatures: 0,
    evidence: 0
  });
}
