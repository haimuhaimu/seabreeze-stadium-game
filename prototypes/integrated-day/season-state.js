import {
  LEAGUE_TEAMS,
  MATCH_MOMENTS,
  SEASON_ACTIONS,
  SEASON_NPCS,
  SEASON_PROJECTS,
  getLeagueTeam,
  getSeasonNpc,
  getSeasonProject,
  getSeasonRound
} from './season-content.js';
import { getSeasonEvent, getSeasonEventChoice } from './season-events.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const PROJECT_IDS = Object.freeze(Object.keys(SEASON_PROJECTS));
const NPC_IDS = Object.freeze(Object.keys(SEASON_NPCS));

const emptyWeek = () => ({
  actions: [],
  talkedNpcIds: [],
  npcResponses: {},
  helpTags: [],
  eventId: null,
  eventChoiceId: null,
  eventTag: null,
  roundComplete: false,
  result: null
});

const emptyStandings = () => LEAGUE_TEAMS.map((team, index) => ({
  teamId: team.id,
  seed: index,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0
}));

export function createSeasonState() {
  return {
    id: 'haifeng-league',
    active: false,
    seasonNumber: 0,
    roundIndex: 0,
    week: emptyWeek(),
    projects: Object.fromEntries(PROJECT_IDS.map(id => [id, 0])),
    relationships: Object.fromEntries(NPC_IDS.map(id => [id, 0])),
    standings: emptyStandings(),
    match: null,
    roundHistory: [],
    eventHistory: [],
    goals: null,
    seasonComplete: false,
    eliteQualified: false
  };
}

export function cloneSeasonState(state) {
  return {
    ...state,
    week: {
      ...state.week,
      actions: [...(state.week.actions ?? [])],
      talkedNpcIds: [...(state.week.talkedNpcIds ?? [])],
      npcResponses: { ...(state.week.npcResponses ?? {}) },
      helpTags: [...(state.week.helpTags ?? [])],
      eventId: state.week.eventId ?? null,
      eventChoiceId: state.week.eventChoiceId ?? null,
      eventTag: state.week.eventTag ?? null,
      result: state.week.result ? { ...state.week.result } : null
    },
    projects: { ...state.projects },
    relationships: { ...state.relationships },
    standings: state.standings.map(row => ({ ...row })),
    match: state.match ? {
      ...state.match,
      choices: [...state.match.choices],
      callbackIds: [...state.match.callbackIds],
      snapshot: { ...state.match.snapshot }
    } : null,
    roundHistory: state.roundHistory.map(entry => ({ ...entry })),
    eventHistory: (state.eventHistory ?? []).map(entry => ({ ...entry })),
    goals: state.goals ? Object.fromEntries(Object.entries(state.goals).map(([key, value]) => [key, { ...value }])) : null
  };
}

export function beginSeason(state) {
  if (state.active && !state.seasonComplete) throw new Error('Season already active');
  const next = cloneSeasonState(state);
  next.active = true;
  next.seasonNumber = Math.max(1, next.seasonNumber || 0);
  next.roundIndex = 0;
  next.week = emptyWeek();
  next.standings = emptyStandings();
  next.match = null;
  next.roundHistory = [];
  next.goals = null;
  next.seasonComplete = false;
  next.eliteQualified = false;
  return next;
}

function assertPlayableWeek(state) {
  if (!state?.active || state.seasonComplete || state.week.roundComplete) throw new Error('No active season week');
}

export function recordSeasonNpcTalk(state, npcId, responseId) {
  assertPlayableWeek(state);
  const npc = getSeasonNpc(npcId);
  if (state.week.talkedNpcIds.includes(npcId)) throw new Error('NPC already talked this round');
  const response = npc.responses.find(item => item.id === responseId);
  if (!response) throw new TypeError('Unknown NPC response');
  const next = cloneSeasonState(state);
  next.week.talkedNpcIds.push(npcId);
  next.week.npcResponses[npcId] = responseId;
  if (!next.week.helpTags.includes(response.help)) next.week.helpTags.push(response.help);
  next.relationships[npcId] = clamp(next.relationships[npcId] + response.bond, 0, 5);
  return next;
}

export function resolveSeasonEvent(state, eventId, choiceId) {
  assertPlayableWeek(state);
  if (state.week.eventChoiceId) throw new Error('Season event already resolved this round');
  const expected = getSeasonEvent(state.roundIndex, state.seasonNumber || 1);
  if (eventId !== expected.id) throw new Error('Season event is not for the current round');
  const selected = getSeasonEventChoice(eventId, choiceId);
  const next = cloneSeasonState(state);
  next.week.eventId = eventId;
  next.week.eventChoiceId = choiceId;
  next.week.eventTag = selected.tag;
  if (!next.week.helpTags.includes(selected.tag)) next.week.helpTags.push(selected.tag);
  for (const [npcId, delta] of Object.entries(selected.relationships)) {
    if (!Object.hasOwn(next.relationships, npcId)) throw new TypeError('Unknown season event relationship');
    next.relationships[npcId] = clamp(next.relationships[npcId] + delta, 0, 5);
  }
  next.eventHistory.push({
    seasonNumber: next.seasonNumber,
    round: next.roundIndex + 1,
    eventId,
    choiceId,
    resultCopy: selected.resultCopy
  });
  return next;
}

function assertActionSlot(state, actionKey) {
  assertPlayableWeek(state);
  if (state.week.actions.includes(actionKey)) throw new Error('Action already completed this round');
  if (state.week.actions.length >= 3) throw new Error('Three actions already completed');
}

export function recordSeasonAction(state, actionId) {
  const action = SEASON_ACTIONS[actionId];
  if (!action) throw new TypeError('Unknown season action');
  assertActionSlot(state, actionId);
  const next = cloneSeasonState(state);
  next.week.actions.push(actionId);
  return next;
}

export function getProjectUpgrade(state, projectId) {
  const project = getSeasonProject(projectId);
  const currentLevel = state.projects[projectId];
  const level = project.levels[currentLevel];
  return level ? { projectId, nextLevel: currentLevel + 1, cost: level.cost, label: level.label } : null;
}

export function upgradeSeasonProject(state, projectId) {
  const project = getSeasonProject(projectId);
  const actionKey = `build:${projectId}`;
  if (state.projects[projectId] >= project.levels.length) throw new Error('Project already complete');
  assertActionSlot(state, actionKey);
  const next = cloneSeasonState(state);
  next.projects[projectId] += 1;
  next.week.actions.push(actionKey);
  return next;
}

export function canStartSeasonMatch(state) {
  return Boolean(
    state?.active
    && !state.seasonComplete
    && !state.week.roundComplete
    && state.week.actions.length === 3
    && Boolean(state.week.eventChoiceId)
    && !state.match
  );
}

function validSnapshot(snapshot) {
  return snapshot
    && ['attack', 'defense', 'cohesion', 'facility', 'cash'].every(key => Number.isFinite(snapshot[key]));
}

function teamRating(snapshot, projects) {
  const projectTotal = Object.values(projects).reduce((sum, value) => sum + value, 0);
  return (snapshot.attack + snapshot.defense) / 2
    + (snapshot.cohesion - 50) * 0.18
    + (snapshot.facility - 50) * 0.08
    + projectTotal * 0.7;
}

export function startSeasonMatch(state, snapshot) {
  if (!canStartSeasonMatch(state)) throw new Error('Complete three weekly actions before the match');
  if (!validSnapshot(snapshot)) throw new TypeError('Invalid season team snapshot');
  const next = cloneSeasonState(state);
  const round = getSeasonRound(next.roundIndex);
  const opponent = getLeagueTeam(round.playerOpponentId);
  const difficulty = opponent.strength + Math.max(0, next.seasonNumber - 1) * 2;
  const gap = difficulty - teamRating(snapshot, next.projects);
  next.match = {
    opponentId: opponent.id,
    playerHome: round.playerHome,
    highlightIndex: 0,
    homeGoals: 0,
    awayGoals: gap >= 18 ? 2 : gap >= 8 ? 1 : 0,
    choices: [],
    callbackIds: [],
    complete: false,
    snapshot: { ...snapshot }
  };
  return next;
}

function actionTags(state) {
  return state.week.actions
    .filter(actionId => SEASON_ACTIONS[actionId])
    .map(actionId => SEASON_ACTIONS[actionId].tag);
}

function callbackReady(state, callback) {
  const tags = actionTags(state);
  if (tags.includes(callback) || state.week.helpTags.includes(callback)) return true;
  if (PROJECT_IDS.includes(callback) && state.projects[callback] > 0) return true;
  if (callback === 'youth') return tags.includes('youth') || state.projects.academy > 0;
  if (callback === 'market') return tags.includes('market') || state.projects.market > 0;
  if (callback === 'clinic') return state.projects.clinic > 0;
  if (callback === 'coach') return state.relationships['coach-guo'] >= 2;
  if (callback === 'cohesion') return state.match.snapshot.cohesion >= 56 || state.relationships['lin-chuan'] >= 2;
  return false;
}

export function getSeasonMatchMoment(state) {
  if (!state.match || state.match.complete) throw new Error('No active season match moment');
  const moment = MATCH_MOMENTS[state.match.highlightIndex];
  if (!moment) throw new Error('No active season match moment');
  return {
    ...moment,
    choices: moment.choices.map(choice => ({ ...choice, callbackReady: callbackReady(state, choice.callback) }))
  };
}

export function resolveSeasonMatchMoment(state, choiceId) {
  const moment = getSeasonMatchMoment(state);
  const choice = moment.choices.find(item => item.id === choiceId);
  if (!choice) throw new TypeError('Unknown season match choice');
  const next = cloneSeasonState(state);
  if (choice.callbackReady) {
    next.match.homeGoals += 1;
    if (!next.match.callbackIds.includes(choice.callback)) next.match.callbackIds.push(choice.callback);
  } else if (moment.id === 'opening-plan') {
    next.match.awayGoals += 1;
  }
  next.match.awayGoals += moment.awayPressure;
  next.match.choices.push(choiceId);
  next.match.highlightIndex += 1;
  next.match.complete = next.match.highlightIndex === MATCH_MOMENTS.length;
  return next;
}

function applyScore(rows, homeId, awayId, homeGoals, awayGoals) {
  const home = rows.find(row => row.teamId === homeId);
  const away = rows.find(row => row.teamId === awayId);
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;
  if (homeGoals > awayGoals) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
  } else if (homeGoals < awayGoals) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
}

function simulateFixture(fixture, roundIndex, seasonNumber) {
  const home = getLeagueTeam(fixture.homeId);
  const away = getLeagueTeam(fixture.awayId);
  const homeForm = (home.id.length + roundIndex + seasonNumber) % 3 - 1;
  const awayForm = (away.id.length + roundIndex * 2 + seasonNumber) % 3 - 1;
  const gap = home.strength + 2 + homeForm - away.strength - awayForm;
  if (gap >= 8) return { home: 2, away: 0 };
  if (gap >= 3) return { home: 2, away: 1 };
  if (gap <= -8) return { home: 0, away: 2 };
  if (gap <= -3) return { home: 1, away: 2 };
  return { home: 1, away: 1 };
}

export function getStandings(state) {
  return state.standings
    .map(row => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort((a, b) => b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || a.seed - b.seed);
}

export function getSeasonGoalStatus(state, snapshot = {}) {
  const rank = getStandings(state).findIndex(row => row.teamId === 'haifeng') + 1;
  const construction = Object.values(state.projects).reduce((sum, value) => sum + value, 0);
  const people = Object.values(state.relationships).filter(value => value >= 3).length;
  const cash = Number.isFinite(snapshot.cash) ? snapshot.cash : state.match?.snapshot?.cash ?? 0;
  const status = {
    ranking: { complete: state.seasonComplete && rank <= 4, current: rank, target: 4 },
    construction: { complete: construction >= 6, current: construction, target: 6 },
    people: { complete: people >= 3, current: people, target: 3 },
    finance: { complete: cash >= 180, current: cash, target: 180 }
  };
  status.eliteQualified = status.ranking.complete && status.construction.complete;
  return status;
}

export function settleSeasonRound(state) {
  if (!state.match?.complete) throw new Error('Complete the season match first');
  if (state.week.roundComplete) return state;
  const next = cloneSeasonState(state);
  const round = getSeasonRound(next.roundIndex);
  for (const fixture of round.fixtures) {
    if (fixture.homeId === 'haifeng' || fixture.awayId === 'haifeng') {
      const playerGoals = next.match.homeGoals;
      const opponentGoals = next.match.awayGoals;
      applyScore(
        next.standings,
        fixture.homeId,
        fixture.awayId,
        round.playerHome ? playerGoals : opponentGoals,
        round.playerHome ? opponentGoals : playerGoals
      );
    } else {
      const score = simulateFixture(fixture, next.roundIndex, next.seasonNumber);
      applyScore(next.standings, fixture.homeId, fixture.awayId, score.home, score.away);
    }
  }
  next.week.roundComplete = true;
  next.week.result = {
    opponentId: next.match.opponentId,
    homeGoals: next.match.homeGoals,
    awayGoals: next.match.awayGoals,
    points: next.match.homeGoals > next.match.awayGoals ? 3 : next.match.homeGoals === next.match.awayGoals ? 1 : 0
  };
  next.roundHistory.push({ round: next.roundIndex + 1, ...next.week.result });
  if (next.roundIndex === 6) {
    next.seasonComplete = true;
    next.goals = getSeasonGoalStatus(next, next.match.snapshot);
    next.eliteQualified = next.goals.eliteQualified;
  }
  return next;
}

export function advanceSeasonRound(state) {
  if (!state.week.roundComplete) throw new Error('Season round is not complete');
  if (state.seasonComplete) throw new Error('Season is complete');
  const next = cloneSeasonState(state);
  next.roundIndex += 1;
  next.week = emptyWeek();
  next.match = null;
  return next;
}

export function startNextSeason(state) {
  if (!state.seasonComplete) throw new Error('Finish the season before starting another');
  const next = cloneSeasonState(state);
  next.active = true;
  next.seasonNumber += 1;
  next.roundIndex = 0;
  next.week = emptyWeek();
  next.standings = emptyStandings();
  next.match = null;
  next.roundHistory = [];
  next.goals = null;
  next.seasonComplete = false;
  next.eliteQualified = false;
  return next;
}
