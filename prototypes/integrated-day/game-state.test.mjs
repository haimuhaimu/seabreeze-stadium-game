import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrders } from './daily-content.js';
import {
  createGameState,
  createFirstWeekEntryState,
  collectItem,
  talkToCoach,
  startTraining,
  finishTraining,
  openShop,
  serveOrder,
  buyRepair,
  chooseSaveMoney,
  finishDay,
  advanceDay,
  beginManagementWeek,
  acknowledgeEpisodeNotice,
  chooseEpisodePromises,
  completeEpisodePromise,
  resolveEpisodeFunding,
  acknowledgeEpisodeOffer,
  startWeeklyMatch,
  chooseMatchHighlight,
  completeEpisodeHearing,
  finishManagementDay,
  advanceCampaignDay,
  beginNamingRightsWeek,
  completeNamingMainline,
  startNamingFreeAction,
  finishNamingFreeAction,
  startSecondWeeklyMatch,
  resolveSecondWeeklyMatchChoice,
  beginLeagueSeason,
  chooseEliteMatchChoice,
  chooseElitePreparation,
  chooseSeasonEventDecision,
  chooseSeasonNpcMemory,
  chooseSeasonAction,
  chooseSeasonNpcResponse,
  buildSeasonProject,
  visitSeasonProject,
  startLeagueMatch,
  resolveLeagueMatchChoice,
  advanceLeagueRound,
  beginNextLeagueSeason
} from './game-state.js';
import { offerEliteInvitation } from './elite-state.js';

test('a direct entry starts at the visible management week without erasing prologue history', () => {
  const state = createFirstWeekEntryState();
  assert.equal(state.dayIndex, 3);
  assert.equal(state.phase, 'morning');
  assert.equal(state.world.mapId, 'stadium');
  assert.equal(state.history.length, 3);
  assert.deepEqual(state.repairs, ['awning', 'net']);
  assert.equal(state.relationship.coachMet, true);
  assert.equal(state.economy.cash, 107);
});

function gatherAll(state) {
  for (const itemId of ['tea-a', 'tea-b', 'fruit-a', 'fruit-b']) {
    state = collectItem(state, itemId);
  }
  return state;
}

function serveAllOrders(state) {
  for (const order of getOrders(state.dayIndex)) {
    state = serveOrder(state, order.recipe);
  }
  return state;
}

function reachEvening(state) {
  state = gatherAll(state);
  state = openShop(state);
  return serveAllOrders(state);
}

function completeCurrentDay(state, choice) {
  state = reachEvening(state);
  state = choice === 'save' ? chooseSaveMoney(state) : buyRepair(state, choice);
  return finishDay(state);
}

test('repairs, money, stock, and relationship survive a new day', () => {
  let state = gatherAll(createGameState());
  state = talkToCoach(state);
  state = openShop(state);
  state = serveAllOrders(state);
  state = buyRepair(state, 'awning');
  state = finishDay(state);
  state = advanceDay(state);

  assert.equal(state.dayIndex, 1);
  assert.equal(state.phase, 'morning');
  assert.deepEqual(state.repairs, ['awning']);
  assert.equal(state.money, 20);
  assert.equal(state.relationship.coachMet, true);
  assert.equal(state.energy, 100);
  assert.deepEqual(state.collectedToday, []);
  assert.equal(state.ordersServed, 0);
});

test('training can complete once per available day', () => {
  let state = { ...createGameState(), dayIndex: 1 };
  state = startTraining(state);
  state = finishTraining(state, 5);
  const completed = state;
  state = startTraining(state);

  assert.equal(completed.training.completedToday, true);
  assert.equal(completed.training.lastScore, 5);
  assert.equal(completed.relationship.coachTrust, 1);
  assert.equal(completed.energy, 92);
  assert.equal(state.training.started, false);
  assert.equal(state.relationship.coachTrust, 1);
});

test('saving money is a valid evening choice', () => {
  let state = reachEvening(createGameState());
  state = chooseSaveMoney(state);
  state = finishDay(state);
  assert.equal(state.phase, 'complete');
  assert.equal(state.eveningChoice, 'save');
});

test('the third day ends the chapter with three history entries', () => {
  let state = createGameState();
  for (let day = 0; day < 3; day += 1) {
    state = completeCurrentDay(state, day === 0 ? 'awning' : 'save');
    if (day < 2) state = advanceDay(state);
  }
  state = advanceDay(state);
  assert.equal(state.chapterComplete, true);
  assert.equal(state.history.length, 3);
  assert.equal(state.dayIndex, 2);
});

test('items cannot be collected twice in the same morning', () => {
  let state = createGameState();
  state = collectItem(state, 'tea-a');
  const once = state;
  state = collectItem(state, 'tea-a');

  assert.deepEqual(state.inventory, once.inventory);
  assert.deepEqual(state.collectedToday, ['tea-a']);
  assert.match(state.journal.at(-1).text, /已经收好/);
});

test('wrong orders and unfinished evenings do not spend resources', () => {
  let state = openShop(gatherAll(createGameState()));
  const before = state;
  state = serveOrder(state, 'fruit');
  assert.equal(state.ordersServed, 0);
  assert.equal(state.money, 0);
  assert.deepEqual(state.inventory, before.inventory);

  state = serveAllOrders(state);
  const unfinished = finishDay(state);
  assert.equal(unfinished.phase, 'evening');
  assert.match(unfinished.journal.at(-1).text, /修缮一处|存下/);
});

test('a repaired facility cannot be purchased again on a later day', () => {
  let state = completeCurrentDay(createGameState(), 'awning');
  state = advanceDay(state);
  state = reachEvening(state);
  const before = state;
  state = buyRepair(state, 'awning');

  assert.equal(state.eveningChoice, null);
  assert.equal(state.money, before.money);
  assert.deepEqual(state.repairs, ['awning']);
});

function completedPrologue() {
  return {
    ...createGameState(),
    dayIndex: 2,
    phase: 'complete',
    chapterComplete: true,
    money: 100
  };
}

function finishAndAdvance(state) {
  const finished = finishManagementDay(state);
  assert.equal(finished.phase, 'complete');
  return advanceCampaignDay(finished);
}

function reachFriday(promiseIds = ['train', 'records'], fundraisingMode = 'private') {
  let state = beginManagementWeek(completedPrologue());
  state = acknowledgeEpisodeNotice(state);
  state = finishAndAdvance(state);
  state = chooseEpisodePromises(state, promiseIds);
  state = finishAndAdvance(state);
  state = completeEpisodePromise(state, promiseIds[0], promiseIds[0] === 'fundraise' ? { fundraisingMode } : {});
  state = finishAndAdvance(state);
  state = completeEpisodePromise(state, promiseIds[1], promiseIds[1] === 'fundraise' ? { fundraisingMode } : {});
  return finishAndAdvance(state);
}

function reachSundayReadyState(promiseIds = ['train', 'records'], funding = 'protect-work') {
  let state = reachFriday(promiseIds);
  state = resolveEpisodeFunding(state, funding);
  state = finishAndAdvance(state);
  state = acknowledgeEpisodeOffer(state);
  return finishAndAdvance(state);
}

test('the management week advances only after the required story action', () => {
  let state = beginManagementWeek(completedPrologue());
  assert.equal(state.dayIndex, 3);
  const blocked = finishManagementDay(state);
  assert.equal(blocked.phase, 'morning');
  state = acknowledgeEpisodeNotice(state);
  state = finishManagementDay(state);
  state = advanceCampaignDay(state);
  assert.equal(state.dayIndex, 4);
});

test('the first week starts with a fixed opponent and blank notice', () => {
  const state = beginManagementWeek(completedPrologue());
  assert.equal(state.version, 5);
  assert.equal(state.management.opponentId, 'city-university');
  assert.equal(state.episode.sceneId, 'blank-notice');
});

test('two promise days can be completed in either order', () => {
  const state = reachFriday(['records', 'train']);
  assert.deepEqual(state.episode.promisesCompleted, ['records', 'train']);
  assert.equal(state.episode.truthKnown, true);
  assert.equal(state.episode.xiaomanTrust, 2);
});

test('friday locks the missed request and maps funding into long-term state', () => {
  let state = reachFriday(['train', 'fundraise'], 'public');
  const communityBefore = state.communitySupport;
  state = resolveEpisodeFunding(state, 'pay-both');
  assert.equal(state.episode.missedRequest, 'records');
  assert.equal(state.management.shortfallPending, false);
  assert.ok(state.communitySupport >= communityBefore);
  assert.equal(state.facilities.prepared, 'floodlights');
});

test('sunday requires the hearing after three highlights', () => {
  let state = reachSundayReadyState();
  state = startWeeklyMatch(state);
  state = chooseMatchHighlight(state, 'repeat-practice');
  state = chooseMatchHighlight(state, 'ask-xiaoman');
  state = chooseMatchHighlight(state, 'share-responsibility');
  assert.equal(state.management.weekComplete, false);
  assert.ok(state.episode.xiaomanDecision);
  state = completeEpisodeHearing(state, 'five-party-week');
  assert.equal(state.management.weekComplete, true);
  assert.ok(state.management.settlement);
  assert.equal(state.management.settlement.character.xiaomanDecision, state.episode.xiaomanDecision);
  assert.deepEqual(state.management.matchResult.score, { home: 2, away: 1 });
});

function completedFirstWeek() {
  let state = reachSundayReadyState(['train', 'records'], 'protect-work');
  state = startWeeklyMatch(state);
  state = chooseMatchHighlight(state, 'repeat-practice');
  state = chooseMatchHighlight(state, 'ask-xiaoman');
  state = chooseMatchHighlight(state, 'share-responsibility');
  return completeEpisodeHearing(state, 'five-party-week');
}

function finishNamingAction(state, actionId, choiceId, freeActionId) {
  state = completeNamingMainline(state, actionId, choiceId);
  assert.equal(state.phase, 'morning');
  state = startNamingFreeAction(state, freeActionId);
  return finishNamingFreeAction(state, { score: 1 });
}

test('the completed first week opens a fresh naming-rights week without losing its settlement', () => {
  const firstWeek = completedFirstWeek();
  const firstSettlement = firstWeek.management.settlement;
  const state = beginNamingRightsWeek(firstWeek);
  assert.equal(state.dayIndex, 10);
  assert.equal(state.phase, 'morning');
  assert.equal(state.campaign.week, 2);
  assert.equal(state.namingRights.id, 'naming-rights');
  assert.deepEqual(state.campaign.weekOneSettlement.score, firstSettlement.score);
  assert.equal(state.management.opponentId, 'harbor-workers');
  assert.equal(state.management.weekComplete, false);
});

test('walking around after the first-week summary does not lock the second week', () => {
  const firstWeek = { ...completedFirstWeek(), phase: 'morning' };
  const state = beginNamingRightsWeek(firstWeek);
  assert.equal(state.dayIndex, 10);
  assert.equal(state.campaign.week, 2);
});

test('a naming weekday cannot end until its mainline and one free action are complete', () => {
  let state = beginNamingRightsWeek(completedFirstWeek());
  state = completeNamingMainline(state, 'naming-proposal', 'hold-public-vote');
  state = advanceCampaignDay(state);
  assert.equal(state.dayIndex, 11);

  const blocked = advanceCampaignDay(state);
  assert.equal(blocked.dayIndex, 11);
  state = completeNamingMainline(state, 'naming-chairs', 'write-conditions');
  assert.equal(state.phase, 'morning');
  state = startNamingFreeAction(state, 'rest');
  state = finishNamingFreeAction(state, { score: 0 });
  assert.equal(state.phase, 'complete');
  assert.equal(state.energy, 100);
  state = advanceCampaignDay(state);
  assert.equal(state.dayIndex, 12);
});

test('the community route carries free actions into a public sign reveal', () => {
  let state = beginNamingRightsWeek(completedFirstWeek());
  state = completeNamingMainline(state, 'naming-proposal', 'hold-public-vote');
  state = advanceCampaignDay(state);
  state = finishNamingAction(state, 'naming-chairs', 'write-conditions', 'shop');
  state = advanceCampaignDay(state);
  state = finishNamingAction(state, 'naming-alternative', 'open-free-time', 'community');
  state = advanceCampaignDay(state);
  state = finishNamingAction(state, 'naming-plaque', 'acknowledge-history', 'shop');
  state = advanceCampaignDay(state);

  state = completeNamingMainline(state, 'naming-vote', 'community-save');
  assert.equal(state.namingRights.voteRoute, 'community-save');
  state = advanceCampaignDay(state);
  state = finishNamingAction(state, 'naming-response', 'restore-history', 'archive');
  state = advanceCampaignDay(state);
  assert.equal(state.dayIndex, 16);

  state = startSecondWeeklyMatch(state);
  state = resolveSecondWeeklyMatchChoice(state, 'keep-gates-open');
  state = resolveSecondWeeklyMatchChoice(state, 'steady-everyone');
  state = resolveSecondWeeklyMatchChoice(state, 'let-name-show');
  assert.equal(state.namingRights.weekComplete, true);
  assert.equal(state.namingRights.settlement.stadiumName, '海风球场');
  assert.equal(state.namingRights.settlement.authority, '五把椅子保留最终决定权');
  assert.equal(state.namingRights.settlement.rememberedAction, '整理旧照片');
  assert.equal(state.phase, 'complete');
  assert.ok(state.management.matchResult.score.home >= 1);
});

test('co-naming and delay remain reachable without optional-action thresholds', () => {
  for (const routeId of ['co-name', 'delay']) {
    let state = beginNamingRightsWeek(completedFirstWeek());
    state.dayIndex = 14;
    state.phase = 'morning';
    state = completeNamingMainline(state, 'naming-vote', routeId);
    assert.equal(state.namingRights.voteRoute, routeId);
    assert.equal(state.phase, 'complete');
  }
});

function completedNamingWeek() {
  let state = beginNamingRightsWeek(completedFirstWeek());
  state = completeNamingMainline(state, 'naming-proposal', 'hold-public-vote');
  state = advanceCampaignDay(state);
  state = finishNamingAction(state, 'naming-chairs', 'write-conditions', 'shop');
  state = advanceCampaignDay(state);
  state = finishNamingAction(state, 'naming-alternative', 'open-free-time', 'community');
  state = advanceCampaignDay(state);
  state = finishNamingAction(state, 'naming-plaque', 'acknowledge-history', 'shop');
  state = advanceCampaignDay(state);
  state = completeNamingMainline(state, 'naming-vote', 'community-save');
  state = advanceCampaignDay(state);
  state = finishNamingAction(state, 'naming-response', 'restore-history', 'archive');
  state = advanceCampaignDay(state);
  state = startSecondWeeklyMatch(state);
  for (const choiceId of ['keep-gates-open', 'steady-everyone', 'let-name-show']) {
    state = resolveSecondWeeklyMatchChoice(state, choiceId);
  }
  return state;
}

test('the naming-week settlement opens a persistent league', () => {
  const namingWeek = completedNamingWeek();
  const signName = namingWeek.namingRights.settlement.stadiumName;
  const state = beginLeagueSeason(namingWeek);
  assert.equal(state.version, 5);
  assert.equal(state.dayIndex, 17);
  assert.equal(state.phase, 'morning');
  assert.equal(state.season.active, true);
  assert.equal(state.season.roundIndex, 0);
  assert.equal(state.namingRights.settlement.stadiumName, signName);
});

test('season actions, NPC responses, and construction update shared progress once', () => {
  let state = beginLeagueSeason(completedNamingWeek());
  const cashBefore = state.economy.cash;
  const attackBefore = state.roster.attack;
  state = chooseSeasonNpcResponse(state, 'coach-guo', 'solve');
  assert.equal(state.season.relationships['coach-guo'], 1);
  state = chooseSeasonAction(state, 'train-attack');
  state = chooseSeasonAction(state, 'shop-day');
  assert.equal(state.roster.attack, attackBefore + 4);
  assert.ok(state.economy.cash > cashBefore);
  const actionsBeforeBuild = state.season.week.actions.length;
  const poor = { ...state, economy: { ...state.economy, cash: 0 }, money: 0 };
  const blocked = buildSeasonProject(poor, 'stands');
  assert.equal(blocked.season.week.actions.length, actionsBeforeBuild);
  assert.equal(blocked.season.projects.stands, 0);
  state = buildSeasonProject(state, 'stands');
  assert.equal(state.season.projects.stands, 1);
  assert.equal(state.season.week.actions.length, 3);
  assert.ok(state.economy.cash < cashBefore + 34);
});

test('using a built facility takes twelve minutes without cash or a work action', () => {
  const before = beginLeagueSeason(completedNamingWeek());
  before.season.projects.stands = 1;
  const minuteBefore = before.minute;
  const cashBefore = before.economy.cash;
  const actionsBefore = [...before.season.week.actions];
  const after = visitSeasonProject(before, 'stands');
  assert.equal(after.minute, minuteBefore + 12);
  assert.equal(after.economy.cash, cashBefore);
  assert.deepEqual(after.season.week.actions, actionsBefore);
  assert.deepEqual(after.season.week.visitedProjectIds, ['stands']);
  assert.equal(after.season.relationships['lin-chuan'], 1);
  assert.equal(after.journal.at(-1).kind, 'construction-visit');
  assert.match(after.journal.at(-1).text, /林川.*护栏/);
  const repeated = visitSeasonProject(after, 'stands');
  assert.equal(repeated.minute, after.minute);
  assert.equal(repeated.season.relationships['lin-chuan'], after.season.relationships['lin-chuan']);
});

test('a league incident changes shared progress and relationships without spending work', () => {
  const before = beginLeagueSeason(completedNamingWeek());
  const after = chooseSeasonEventDecision(before, 'shared-pitch', 'share-half');
  assert.equal(after.season.week.actions.length, 0);
  assert.equal(after.season.week.eventChoiceId, 'share-half');
  assert.equal(after.season.relationships.xiaoman, before.season.relationships.xiaoman + 1);
  assert.equal(after.communitySupport, before.communitySupport + 4);
  assert.equal(after.roster.cohesion, before.roster.cohesion + 2);
  assert.ok(after.season.week.helpTags.includes('community'));
  const repeated = chooseSeasonEventDecision(after, 'shared-pitch', 'first-team-first');
  assert.equal(repeated.season.eventHistory.length, 1);
  assert.equal(repeated.communitySupport, after.communitySupport);
});

test('talking through an incident memory takes six minutes but no work action', () => {
  const started = beginLeagueSeason(completedNamingWeek());
  const eventState = chooseSeasonEventDecision(started, 'shared-pitch', 'share-half');
  const beforeMinute = eventState.minute;
  const beforeBond = eventState.season.relationships.xiaoman;
  const after = chooseSeasonNpcMemory(eventState, 'xiaoman');
  assert.equal(after.minute, beforeMinute + 6);
  assert.deepEqual(after.season.week.actions, eventState.season.week.actions);
  assert.deepEqual(after.season.week.memoryNpcIds, ['xiaoman']);
  assert.equal(after.season.relationships.xiaoman, beforeBond + 1);
  assert.equal(after.journal.at(-1).kind, 'season-memory');
  assert.match(after.journal.at(-1).text, /小满.*把半块场地画出来/);
  const repeated = chooseSeasonNpcMemory(after, 'xiaoman');
  assert.deepEqual(repeated.season.week.memoryNpcIds, ['xiaoman']);
  assert.equal(repeated.season.relationships.xiaoman, after.season.relationships.xiaoman);
});

test('league match settlement pays income, updates standings, and opens the next round', () => {
  let state = beginLeagueSeason(completedNamingWeek());
  state = chooseSeasonNpcResponse(state, 'coach-guo', 'solve');
  state = chooseSeasonAction(state, 'train-attack');
  state = chooseSeasonAction(state, 'community-open');
  state = buildSeasonProject(state, 'stands');
  state = chooseSeasonEventDecision(state, 'shared-pitch', 'share-half');
  const cashBeforeMatch = state.economy.cash;
  state = startLeagueMatch(state);
  for (const choiceId of ['use-attack-work', 'open-safe-stands', 'follow-coach-note']) {
    state = resolveLeagueMatchChoice(state, choiceId);
  }
  assert.equal(state.phase, 'complete');
  assert.equal(state.season.week.roundComplete, true);
  assert.equal(state.season.standings.find(row => row.teamId === 'haifeng').played, 1);
  assert.ok(state.economy.cash > cashBeforeMatch);
  state = advanceLeagueRound(state);
  assert.equal(state.phase, 'morning');
  assert.equal(state.season.roundIndex, 1);
  assert.deepEqual(state.season.week.actions, []);
});

test('a completed league can start another season without erasing construction or bonds', () => {
  let state = beginLeagueSeason(completedNamingWeek());
  state.season.projects.stands = 2;
  state.season.relationships['coach-guo'] = 3;
  state.season.seasonComplete = true;
  state.season.week.roundComplete = true;
  const next = beginNextLeagueSeason(state);
  assert.equal(next.season.seasonNumber, 2);
  assert.equal(next.season.projects.stands, 2);
  assert.equal(next.season.relationships['coach-guo'], 3);
  assert.equal(next.phase, 'morning');
});

function qualifiedLeagueEnd() {
  const state = beginLeagueSeason(completedNamingWeek());
  state.phase = 'complete';
  state.season.seasonComplete = true;
  state.season.eliteQualified = true;
  state.season.goals = {
    ranking: { complete: true, current: 2, target: 4 },
    construction: { complete: true, current: 7, target: 6 },
    people: { complete: true, current: 3, target: 3 },
    finance: { complete: true, current: state.economy.cash, target: 180 },
    eliteQualified: true
  };
  state.season.elite = offerEliteInvitation(state.season.elite, state.season.seasonNumber);
  return state;
}

test('the elite finale pays its permanent reward exactly once and then opens a new season', () => {
  const invited = qualifiedLeagueEnd();
  const cashBefore = invited.economy.cash;
  const cohesionBefore = invited.roster.cohesion;
  const communityBefore = invited.communitySupport;
  const actionsBefore = [...invited.season.week.actions];
  let state = chooseElitePreparation(invited, 'shared-plan');
  assert.equal(state.season.elite.status, 'match');
  assert.equal(state.economy.cash, cashBefore);
  assert.deepEqual(state.season.week.actions, actionsBefore);
  const blocked = beginNextLeagueSeason(state);
  assert.equal(blocked.season.seasonNumber, 1);
  assert.equal(blocked.season.elite.status, 'match');
  for (const choiceId of ['use-league-shape', 'open-built-route', 'follow-shared-plan']) {
    state = chooseEliteMatchChoice(state, choiceId);
  }
  assert.equal(state.season.elite.result.id, 'champion');
  assert.equal(state.economy.cash, cashBefore + 160);
  assert.equal(state.roster.cohesion, cohesionBefore + 4);
  assert.equal(state.communitySupport, communityBefore + 8);
  assert.equal(state.economy.entries.filter(entry => entry.id === 'elite-1').length, 1);
  const repeated = chooseEliteMatchChoice(state, 'follow-shared-plan');
  assert.equal(repeated.economy.cash, state.economy.cash);
  assert.equal(repeated.economy.entries.filter(entry => entry.id === 'elite-1').length, 1);
  const next = beginNextLeagueSeason(state);
  assert.equal(next.season.seasonNumber, 2);
  assert.equal(next.season.elite.history.length, 1);
  assert.equal(next.season.elite.bestResultId, 'champion');
});
