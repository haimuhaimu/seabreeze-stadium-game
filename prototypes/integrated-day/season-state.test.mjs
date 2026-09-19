import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSeasonRound,
  beginSeason,
  canStartSeasonMatch,
  cloneSeasonState,
  createSeasonState,
  getProjectUpgrade,
  getSeasonEliteMoment,
  getSeasonGoalStatus,
  getSeasonMatchMoment,
  getMatchOutlook,
  getStandings,
  recordSeasonAction,
  recordSeasonMemoryTalk,
  recordSeasonNpcTalk,
  recordSeasonProjectVisit,
  resolveSeasonEvent,
  resolveSeasonMatchMoment,
  settleSeasonRound,
  startSeasonEliteMatch,
  startNextSeason,
  startSeasonMatch,
  upgradeSeasonProject,
  resolveSeasonEliteMoment
} from './season-state.js';
import { getSeasonEvent } from './season-events.js';
import { getLeagueTeam, getSeasonRound } from './season-content.js';

const strongSnapshot = Object.freeze({ attack: 62, defense: 60, cohesion: 61, facility: 68, cash: 220 });
const weakSnapshot = Object.freeze({ attack: 44, defense: 43, cohesion: 42, facility: 40, cash: 70 });

test('a new season has eight empty standings rows and persistent progression slots', () => {
  const season = createSeasonState();
  assert.equal(season.active, false);
  assert.equal(season.projects.stands, 0);
  assert.equal(season.relationships['coach-guo'], 0);
  assert.equal(season.week.eventChoiceId, null);
  assert.deepEqual(season.week.memoryNpcIds, []);
  assert.deepEqual(season.week.visitedProjectIds, []);
  assert.deepEqual(season.eventHistory, []);
  assert.equal(season.elite.status, 'idle');
  const active = beginSeason(season);
  assert.equal(active.active, true);
  assert.equal(active.seasonNumber, 1);
  assert.equal(getStandings(active).length, 8);
  assert.ok(getStandings(active).every(row => row.played === 0 && row.points === 0));
});

test('talking is free but each NPC can only give one formal response per round', () => {
  let season = beginSeason(createSeasonState());
  season = recordSeasonNpcTalk(season, 'coach-guo', 'solve');
  assert.equal(season.week.actions.length, 0);
  assert.equal(season.relationships['coach-guo'], 1);
  assert.deepEqual(season.week.helpTags, ['coach']);
  assert.throws(() => recordSeasonNpcTalk(season, 'coach-guo', 'listen'), /already talked/i);
});

test('weekly work stops after exactly three distinct actions', () => {
  let season = beginSeason(createSeasonState());
  for (const id of ['train-attack', 'community-open', 'maintenance']) {
    season = recordSeasonAction(season, id);
  }
  assert.equal(canStartSeasonMatch(season), false);
  const event = getSeasonEvent(0, 1);
  season = resolveSeasonEvent(season, event.id, event.choices[0].id);
  assert.equal(canStartSeasonMatch(season), true);
  assert.throws(() => recordSeasonAction(season, 'shop-day'), /three actions/i);
  assert.throws(() => recordSeasonAction(season, 'maintenance'), /already completed/i);
});

test('an incident is free, changes relationships, and is recorded once for later rounds', () => {
  let season = beginSeason(createSeasonState());
  season.relationships.xiaoman = 5;
  season.relationships['coach-guo'] = 0;
  season = resolveSeasonEvent(season, 'shared-pitch', 'youth-leads');
  assert.equal(season.week.actions.length, 0);
  assert.equal(season.week.eventId, 'shared-pitch');
  assert.equal(season.week.eventChoiceId, 'youth-leads');
  assert.equal(season.week.eventTag, 'youth');
  assert.equal(season.relationships.xiaoman, 5);
  assert.equal(season.relationships['coach-guo'], 0);
  assert.ok(season.week.helpTags.includes('youth'));
  assert.deepEqual(season.eventHistory[0], {
    seasonNumber: 1,
    round: 1,
    eventId: 'shared-pitch',
    choiceId: 'youth-leads',
    resultCopy: getSeasonEvent(0, 1).choices[2].resultCopy
  });
  assert.throws(() => resolveSeasonEvent(season, 'shared-pitch', 'share-half'), /already resolved/i);
});

test('an incident follow-up is free, strengthens one affected bond, and happens once per round', () => {
  let season = beginSeason(createSeasonState());
  season = resolveSeasonEvent(season, 'shared-pitch', 'share-half');
  const actionsBefore = [...season.week.actions];
  season = recordSeasonMemoryTalk(season, 'xiaoman');
  assert.deepEqual(season.week.actions, actionsBefore);
  assert.deepEqual(season.week.memoryNpcIds, ['xiaoman']);
  assert.equal(season.relationships.xiaoman, 2);
  assert.throws(() => recordSeasonMemoryTalk(season, 'xiaoman'), /already discussed/i);
  assert.throws(() => recordSeasonMemoryTalk(season, 'director-luo'), /no incident memory/i);
});

test('an incident follow-up never pushes a relationship past five', () => {
  let season = beginSeason(createSeasonState());
  season = resolveSeasonEvent(season, 'shared-pitch', 'share-half');
  season.relationships.xiaoman = 5;
  season = recordSeasonMemoryTalk(season, 'xiaoman');
  assert.equal(season.relationships.xiaoman, 5);
});

test('old version five season state normalizes missing incident fields', () => {
  const legacy = beginSeason(createSeasonState());
  delete legacy.week.eventId;
  delete legacy.week.eventChoiceId;
  delete legacy.week.eventTag;
  delete legacy.week.memoryNpcIds;
  delete legacy.week.visitedProjectIds;
  delete legacy.eventHistory;
  delete legacy.elite;
  const normalized = cloneSeasonState(legacy);
  assert.equal(normalized.week.eventId, null);
  assert.equal(normalized.week.eventChoiceId, null);
  assert.equal(normalized.week.eventTag, null);
  assert.deepEqual(normalized.week.memoryNpcIds, []);
  assert.deepEqual(normalized.week.visitedProjectIds, []);
  assert.deepEqual(normalized.eventHistory, []);
  assert.equal(normalized.elite.status, 'idle');
});

test('visiting a built facility is free, strengthens its patron, and resets next round', () => {
  let season = beginSeason(createSeasonState());
  assert.throws(() => recordSeasonProjectVisit(season, 'stands'), /not built/i);
  season.projects.stands = 1;
  const actionsBefore = [...season.week.actions];
  season = recordSeasonProjectVisit(season, 'stands');
  assert.deepEqual(season.week.actions, actionsBefore);
  assert.deepEqual(season.week.visitedProjectIds, ['stands']);
  assert.equal(season.relationships['lin-chuan'], 1);
  assert.throws(() => recordSeasonProjectVisit(season, 'stands'), /already visited/i);
  season.week.roundComplete = true;
  const nextRound = advanceSeasonRound(season);
  assert.deepEqual(nextRound.week.visitedProjectIds, []);
  assert.equal(nextRound.relationships['lin-chuan'], 1);
});

test('a facility visit never pushes its patron relationship past five', () => {
  let season = beginSeason(createSeasonState());
  season.projects.market = 3;
  season.relationships['aunt-xu'] = 5;
  season = recordSeasonProjectVisit(season, 'market');
  assert.equal(season.relationships['aunt-xu'], 5);
  assert.throws(() => recordSeasonProjectVisit(season, 'missing'), /Unknown construction scene/);
});

test('construction has three persistent levels and consumes a work action only when upgraded', () => {
  let season = beginSeason(createSeasonState());
  assert.deepEqual(getProjectUpgrade(season, 'stands'), {
    projectId: 'stands', nextLevel: 1, cost: 42, label: '安全护栏'
  });
  season = upgradeSeasonProject(season, 'stands');
  assert.equal(season.projects.stands, 1);
  assert.deepEqual(season.week.actions, ['build:stands']);
  season = advanceSeasonRound({ ...season, week: { ...season.week, roundComplete: true } });
  season = upgradeSeasonProject(season, 'stands');
  season = advanceSeasonRound({ ...season, week: { ...season.week, roundComplete: true } });
  season = upgradeSeasonProject(season, 'stands');
  assert.equal(season.projects.stands, 3);
  assert.equal(getProjectUpgrade(season, 'stands'), null);
  assert.throws(() => upgradeSeasonProject(season, 'stands'), /already complete/i);
});

test('a prepared match remembers weekly work, construction, and people', () => {
  let season = beginSeason(createSeasonState());
  season = recordSeasonAction(season, 'train-attack');
  season = recordSeasonAction(season, 'community-open');
  season = upgradeSeasonProject(season, 'stands');
  season = recordSeasonNpcTalk(season, 'coach-guo', 'solve');
  season = resolveSeasonEvent(season, 'shared-pitch', 'share-half');
  season = startSeasonMatch(season, strongSnapshot);
  assert.equal(getSeasonMatchMoment(season).choices.find(choice => choice.id === 'use-attack-work').callbackReady, true);
  season = resolveSeasonMatchMoment(season, 'use-attack-work');
  assert.equal(getSeasonMatchMoment(season).choices.find(choice => choice.id === 'open-safe-stands').callbackReady, true);
  season = resolveSeasonMatchMoment(season, 'open-safe-stands');
  assert.equal(getSeasonMatchMoment(season).choices.find(choice => choice.id === 'follow-coach-note').callbackReady, true);
  season = resolveSeasonMatchMoment(season, 'follow-coach-note');
  assert.deepEqual({ home: season.match.homeGoals, away: season.match.awayGoals }, { home: 3, away: 1 });
});

function playRound(season, prepared) {
  const event = getSeasonEvent(season.roundIndex, season.seasonNumber);
  season = resolveSeasonEvent(season, event.id, prepared ? event.choices[0].id : event.choices[2].id);
  const actions = prepared
    ? ['train-attack', 'community-open', 'train-defense']
    : ['rest', 'shop-day', 'maintenance'];
  for (const actionId of actions) season = recordSeasonAction(season, actionId);
  if (prepared) season = recordSeasonNpcTalk(season, 'coach-guo', 'solve');
  season = startSeasonMatch(season, prepared ? strongSnapshot : weakSnapshot);
  const choices = prepared
    ? ['use-attack-work', 'bring-community-back', 'follow-coach-note']
    : ['trust-young-side', 'open-safe-stands', 'use-clinic-sub'];
  for (const choiceId of choices) season = resolveSeasonMatchMoment(season, choiceId);
  season = settleSeasonRound(season);
  return season.seasonComplete ? season : advanceSeasonRound(season);
}

test('seven rounds update the complete table and player choices change final rank', () => {
  let strong = beginSeason(createSeasonState());
  let weak = beginSeason(createSeasonState());
  strong.projects.stands = 3;
  strong.projects.clinic = 3;
  for (let round = 0; round < 7; round += 1) {
    strong = playRound(strong, true);
    weak = playRound(weak, false);
  }
  const strongRank = getStandings(strong).findIndex(row => row.teamId === 'haifeng') + 1;
  const weakRank = getStandings(weak).findIndex(row => row.teamId === 'haifeng') + 1;
  const strongRow = getStandings(strong).find(row => row.teamId === 'haifeng');
  const weakRow = getStandings(weak).find(row => row.teamId === 'haifeng');
  assert.equal(strong.seasonComplete, true);
  assert.equal(weak.seasonComplete, true);
  assert.ok(getStandings(strong).every(row => row.played === 7));
  assert.ok(strongRank <= 4);
  assert.ok(weakRank > strongRank);
  assert.ok(strongRow.points > weakRow.points);
  assert.equal(strong.elite.status, 'invited');
  assert.equal(weak.elite.status, 'idle');
});

test('a qualified season plays one elite match and keeps its result next season', () => {
  let season = beginSeason(createSeasonState());
  season.projects.stands = 3;
  season.projects.clinic = 3;
  for (let round = 0; round < 7; round += 1) season = playRound(season, true);
  season = startSeasonEliteMatch(season, 'shared-plan');
  assert.equal(getSeasonEliteMoment(season).id, 'first-pass');
  assert.throws(() => startNextSeason(season), /elite match/i);
  for (const choiceId of ['use-league-shape', 'open-built-route', 'follow-shared-plan']) {
    season = resolveSeasonEliteMoment(season, choiceId);
  }
  assert.equal(season.elite.result.id, 'champion');
  assert.equal(season.elite.history.length, 1);
  const next = startNextSeason(season);
  assert.equal(next.seasonNumber, 2);
  assert.equal(next.elite.status, 'idle');
  assert.equal(next.elite.history.length, 1);
  assert.equal(next.elite.bestResultId, 'champion');
});

test('goals are readable and a new season preserves projects and relationships', () => {
  let season = beginSeason(createSeasonState());
  season.projects = { stands: 2, clinic: 1, academy: 1, market: 1, lights: 1 };
  season.relationships = {
    'coach-guo': 3, 'lin-chuan': 3, 'aunt-xu': 3, xiaoman: 1, 'shen-qiao': 0, 'director-luo': 1
  };
  season.standings = season.standings.map(row => row.teamId === 'haifeng' ? { ...row, played: 7, won: 4, points: 13 } : row);
  season.seasonComplete = true;
  const status = getSeasonGoalStatus(season, { cash: 190 });
  assert.equal(status.construction.complete, true);
  assert.equal(status.people.complete, true);
  assert.equal(status.finance.complete, true);
  const next = startNextSeason(season);
  assert.equal(next.seasonNumber, 2);
  assert.equal(next.roundIndex, 0);
  assert.equal(next.projects.stands, 2);
  assert.equal(next.relationships['coach-guo'], 3);
  assert.deepEqual(next.eventHistory, season.eventHistory);
  assert.ok(next.standings.every(row => row.played === 0));
});

test('team rating gives cohesion and facility a readable share of the outlook', () => {
  const projects = { stands: 2, clinic: 1, academy: 1, market: 1, lights: 1 };
  const base = { attack: 58, defense: 56, cohesion: 58, facility: 62, cash: 200 };
  const baseRating = getMatchOutlook(base, projects, 60).rating;

  const strongerBond = getMatchOutlook({ ...base, cohesion: 85 }, projects, 60).rating;
  const betterGround = getMatchOutlook({ ...base, facility: 90 }, projects, 60).rating;
  assert.ok(strongerBond - baseRating > 6.5, 'cohesion should move the outlook by more than six points');
  assert.ok(betterGround - baseRating > 4, 'facility should move the outlook by more than four points');

  const fullBuild = getMatchOutlook(base, { stands: 3, clinic: 3, academy: 3, market: 3, lights: 3 }, 60).rating;
  const sixLevels = getMatchOutlook(base, projects, 60).rating;
  assert.ok(fullBuild - sixLevels > 7, 'the last nine construction levels must still raise the rating');
});

test('conceded goals scale continuously with the gap instead of two hard steps', () => {
  const flat = { attack: 50, defense: 50, cohesion: 50, facility: 50, cash: 0 };
  const noProjects = { stands: 0, clinic: 0, academy: 0, market: 0, lights: 0 };
  const concededFor = difficulty => getMatchOutlook(flat, noProjects, difficulty).concededGoals;

  assert.equal(getMatchOutlook(flat, noProjects, 50).rating, 50);
  assert.equal(concededFor(58), 0, 'a gap of eight stays goalless');
  assert.equal(concededFor(59), 1, 'a gap of nine concedes the first goal');
  assert.equal(concededFor(67), 1, 'a gap of seventeen still concedes one');
  assert.equal(concededFor(68), 2, 'a gap of eighteen concedes two');
  assert.equal(concededFor(77), 3, 'a gap of twenty-seven concedes three');
  assert.equal(concededFor(200), 3, 'the deficit is capped at three goals');
  assert.equal(concededFor(20), 0, 'a stronger club never concedes from the outlook');
});

test('the outlook keeps one shared source of truth with the kickoff deficit', () => {
  let season = beginSeason(createSeasonState());
  season = recordSeasonAction(season, 'train-attack');
  season = recordSeasonAction(season, 'community-open');
  season = recordSeasonAction(season, 'train-defense');
  season = resolveSeasonEvent(season, 'shared-pitch', 'share-half');
  const outlook = getMatchOutlook(weakSnapshot, season.projects, getLeagueTeam(getSeasonRound(0).playerOpponentId).strength);
  season = startSeasonMatch(season, weakSnapshot);
  assert.equal(season.match.awayGoals, outlook.concededGoals);
  assert.ok(Number.isFinite(outlook.gap));
});

test('invalid early match, round advance, and unknown ids fail loudly', () => {
  const season = beginSeason(createSeasonState());
  assert.throws(() => startSeasonMatch(season, strongSnapshot), /three weekly actions/i);
  assert.throws(() => advanceSeasonRound(season), /round is not complete/i);
  assert.throws(() => recordSeasonAction(season, 'missing'), /Unknown season action/);
  assert.throws(() => recordSeasonNpcTalk(season, 'missing', 'listen'), /Unknown season NPC/);
  assert.throws(() => upgradeSeasonProject(season, 'missing'), /Unknown season project/);
  assert.throws(() => resolveSeasonEvent(season, 'missing', 'choice'), /current round/i);
  assert.throws(() => resolveSeasonEvent(season, 'shared-pitch', 'missing'), /choice/i);
});
