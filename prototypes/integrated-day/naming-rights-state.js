import { cloneFreeTimeState, createFreeTimeState, getFreeActionTotals } from './free-time-state.js';
import {
  NAMING_EPISODE_ID,
  REVEAL_RESPONSES,
  VOTE_ROUTES,
  getNamingScene
} from './naming-rights-content.js';

const MATCH_MOMENTS = Object.freeze([
  Object.freeze({
    id: 'wind-crowd',
    minute: 24,
    title: '海风突然变大，看台上的人开始往外走',
    copy: '不是战术问题。留下来的人需要一个继续待在这里的理由。',
    awayPressure: 0,
    choices: Object.freeze([
      Object.freeze({ id: 'keep-gates-open', label: '让社区时段的人带大家回来', detail: '回应社区开放日', callback: 'community' }),
      Object.freeze({ id: 'carry-shop-box', label: '把小店的热水和毛巾送上看台', detail: '回应场边小店', callback: 'shop' }),
      Object.freeze({ id: 'move-under-roof', label: '先把人带到修好的看台下', detail: '回应球场修缮', callback: 'repair' })
    ])
  }),
  Object.freeze({
    id: 'hesitant-substitute',
    minute: 58,
    title: '替补队员失误以后，不敢再要球',
    copy: '郭教练看向安若童。现在需要的不是一个专业口令，而是谁愿意承担下一次失误。',
    awayPressure: 1,
    choices: Object.freeze([
      Object.freeze({ id: 'trust-the-bench', label: '让训练里那组人再做一次', detail: '回应球队训练', callback: 'training' }),
      Object.freeze({ id: 'call-each-name', label: '让场边先喊出每个人的名字', detail: '回应社区开放日', callback: 'community' }),
      Object.freeze({ id: 'steady-everyone', label: '告诉全队，下一次失误算在我这里', detail: '安若童亲自承担', callback: 'always' })
    ])
  }),
  Object.freeze({
    id: 'tearing-banner',
    minute: 83,
    title: '蓝色冠名布的一角被风撕开',
    copy: '旧招牌露了出来。全场都在等，看你们要把哪一面重新挂好。',
    awayPressure: 0,
    choices: Object.freeze([
      Object.freeze({ id: 'let-name-show', label: '让旧名字先完整露出来', detail: '回应铭牌与历史', callback: 'history' }),
      Object.freeze({ id: 'tie-blue-cloth', label: '让修缮组先固定整块布', detail: '回应球场修缮', callback: 'repair' }),
      Object.freeze({ id: 'ask-shen-to-hold', label: '请沈峤和你一起拉住绳子', detail: '回应联合冠名', callback: 'shen' })
    ])
  })
]);

const SHEN_POSITION_COPY = Object.freeze({
  'stays-outside': '沈峤留在场外，名字回到了铭牌上，手没有伸进表决箱。',
  'takes-seat': '沈峤坐进了赞助席。他得到的不只是道歉，也是一票否决权。',
  'withdraws-banner': '沈峤撤走了开场宣传，站在看台最后一排等赛后的答复。'
});

export function createNamingRightsState() {
  return {
    id: NAMING_EPISODE_ID,
    sceneHistory: [],
    freeTime: createFreeTimeState(),
    voteRoute: null,
    response: null,
    shenPosition: 'pressing',
    match: null,
    settlement: null,
    weekComplete: false
  };
}

export function cloneNamingRightsState(state) {
  return {
    ...state,
    sceneHistory: [...state.sceneHistory],
    freeTime: cloneFreeTimeState(state.freeTime),
    match: state.match ? {
      ...state.match,
      choices: [...state.match.choices],
      callbackIds: [...state.match.callbackIds]
    } : null,
    settlement: state.settlement ? {
      ...state.settlement,
      score: { ...state.settlement.score },
      callbacks: [...state.settlement.callbacks]
    } : null
  };
}

export function completeNamingScene(state, sceneId) {
  getNamingScene(sceneId);
  if (state.sceneHistory.includes(sceneId)) return state;
  const next = cloneNamingRightsState(state);
  next.sceneHistory.push(sceneId);
  return next;
}

export function getAvailableVoteRoutes(state) {
  const totals = getFreeActionTotals(state.freeTime);
  return Object.values(VOTE_ROUTES).map(route => {
    const missingFund = Math.max(0, (route.requires?.fund ?? 0) - totals.fund);
    const missingSignatures = Math.max(0, (route.requires?.signatures ?? 0) - totals.signatures);
    return {
      ...route,
      disabled: missingFund > 0 || missingSignatures > 0,
      missingFund,
      missingSignatures
    };
  });
}

export function chooseNamingVote(state, routeId) {
  if (!VOTE_ROUTES[routeId]) throw new TypeError('Unknown vote route');
  if (state.voteRoute) throw new Error('Naming vote already recorded');
  const route = getAvailableVoteRoutes(state).find(item => item.id === routeId);
  if (route.disabled) throw new Error('Vote route not unlocked');
  const next = cloneNamingRightsState(state);
  next.voteRoute = routeId;
  if (!next.sceneHistory.includes('first-vote')) next.sceneHistory.push('first-vote');
  return next;
}

export function chooseNamingResponse(state, responseId) {
  if (!state.voteRoute) throw new Error('Vote first before responding');
  const response = REVEAL_RESPONSES[responseId];
  if (!response) throw new TypeError('Unknown naming response');
  if (state.response) throw new Error('Naming response already recorded');
  const next = cloneNamingRightsState(state);
  next.response = responseId;
  next.shenPosition = response.shenPosition;
  if (!next.sceneHistory.includes('half-photo')) next.sceneHistory.push('half-photo');
  return next;
}

function hasAction(state, actionId) {
  return state.freeTime.records.some(record => record.actionId === actionId);
}

function callbackReady(state, callback) {
  if (callback === 'always') return true;
  if (callback === 'history') return hasAction(state, 'archive') || state.response === 'restore-history';
  if (callback === 'shen') return state.voteRoute === 'co-name' || state.response === 'name-as-repair';
  return hasAction(state, callback);
}

export function startNamingMatch(state) {
  if (!state.voteRoute || !state.response) throw new Error('Vote and respond before the match');
  if (state.match) return state;
  const next = cloneNamingRightsState(state);
  next.match = {
    highlightIndex: 0,
    homeGoals: 0,
    awayGoals: 0,
    choices: [],
    callbackIds: [],
    complete: false
  };
  return next;
}

export function getNamingMatchMoment(state) {
  if (!state.match || state.match.complete) throw new Error('No active naming match moment');
  const moment = MATCH_MOMENTS[state.match.highlightIndex];
  if (!moment) throw new Error('No active naming match moment');
  return {
    ...moment,
    choices: moment.choices.map(choice => ({
      ...choice,
      callbackReady: callbackReady(state, choice.callback)
    }))
  };
}

export function resolveNamingHighlight(state, choiceId) {
  const moment = getNamingMatchMoment(state);
  const choice = moment.choices.find(item => item.id === choiceId);
  if (!choice) throw new TypeError('Invalid match choice');
  const next = cloneNamingRightsState(state);
  const remembered = choice.callbackReady;
  next.match.choices.push(choiceId);
  if (remembered) {
    next.match.homeGoals += 1;
    if (choice.callback !== 'always') next.match.callbackIds.push(choice.callback);
  }
  next.match.awayGoals += moment.awayPressure;
  next.match.highlightIndex += 1;
  next.match.complete = next.match.highlightIndex === MATCH_MOMENTS.length;
  return next;
}

export function settleNamingWeek(state) {
  if (!state.match?.complete || state.match.highlightIndex !== MATCH_MOMENTS.length) {
    throw new Error('Complete three match moments before settlement');
  }
  const route = VOTE_ROUTES[state.voteRoute];
  const response = REVEAL_RESPONSES[state.response];
  if (!route || !response) throw new Error('Naming decision is incomplete');
  const nextCrisis = state.voteRoute === 'co-name'
    ? '赞助方要求重新安排下周的社区开放时段。'
    : state.voteRoute === 'community-save'
      ? '自救金只够撑过这个月，下一场强队邀请费还没有着落。'
      : '白天比赛少卖了很多东西，欠下的灯光检修还在账上。';
  return {
    route: state.voteRoute,
    stadiumName: route.stadiumName,
    authority: route.authority,
    shenPosition: state.shenPosition,
    shenCopy: SHEN_POSITION_COPY[state.shenPosition],
    score: { home: state.match.homeGoals, away: state.match.awayGoals },
    callbacks: [...state.match.callbackIds],
    nextCrisis
  };
}
