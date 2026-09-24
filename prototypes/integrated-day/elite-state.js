import {
  ELITE_MOMENTS,
  ELITE_RESULTS,
  getElitePreparation
} from './elite-content.js';

const RESULT_WEIGHTS = Object.freeze({ attended: 1, recognized: 2, champion: 3 });

export function createEliteState() {
  return {
    status: 'idle',
    invitedSeasonNumber: null,
    preparationId: null,
    match: null,
    result: null,
    history: [],
    bestResultId: null
  };
}

export function cloneEliteState(state) {
  const source = state ?? createEliteState();
  return {
    status: source.status ?? 'idle',
    invitedSeasonNumber: source.invitedSeasonNumber ?? null,
    preparationId: source.preparationId ?? null,
    match: source.match ? {
      ...source.match,
      choices: [...source.match.choices],
      callbackIds: [...source.match.callbackIds],
      snapshot: { ...source.match.snapshot }
    } : null,
    result: source.result ? {
      ...source.result,
      choices: [...source.result.choices],
      callbackIds: [...source.result.callbackIds]
    } : null,
    history: (source.history ?? []).map(entry => ({
      ...entry,
      choices: [...entry.choices],
      callbackIds: [...entry.callbackIds]
    })),
    bestResultId: source.bestResultId ?? null
  };
}

export function offerEliteInvitation(state, seasonNumber) {
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) throw new TypeError('Invalid elite season number');
  if ((state?.status ?? 'idle') !== 'idle') throw new Error('Elite invitation already active');
  const next = cloneEliteState(state);
  next.status = 'invited';
  next.invitedSeasonNumber = seasonNumber;
  next.preparationId = null;
  next.match = null;
  next.result = null;
  return next;
}

function validSnapshot(snapshot) {
  return snapshot
    && typeof snapshot.ranking === 'boolean'
    && typeof snapshot.construction === 'boolean';
}

export function startEliteMatch(state, preparationId, snapshot) {
  if (state?.status !== 'invited') throw new Error('No elite invitation is available');
  getElitePreparation(preparationId);
  if (!validSnapshot(snapshot)) throw new TypeError('Invalid elite snapshot');
  const next = cloneEliteState(state);
  next.status = 'match';
  next.preparationId = preparationId;
  next.match = {
    momentIndex: 0,
    homeGoals: 0,
    awayGoals: 2,
    choices: [],
    callbackIds: [],
    complete: false,
    snapshot: { ...snapshot }
  };
  next.result = null;
  return next;
}

function callbackReady(state, callback) {
  if (!callback) return false;
  if (callback === 'ranking') return state.match.snapshot.ranking;
  if (callback === 'construction') return state.match.snapshot.construction;
  if (callback.startsWith('preparation:')) return callback === `preparation:${state.preparationId}`;
  return false;
}

export function getEliteMatchMoment(state) {
  if (state?.status !== 'match' || !state.match || state.match.complete) throw new Error('No active elite match');
  const moment = ELITE_MOMENTS[state.match.momentIndex];
  if (!moment) throw new Error('No active elite match moment');
  return {
    ...moment,
    choices: moment.choices.map(item => ({ ...item, effect: { ...item.effect }, callbackReady: callbackReady(state, item.callback) }))
  };
}

function resultIdForScore(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return 'champion';
  if (homeGoals === awayGoals) return 'recognized';
  return 'attended';
}

function betterResult(currentId, nextId) {
  if (!currentId || RESULT_WEIGHTS[nextId] > RESULT_WEIGHTS[currentId]) return nextId;
  return currentId;
}

export function resolveEliteMatchMoment(state, choiceId) {
  const moment = getEliteMatchMoment(state);
  const selected = moment.choices.find(choice => choice.id === choiceId);
  if (!selected) throw new TypeError('Unknown elite match choice');
  const next = cloneEliteState(state);
  const ready = selected.callbackReady;
  next.match.choices.push(choiceId);
  if (ready && selected.callback) next.match.callbackIds.push(selected.callback);
  if (ready) {
    next.match.homeGoals = Math.max(0, next.match.homeGoals + (selected.effect.home ?? 0));
    next.match.awayGoals = Math.max(0, next.match.awayGoals + (selected.effect.away ?? 0));
  }
  next.match.momentIndex += 1;
  if (next.match.momentIndex < ELITE_MOMENTS.length) return next;

  next.match.complete = true;
  next.status = 'complete';
  const resultId = resultIdForScore(next.match.homeGoals, next.match.awayGoals);
  const resultContent = ELITE_RESULTS[resultId];
  next.result = {
    id: resultId,
    seasonNumber: next.invitedSeasonNumber,
    preparationId: next.preparationId,
    homeGoals: next.match.homeGoals,
    awayGoals: next.match.awayGoals,
    choices: [...next.match.choices],
    callbackIds: [...next.match.callbackIds],
    label: resultContent.label,
    copy: resultContent.copy
  };
  next.history.push({ ...next.result, choices: [...next.result.choices], callbackIds: [...next.result.callbackIds] });
  next.bestResultId = betterResult(next.bestResultId, resultId);
  return next;
}

export function declineEliteInvitation(state) {
  if (state?.status === 'match') throw new Error('Elite match is active');
  if (!['invited', 'complete'].includes(state?.status)) throw new Error('No elite invitation to close');
  const next = cloneEliteState(state);
  next.status = 'idle';
  next.invitedSeasonNumber = null;
  next.preparationId = null;
  next.match = null;
  next.result = null;
  return next;
}
