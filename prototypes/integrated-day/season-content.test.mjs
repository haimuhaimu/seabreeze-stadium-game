import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSTRUCTION_MILESTONES,
  LEAGUE_TEAMS,
  MATCH_MOMENTS,
  SEASON_ACTIONS,
  SEASON_GOALS,
  SEASON_NPCS,
  SEASON_PROJECTS,
  SEASON_ROUNDS,
  getLeagueTeam,
  getSeasonNpc,
  getSeasonProject,
  getSeasonRound
} from './season-content.js';

test('seven rounds give Haifeng one match against every other club', () => {
  assert.equal(LEAGUE_TEAMS.length, 8);
  assert.equal(SEASON_ROUNDS.length, 7);
  const opponents = SEASON_ROUNDS.map(round => round.playerOpponentId);
  assert.equal(new Set(opponents).size, 7);
  assert.equal(opponents.includes('haifeng'), false);
  for (const round of SEASON_ROUNDS) {
    assert.equal(round.fixtures.length, 4);
    assert.equal(new Set(round.fixtures.flatMap(fixture => [fixture.homeId, fixture.awayId])).size, 8);
  }
});

test('projects and people expose persistent progression', () => {
  assert.deepEqual(Object.keys(SEASON_PROJECTS), ['stands', 'clinic', 'academy', 'market', 'lights']);
  assert.ok(Object.values(SEASON_PROJECTS).every(project => project.levels.length === 3));
  assert.deepEqual(Object.keys(SEASON_NPCS), ['coach-guo', 'lin-chuan', 'aunt-xu', 'xiaoman', 'shen-qiao', 'director-luo']);
  assert.ok(Object.values(SEASON_NPCS).every(npc => npc.responses.length === 3));
});

test('weekly work and match choices use plain language with explicit effects', () => {
  assert.deepEqual(Object.keys(SEASON_ACTIONS), [
    'train-attack', 'train-defense', 'youth-session', 'shop-day', 'community-open', 'maintenance', 'rest'
  ]);
  assert.equal(MATCH_MOMENTS.length, 5);
  assert.equal(MATCH_MOMENTS.filter(moment => !moment.requiresLevels).length, 3);
  assert.ok(MATCH_MOMENTS.every(moment => moment.choices.length === 3));
  assert.ok(Object.values(SEASON_ACTIONS).every(action => action.resultCopy.length >= 12));
  assert.equal(Object.keys(SEASON_GOALS).length, 4);
});

test('construction milestones gate two extra match moments with real callbacks', () => {
  assert.deepEqual(
    Object.keys(CONSTRUCTION_MILESTONES),
    ['extraMoment', 'forgiveOpening', 'fullBuild']
  );
  assert.equal(CONSTRUCTION_MILESTONES.extraMoment, 6);
  assert.equal(CONSTRUCTION_MILESTONES.forgiveOpening, 10);
  assert.equal(CONSTRUCTION_MILESTONES.fullBuild, 15);

  const gated = MATCH_MOMENTS.filter(moment => moment.requiresLevels);
  assert.equal(gated.length, 2);
  assert.deepEqual(gated.map(moment => moment.requiresLevels), [6, 15]);
  assert.ok(gated.every(moment => moment.choices.every(choice => typeof choice.callback === 'string' && choice.callback.length > 0)));
  assert.ok(gated.every(moment => Number.isFinite(moment.awayPressure) && moment.awayPressure === 0));
  assert.ok(gated.every(moment => moment.copy.length >= 12 && moment.title.length >= 6));

  const minutes = MATCH_MOMENTS.map(moment => moment.minute);
  assert.deepEqual(minutes, [...minutes].sort((a, b) => a - b), 'moments must stay in kickoff order');
  assert.equal(new Set(MATCH_MOMENTS.map(moment => moment.id)).size, MATCH_MOMENTS.length);
});

test('content getters reject unknown ids and out of range rounds', () => {
  assert.equal(getLeagueTeam('haifeng').name, '海风队');
  assert.equal(getSeasonRound(0).round, 1);
  assert.equal(getSeasonNpc('coach-guo').name, '郭教练');
  assert.equal(getSeasonProject('stands').label, '加固主看台');
  assert.throws(() => getLeagueTeam('missing'), /Unknown league team/);
  assert.throws(() => getSeasonRound(7), /Unknown season round/);
  assert.throws(() => getSeasonNpc('missing'), /Unknown season NPC/);
  assert.throws(() => getSeasonProject('missing'), /Unknown season project/);
});
