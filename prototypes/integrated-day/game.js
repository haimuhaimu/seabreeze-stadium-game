import { getDayContent, getOrders, requiredInventoryForDay } from './daily-content.js';
import {
  getCampaignDay,
  getRequiredAction,
  isCampaignDay,
  isPrologueDay,
  isManagementWeekDay,
  isNamingRightsWeekDay
} from './campaign-content.js';
import {
  GATHERABLES,
  REPAIRS,
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
  resolveManagementShortfall,
  startWeeklyMatch,
  chooseMatchHighlight,
  completeEpisodeHearing,
  finishManagementDay,
  advanceCampaignDay,
  recordNpcConversation,
  beginNamingRightsWeek,
  completeNamingMainline,
  startNamingFreeAction,
  finishNamingFreeAction,
  startSecondWeeklyMatch,
  resolveSecondWeeklyMatchChoice,
  beginLeagueSeason,
  chooseEliteMatchChoice,
  chooseElitePreparation,
  chooseSeasonAction,
  chooseSeasonEventDecision,
  chooseSeasonNpcMemory,
  chooseSeasonNpcResponse,
  buildSeasonProject,
  visitSeasonProject,
  startLeagueMatch,
  resolveLeagueMatchChoice,
  advanceLeagueRound,
  beginNextLeagueSeason
} from './game-state.js';
import { loadSave, writeSave, clearSave } from './save-game.js';
import { TRAINING_TARGETS, createTrainingSession, takeShot } from './training-game.js';
import { getMap, getMapObjects, getNamingActionObjects, getSeasonWorldObjects, canStandOnMap } from './world-content.js';
import { getNpcSchedule } from './npc-schedules.js';
import { getOpponent } from './opponent-content.js';
import { getAvailableHighlights } from './match-engine.js';
import { getAvailableVoteRoutes, getNamingMatchMoment } from './naming-rights-state.js';
import { getFreeActionTotals } from './free-time-state.js';
import { PROMISES, getEpisodeDay, getStoryScene } from './episode-content.js';
import {
  ARCHIVE_CLUES,
  createEpisodeActivity,
  inspectArchiveClue,
  serveFundraiser,
  takePass
} from './episode-activities.js';
import {
  FREE_ACTIONS,
  VOTE_ROUTES,
  REVEAL_RESPONSES,
  getFreeAction,
  getNamingDay,
  getNamingScene
} from './naming-rights-content.js';
import { getSeasonEliteMoment, getSeasonMatchMoment, getSeasonGoalStatus, getStandings, getMatchOutlook, getConstructionUnlocks } from './season-state.js';
import {
  CONSTRUCTION_MILESTONES,
  SEASON_ACTIONS,
  SEASON_GOALS,
  SEASON_PROJECTS,
  getLeagueTeam,
  getSeasonNpc,
  getSeasonProject,
  getSeasonRound
} from './season-content.js';
import { SEASON_EVENTS, getSeasonEvent, getSeasonEventChoice } from './season-events.js';
import { ELITE_OPPONENT, ELITE_PREPARATIONS, ELITE_RESULTS } from './elite-content.js';
import { getConstructionScene, getConstructionVisuals } from './construction-content.js';

const root = document.querySelector('.game');
const viewport = document.querySelector('[data-scene]');
const plane = document.querySelector('[data-world-plane]');
const worldMap = document.querySelector('[data-world-map]');
const worldContent = document.querySelector('[data-world-content]');
const player = document.querySelector('[data-player]');
const prompt = document.querySelector('[data-prompt]');
const toastHost = document.querySelector('[data-toast-host]');
const speech = document.querySelector('[data-speech]');
const morningLayer = document.querySelector('[data-morning-layer]');
const shopActors = document.querySelector('[data-shop-actors]');
const shopPanel = document.querySelector('[data-shop]');
const repairPanel = document.querySelector('[data-repairs]');
const notes = document.querySelector('[data-notes]');
const summary = document.querySelector('[data-summary]');
const chapterSummary = document.querySelector('[data-chapter-summary]');
const startCard = document.querySelector('[data-start-card]');
const trainingLayer = document.querySelector('[data-training]');
const decisionPanel = document.querySelector('[data-decision-panel]');
const matchPanel = document.querySelector('[data-match-panel]');
const storyScene = document.querySelector('[data-story-scene]');
const episodeActivity = document.querySelector('[data-episode-activity]');
const hearingPanel = document.querySelector('[data-hearing]');
const weekSummary = document.querySelector('[data-week-summary]');
const seasonConversation = document.querySelector('[data-season-conversation]');
const seasonEventPanel = document.querySelector('[data-season-event]');
const seasonBoard = document.querySelector('[data-season-board]');
const seasonSummary = document.querySelector('[data-season-summary]');
const elitePanel = document.querySelector('[data-elite-panel]');
const seasonDocket = document.querySelector('[data-season-docket]');
const stadiumSign = document.querySelector('[data-stadium-sign]');
const constructionVisuals = document.querySelector('[data-construction-visuals]');
const summaryDim = document.querySelector('[data-summary-dim]');
const resourceIcon = document.querySelector('.money-slot .item-sprite');
const touchControls = document.querySelector('.touch-controls');
const touchAction = document.querySelector('[data-action]');

const WALK_SPEED = new URLSearchParams(window.location.search).has('smoke') ? 900 : 230;
const ARRIVAL_DISTANCE = 8;
const INTERACTION_DISTANCE = 112;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const customerClasses = {
  林川: 'npc-linchuan',
  许姨: 'npc-sumi',
  乔可: 'npc-qiaoqiao',
  邓叔: 'npc-wenshu',
  小满: 'npc-assistant',
  郭教练: 'npc-guo'
};

const loaded = loadSave(localStorage);
let state = loaded.ok ? loaded.record.state : createGameState();
let activeMapId = loaded.ok ? (loaded.record.mapId ?? state.world.mapId) : 'training';
let position = loaded.ok ? loaded.record.position : { ...getMap(activeMapId).start };
let worldObjects = {};
let hasStarted = false;
let destination = null;
let pendingInteraction = null;
let movementRoute = [];
let toastTimer = 0;
let speechTimer = 0;
let lastFrame = performance.now();
let lastPositionSave = 0;
let moving = false;
let lastProximityId = Symbol('initial');
let trainingActive = false;
let trainingSession = null;
let trainingPointer = 0.5;
let trainingFeedback = '';
let newGameArmed = false;
let directWeekArmed = false;
let chapterResetArmed = false;
let weekResetArmed = false;
let decisionAction = null;
let storySceneId = null;
let storyReadOnly = false;
let promiseDraft = [];
let activeEpisodeActivity = null;
let activePromiseId = null;
let activeFreeActivity = null;
let ledgerOpen = false;
let weekSummaryDismissed = false;
let activeSeasonNpcId = null;
let activeSeasonEventId = null;
let seasonBoardOpen = false;
let elitePanelOpen = false;
let recentProjectBuildId = null;
let constructionRevealTimer = 0;
const pressedKeys = new Set();

function isLeagueSeason() {
  return Boolean(state.season?.active && state.dayIndex >= 17);
}

function isManagementMode() {
  return isCampaignDay(state.dayIndex) || isLeagueSeason();
}

function currentDay() {
  if (isLeagueSeason()) {
    const round = getSeasonRound(state.season.roundIndex);
    return {
      season: `联赛 ${state.season.seasonNumber}`,
      date: `第 ${round.round} 轮`,
      weekday: '比赛周',
      weather: round.playerHome ? '海风主场' : '客场来信'
    };
  }
  return isPrologueDay(state.dayIndex) ? getDayContent(state.dayIndex) : getCampaignDay(state.dayIndex);
}

function currentOrders() {
  return isPrologueDay(state.dayIndex) ? getOrders(state.dayIndex) : [];
}

const MAINLINE_OBJECTS = Object.freeze({
  'episode-notice': 'stadium-office',
  'episode-promises': 'coach',
  'episode-funding': 'pitch-prep',
  'episode-offer': 'stadium-office',
  'episode-match': 'match-center',
  'naming-proposal': 'guest-gate',
  'naming-chairs': 'stadium-office',
  'naming-alternative': 'pitch-prep',
  'naming-plaque': 'stadium-office',
  'naming-vote': 'match-center',
  'naming-response': 'stadium-office',
  'naming-match': 'match-center'
});

const ACTION_COPY = Object.freeze({
  'episode-notice': { title: '空白通知', goal: '去主赛场办公室看看那张还没有名字的通知。' },
  'episode-promises': { title: '门外的七号', goal: '去旧训练场找小满。今天只能先答应两件事。' },
  'episode-promise': { title: '只来得及两件事', goal: '在两个答应过的请求中，亲自完成今天这一件。' },
  'episode-funding': { title: '灯亮以前', goal: '到主赛场边决定灯光和小满下一周的工作。' },
  'episode-offer': { title: '沈峤的旧球员证', goal: '去主赛场办公室听完沈峤给出的真工作。' },
  'episode-match': { title: '比赛与五把椅子', goal: '走到中圈。比赛以后，让小满先说自己的选择。' },
  'naming-proposal': { title: '蓝布盖住了旧名字', goal: '去入口看看盖在旧招牌上的蓝色冠名布。' },
  'naming-chairs': { title: '五把椅子，五种条件', goal: '到办公室听完五个席位各自的底线。' },
  'naming-alternative': { title: '救命钱不是唯一的钱', goal: '去场边看看，今天还能亲手做成哪一件事。' },
  'naming-plaque': { title: '被刮掉的名字', goal: '旧仓库找到了一块创办人铭牌。去听郭教练说完。' },
  'naming-vote': { title: '第一次真正表决', goal: '五张纸票已经放在中圈。把你们的办法带过去。' },
  'naming-response': { title: '沈峤的半张合照', goal: '沈峤带着记者和半张合照来了。去办公室外回应他。' },
  'naming-match': { title: '招牌下的比赛', goal: '港口工人队已经入场。走到被蓝布盖住的招牌下。' }
});

const STORY_PROP_MAP = Object.freeze({ 'player-card': 'card' });
const STORY_PORTRAIT_MAP = Object.freeze({ 'aunt-xu': 'xu' });

const NAMING_PROP_CAPTIONS = Object.freeze({
  'covered-sign': '蓝布下面，只露出旧名字最后一个字',
  ballots: '五张纸票，没有一张可以替别人填写',
  'rescue-box': '许姨从小店里找出的旧铁盒',
  plaque: '沈峤那一行被人用力刮掉了',
  contract: '钱和决定权写在同一份协议里',
  'half-photo': '创办合照被整齐地裁掉了一半'
});

const FREE_ACTIVITY_SCENES = Object.freeze({
  shop: Object.freeze([
    Object.freeze({ title: '跑完步的孩子在等水', copy: '先照顾最需要的人。', options: Object.freeze([['先递温水', 1], ['先问他要不要买套餐', .55], ['让他自己找杯子', .7]]) }),
    Object.freeze({ title: '看台上的两位老人要一份热食', copy: '他们走得慢，东西要送过去。', options: Object.freeze([['亲自送到座位', 1], ['放在柜台等他们来拿', .65], ['请后面的客人顺手带去', .8]]) }),
    Object.freeze({ title: '找零以后，铁盒就在手边', copy: '今天的小店收入要留下什么？', options: Object.freeze([['把零钱放进自救箱', 1], ['只放整钞', .75], ['先记账，稍后再放', .6]]) })
  ]),
  training: Object.freeze([
    Object.freeze({ title: '有人跑出了空位', copy: '这次不需要复杂口令。', options: Object.freeze([['把球传给空位的人', 1], ['自己继续带球', .55], ['等教练喊名字', .7]]) }),
    Object.freeze({ title: '许小满刚刚传丢一球', copy: '他低着头往回走。', options: Object.freeze([['马上把下一球传回去', 1], ['先换另一个人', .55], ['让全队停下来等他', .75]]) }),
    Object.freeze({ title: '最后一脚留给谁', copy: '替补队员一直站在边线。', options: Object.freeze([['让替补完成最后一脚', 1], ['让主力稳稳结束', .7], ['由安若童自己踢', .6]]) })
  ]),
  repair: Object.freeze([
    Object.freeze({ title: '灯架底座在晃', copy: '风每次吹来，螺帽都会松一点。', options: Object.freeze([['先停电，再拧紧底座', 1], ['直接扶住灯架', .55], ['在旁边立一块提醒牌', .7]]) }),
    Object.freeze({ title: '看台有一块木板开裂', copy: '周日会有人坐到这里。', options: Object.freeze([['换掉整块木板', 1], ['用胶带贴住裂口', .55], ['把这个座位暂时封住', .8]]) }),
    Object.freeze({ title: '招牌绳结正在磨损', copy: '蓝布比旧招牌更吃风。', options: Object.freeze([['换绳并打双结', 1], ['再拉紧一点', .65], ['等周日早上处理', .5]]) })
  ]),
  community: Object.freeze([
    Object.freeze({ title: '孩子们想用半块场地', copy: '球队训练还有二十分钟。', options: Object.freeze([['划出一块共享区域', 1], ['让孩子等训练结束', .65], ['今天先请他们回去', .5]]) }),
    Object.freeze({ title: '入口摊主要借一个插座', copy: '她愿意把今天一部分收入放进自救箱。', options: Object.freeze([['检查线路后接给她', 1], ['让她自己找插座', .6], ['为了安全直接拒绝', .75]]) }),
    Object.freeze({ title: '有人问为什么要签名', copy: '不是每个人都熟悉球场的账。', options: Object.freeze([['把冠名条件读给大家听', 1], ['只说球场快没钱了', .65], ['让大家先签再解释', .5]]) })
  ]),
  archive: Object.freeze([
    Object.freeze({ title: '旧照片没有写年份', copy: '墙角还有一叠比赛海报。', options: Object.freeze([['按球衣和海报对照', 1], ['凭照片颜色猜年份', .6], ['只保留最清楚的一张', .55]]) }),
    Object.freeze({ title: '第一份章程有两种墨水', copy: '其中一处签名后来被覆盖。', options: Object.freeze([['对着光检查原签名', 1], ['只抄下现在能见的字', .6], ['请郭教练凭记忆补写', .7]]) }),
    Object.freeze({ title: '半张合照的另一半在旧信封里', copy: '撕口和沈峤手里那张完全吻合。', options: Object.freeze([['并排拍照，保留原件', 1], ['用胶水直接粘回去', .7], ['把两半分开收好', .65]]) })
  ])
});

function isEpisodeDayResolved() {
  if (!isManagementWeekDay(state.dayIndex)) return false;
  if (state.dayIndex === 3) return state.episode.sceneHistory.includes('blank-notice');
  if (state.dayIndex === 4) return state.episode.promisesChosen.length === 2;
  if ([5, 6].includes(state.dayIndex)) {
    return state.management.dailyRecords.some(record => record.dayIndex === state.dayIndex && record.actionId === 'episode-promise');
  }
  if (state.dayIndex === 7) return Boolean(state.episode.fridayFundingChoice);
  if (state.dayIndex === 8) return state.episode.shenOffer !== 'undecided';
  if (state.dayIndex === 9) return Boolean(state.episode.hearingChoice);
  return false;
}

function isNamingDayResolved() {
  if (!isNamingRightsWeekDay(state.dayIndex)) return false;
  return state.namingRights.sceneHistory.includes(getNamingDay(state.dayIndex).sceneId);
}

function isCurrentCampaignDayResolved() {
  return isNamingRightsWeekDay(state.dayIndex) ? isNamingDayResolved() : isEpisodeDayResolved();
}

function pendingPromiseIds() {
  return state.episode.promisesChosen.filter(id => !state.episode.promisesCompleted.includes(id));
}

function rebuildWorldObjects() {
  const map = getMap(activeMapId);
  const objects = {};
  const requiredAction = isCampaignDay(state.dayIndex) ? getRequiredAction(state.dayIndex) : null;
  const requiredObjectId = requiredAction ? MAINLINE_OBJECTS[requiredAction] : null;
  const promiseObjectIds = new Map();
  if ([5, 6].includes(state.dayIndex)) {
    for (const promiseId of pendingPromiseIds()) {
      promiseObjectIds.set(PROMISES[promiseId].worldObjectId, promiseId);
    }
  }

  for (const object of getMapObjects(activeMapId)) {
    if (isPrologueDay(state.dayIndex)) {
      objects[object.id] = { ...object };
    } else if (promiseObjectIds.has(object.id)) {
      const promiseId = promiseObjectIds.get(object.id);
      objects[object.id] = {
        ...object,
        kind: 'mainline',
        actionId: `promise:${promiseId}`,
        label: PROMISES[promiseId].label
      };
    } else if (object.id === requiredObjectId) {
      objects[object.id] = {
        ...object,
        kind: 'mainline',
        actionId: requiredAction,
        label: isCurrentCampaignDayResolved()
          ? '今天的决定已经完成'
          : requiredAction === 'episode-promises'
            ? '去看小满的七号背心'
            : ACTION_COPY[requiredAction].goal
      };
    }
  }

  if (isNamingRightsWeekDay(state.dayIndex)) {
    for (const object of getNamingActionObjects(activeMapId, state.dayIndex, state.namingRights)) {
      objects[object.id] = { ...object };
    }
  }

  if (isLeagueSeason()) {
    for (const object of getSeasonWorldObjects(activeMapId, state.season)) {
      objects[object.id] = { ...object };
    }
  }

  for (const exit of map.exits) {
    objects[exit.id] = { ...exit, kind: 'exit' };
  }

  const schedules = isManagementMode()
    ? getNpcSchedule(state.dayIndex, state.phase, {
        opponentId: state.management.opponentId,
        episode: state.episode,
        namingRights: state.namingRights,
        season: state.season
      })
    : [];
  for (const npc of schedules.filter(item => item.mapId === activeMapId)) {
    const guestSide = activeMapId === 'stadium' && npc.x < 15 && npc.y < 50;
    const stadiumApproach = guestSide
      ? { x: 4, y: Math.min(52, npc.y + 7) }
      : { x: npc.x, y: 68 };
    objects[`npc-${npc.id}`] = {
      id: `npc-${npc.id}`,
      x: npc.x,
      y: npc.y,
      approach: activeMapId === 'stadium'
        ? stadiumApproach
        : { x: npc.x, y: Math.min(94, npc.y + 8) },
      route: activeMapId !== 'stadium'
        ? []
        : guestSide
          ? [{ x: 30, y: 68 }, { x: 4, y: 68 }]
          : [{ x: 84, y: 88 }, { x: 84, y: 68 }],
      kind: 'npc',
      label: `和${npc.name}说话`,
      npc
    };
  }

  worldObjects = objects;
}

function formatTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

let storageWriteBlocked = false;
function persist() {
  if (!hasStarted) return;
  state.world.mapId = activeMapId;
  state.world.positions[activeMapId] = { ...position };
  const result = writeSave(localStorage, state, position, activeMapId);
  if (!result.ok && !storageWriteBlocked) {
    storageWriteBlocked = true;
    const warning = document.querySelector('[data-storage-warning]');
    if (warning) warning.hidden = false;
  }
  lastPositionSave = performance.now();
}

function hasIngredients(inventory, required) {
  return Object.entries(required).every(([key, amount]) => inventory[key] >= amount);
}

function isShopReady() {
  return hasIngredients(state.inventory, requiredInventoryForDay(state.dayIndex));
}

const viewMetrics = { planeWidth: 0, planeHeight: 0, viewportWidth: 0, viewportHeight: 0 };

function refreshViewMetrics() {
  viewMetrics.planeWidth = plane.clientWidth;
  viewMetrics.planeHeight = plane.clientHeight;
  viewMetrics.viewportWidth = viewport.clientWidth;
  viewMetrics.viewportHeight = viewport.clientHeight;
}

function toPixels(point) {
  return {
    x: point.x * viewMetrics.planeWidth / 100,
    y: point.y * viewMetrics.planeHeight / 100
  };
}

function pixelDistance(a, b) {
  const pa = toPixels(a);
  const pb = toPixels(b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

function canStand(x, y) {
  return canStandOnMap(activeMapId, x, y);
}

function availableObject(id) {
  if (!hasStarted || trainingActive || activeEpisodeActivity || activeFreeActivity || storySceneId || state.phase !== 'morning') return false;
  if (GATHERABLES[id] && state.collectedToday.includes(id)) return false;
  const object = worldObjects[id];
  if (!object) return false;
  if (isCampaignDay(state.dayIndex) && object.kind === 'mainline') {
    if (object.actionId.startsWith('promise:')) {
      const promiseId = object.actionId.split(':')[1];
      return [5, 6].includes(state.dayIndex)
        && state.episode.promisesChosen.includes(promiseId)
        && !state.episode.promisesCompleted.includes(promiseId)
        && !isEpisodeDayResolved();
    }
    return !isCurrentCampaignDayResolved();
  }
  return true;
}

function nearestObject() {
  if (state.phase !== 'morning') return null;
  let closest = null;
  for (const [id, object] of Object.entries(worldObjects)) {
    if (!availableObject(id)) continue;
    const distance = pixelDistance(position, object);
    if (distance <= INTERACTION_DISTANCE && (!closest || distance < closest.distance)) {
      closest = { id, ...object, distance };
    }
  }
  return closest;
}

function showToast(text) {
  if (!text) return;
  window.clearTimeout(toastTimer);
  toastHost.replaceChildren();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  toastHost.appendChild(toast);
  toastTimer = window.setTimeout(() => toast.remove(), 2600);
}

function showSpeech(name, copy, point, duration = 3600) {
  window.clearTimeout(speechTimer);
  document.querySelector('[data-speech-name]').textContent = name;
  document.querySelector('[data-speech-copy]').textContent = copy;
  speech.style.left = `${point.x}%`;
  speech.style.top = `${point.y}%`;
  speech.hidden = false;
  speechTimer = window.setTimeout(() => { speech.hidden = true; }, duration);
}

function applyTransition(transition, successCheck) {
  const previous = state;
  state = transition(state);
  const successful = successCheck ? successCheck(previous, state) : previous !== state;
  showToast(state.journal.at(-1)?.text);
  if (successful) persist();
  render();
  return successful;
}

function inventoryShortageCopy() {
  const required = requiredInventoryForDay(state.dayIndex);
  const labels = { tea: '茶', fruit: '果子', cloth: '布', water: '水' };
  const shortages = Object.entries(required)
    .map(([key, amount]) => [labels[key], Math.max(0, amount - state.inventory[key])])
    .filter(([, amount]) => amount > 0)
    .map(([label, amount]) => `${label} ${amount}`);
  return shortages.join('、');
}

function phaseDetails() {
  if (isLeagueSeason()) {
    const round = getSeasonRound(state.season.roundIndex);
    const opponent = getLeagueTeam(round.playerOpponentId);
    const actions = state.season.week.actions.length;
    const talked = state.season.week.talkedNpcIds.length;
    const rank = getStandings(state.season).findIndex(row => row.teamId === 'haifeng') + 1;
    const event = getSeasonEvent(state.season.roundIndex, state.season.seasonNumber);
    const eventPending = !state.season.week.eventChoiceId;
    const eventPlace = event.mapId === 'training' ? '旧训练场' : '海风主赛场';
    return {
      title: state.season.seasonComplete
        ? `第 ${state.season.seasonNumber} 赛季结束`
        : state.phase === 'complete'
          ? `第 ${round.round} 轮结束`
          : `海风联赛 · 第 ${round.round} 轮`,
      goal: state.phase === 'complete'
        ? state.season.seasonComplete
          ? `最终排名第 ${rank}。建设和关系会保留到下个赛季。`
          : '本轮积分已经更新。准备好后进入下一轮。'
        : actions < 3
          ? `本轮对阵${opponent.name}。安排三件事，也可以先和人谈谈。${eventPending ? `${eventPlace}还有一件事：${event.title}。` : ''}已谈 ${talked} 人。`
          : eventPending
            ? `三项安排已经完成。去${eventPlace}回应“${event.title}”。`
            : '三项安排和本轮事件都已处理。去主赛场中圈进入比赛。',
      label: '现金',
      value: `${state.economy.cash}元`,
      icon: 'item-coins'
    };
  }
  if (isNamingRightsWeekDay(state.dayIndex)) {
    const actionId = getRequiredAction(state.dayIndex);
    const action = ACTION_COPY[actionId];
    const completed = isNamingDayResolved();
    const totals = getFreeActionTotals(state.namingRights.freeTime);
    const activeAction = state.namingRights.freeTime.activeAction;
    return {
      title: state.namingRights.weekComplete
        ? '第二周已经结算'
        : state.phase === 'complete'
          ? '今天的选择已经留下'
          : action.title,
      goal: state.namingRights.weekComplete
        ? `蓝布已经落下。这里现在叫${state.namingRights.settlement.stadiumName}。`
        : state.phase === 'complete'
          ? state.dayIndex === 16 ? '招牌已经揭开，这一周的结果已经保存。' : '今天已经结束，可以去往下一天。'
          : !completed
            ? action.goal
            : activeAction
              ? `把${getFreeAction(activeAction.actionId).label}认真做完。`
              : state.namingRights.freeTime.available
                ? '主线已经回应。现在可以在球场上选择一件自由行动，也可以休息。'
                : actionId === 'naming-match'
                  ? '走进比赛，终场以后揭开招牌。'
                  : '今天的决定已经完成。',
      label: '自救金',
      value: `${totals.fund}元`,
      icon: 'item-coins'
    };
  }
  if (isManagementWeekDay(state.dayIndex)) {
    const actionId = getRequiredAction(state.dayIndex);
    const action = ACTION_COPY[actionId];
    const completed = isEpisodeDayResolved();
    const remaining = pendingPromiseIds().map(id => PROMISES[id].label);
    const promiseGoal = remaining.length
      ? `还答应了：${remaining.join('、')}。去对应的场地亲自完成一件。`
      : action.goal;
    return {
      title: state.management.weekComplete ? '第一周已经结算' : state.phase === 'complete' ? '今天的决定已经记下' : actionId === 'episode-promise' ? currentDay().title : action.title,
      goal: state.management.weekComplete
        ? '可以继续在球场走走。这一周的结果已经保存。'
        : state.phase === 'complete'
        ? state.dayIndex === 9 ? '这一周已经结算。' : '今天已经结束，可以去往下一天。'
        : completed
          ? '决定已经完成。准备好以后，收好今天的记录。'
          : actionId === 'episode-promise' ? promiseGoal : action.goal,
      label: '现金',
      value: `${state.economy.cash}元`,
      icon: 'item-coins'
    };
  }
  if (state.phase === 'morning') {
    const trainingHint = currentDay().trainingAvailable && !state.training.completedToday
      ? ' 郭教练也在等你踢三脚。'
      : '';
    return {
      title: currentDay().title,
      goal: isShopReady()
        ? `备料齐了。去小店把木牌翻过来。${trainingHint}`
        : `沿场边准备今天的订单，还缺 ${inventoryShortageCopy()}。${trainingHint}`,
      label: '体力',
      value: String(state.energy),
      icon: 'item-tea'
    };
  }
  if (state.phase === 'shop') {
    const order = currentOrders()[state.ordersServed];
    return {
      title: '场边小店',
      goal: `柜台前还有 ${currentOrders().length - state.ordersServed} 位客人。${order.customer}正在等。`,
      label: '零钱',
      value: `${state.money}元`,
      icon: 'item-coins'
    };
  }
  if (state.phase === 'evening') {
    return {
      title: '傍晚的场地',
      goal: state.eveningChoice ? '今晚的安排定好了，可以回屋休息。' : '修缮一处，或者把今天的钱存下。',
      label: '零钱',
      value: `${state.money}元`,
      icon: 'item-coins'
    };
  }
  return {
    title: '夜晚',
    goal: state.dayIndex === 2 ? '友谊赛散场了，大家还没有急着离开。' : '今天留下的东西，明天仍然看得见。',
    label: '零钱',
    value: `${state.money}元`,
    icon: 'item-coins'
  };
}

function renderCalendar() {
  const day = currentDay();
  document.querySelector('[data-date]').textContent = `${day.season} ${day.date}`;
  document.querySelector('[data-weather]').textContent = day.weather;
}

function renderPhases() {
  const track = document.querySelector('.phase-track');
  if (isLeagueSeason()) {
    if (track.dataset.mode !== 'season') {
      track.dataset.mode = 'season';
      track.classList.add('week-track', 'season-track');
      track.innerHTML = Array.from({ length: 7 }, (_, offset) => (
        `<li data-season-round="${offset}"><span>第 ${offset + 1} 轮</span><strong>${offset === 6 ? '收官' : '联赛'}</strong></li>`
      )).join('');
    }
    track.querySelectorAll('[data-season-round]').forEach(step => {
      const roundIndex = Number(step.dataset.seasonRound);
      step.classList.toggle('active', roundIndex === state.season.roundIndex);
      step.classList.toggle('done', roundIndex < state.season.roundIndex || (roundIndex === state.season.roundIndex && state.phase === 'complete'));
    });
    return;
  }
  if (isCampaignDay(state.dayIndex)) {
    const weekStart = isNamingRightsWeekDay(state.dayIndex) ? 10 : 3;
    const weekMode = `week-${weekStart}`;
    if (track.dataset.mode !== weekMode) {
      track.dataset.mode = weekMode;
      track.classList.add('week-track');
      track.innerHTML = Array.from({ length: 7 }, (_, offset) => {
        const dayIndex = offset + weekStart;
        const day = getCampaignDay(dayIndex);
        return `<li data-week-day="${dayIndex}"><span>${day.weekday}</span><strong>${day.date}日</strong></li>`;
      }).join('');
    }
    track.querySelectorAll('[data-week-day]').forEach(step => {
      const dayIndex = Number(step.dataset.weekDay);
      step.classList.toggle('active', dayIndex === state.dayIndex);
      step.classList.toggle('done', dayIndex < state.dayIndex || (dayIndex === state.dayIndex && state.phase === 'complete'));
    });
    return;
  }

  if (track.dataset.mode?.startsWith('week-') || track.dataset.mode === 'season') {
    track.dataset.mode = 'day';
    track.classList.remove('week-track', 'season-track');
    track.innerHTML = [
      ['morning', '上午', '沿场走走'],
      ['shop', '下午', '开一会儿店'],
      ['evening', '傍晚', '留下一处变化'],
      ['complete', '夜晚', '回屋休息']
    ].map(([phase, label, copy]) => `<li data-phase-step="${phase}"><span>${label}</span><strong>${copy}</strong></li>`).join('');
  }
  const order = ['morning', 'shop', 'evening', 'complete'];
  const currentIndex = order.indexOf(state.phase);
  document.querySelectorAll('[data-phase-step]').forEach(step => {
    const stepIndex = order.indexOf(step.dataset.phaseStep);
    step.classList.toggle('active', stepIndex === currentIndex);
    step.classList.toggle('done', stepIndex < currentIndex);
  });
}

function renderJournal() {
  const log = document.querySelector('[data-journal-log]');
  log.innerHTML = state.journal.slice(-7).map(entry => (
    `<li><time>${formatTime(entry.minute)}</time>${entry.text}</li>`
  )).join('');

  const history = document.querySelector('[data-history-log]');
  history.hidden = state.history.length === 0;
  history.innerHTML = state.history.length
    ? `<span>前几天</span>${state.history.map(day => `<p>春 ${day.date}：接待 ${getOrders(day.dayIndex).length} 人，余下 ${day.money} 元</p>`).join('')}`
    : '';
}

function updateProximity(force = false) {
  const nearby = nearestObject();
  const proximityId = nearby?.id ?? null;
  if (!force && lastProximityId === proximityId) return;
  lastProximityId = proximityId;
  document.querySelectorAll('[data-object]').forEach(element => {
    element.classList.toggle('nearby', nearby?.id === element.dataset.object);
  });

  prompt.classList.toggle('active', Boolean(nearby));
  if (trainingActive) {
    prompt.innerHTML = '<kbd>E</kbd><span>射门</span><small>看准珊瑚色区域</small>';
  } else if (state.phase === 'morning') {
    prompt.innerHTML = nearby
      ? `<kbd>E</kbd><span>${nearby.label}</span><small>已经走到附近</small>`
      : '<kbd>WASD</kbd><span>走动</span><kbd>E</kbd><span>互动</span><small>也可以点击要去的地方</small>';
  } else if (state.phase === 'shop') {
    prompt.innerHTML = '<small>看一眼客人的需要，再从柜台上选择</small>';
  } else if (state.phase === 'evening') {
    prompt.innerHTML = '<small>今晚也可以先把钱存下</small>';
  }
  prompt.hidden = !hasStarted || state.phase === 'complete';
}

function makeWorldButton(id, object) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'world-target';
  button.dataset.object = id;
  button.style.setProperty('--x', `${object.x}%`);
  button.style.setProperty('--y', `${object.y}%`);
  button.setAttribute('aria-label', object.label);

  if (object.kind === 'npc') {
    button.classList.add('npc-target', 'scheduled-npc');
    const shadow = document.createElement('span');
    shadow.className = 'actor-shadow';
    const sprite = document.createElement('span');
    sprite.className = `npc-sprite ${object.npc.spriteClass}`;
    const name = document.createElement('span');
    name.className = 'world-name';
    name.textContent = object.npc.name;
    button.append(shadow, sprite, name);
  } else {
    button.classList.add(object.kind === 'exit' ? 'exit-target' : 'mainline-target');
    if (object.kind === 'free-action') button.classList.add('free-action-target');
    if (object.kind.startsWith('season-')) {
      button.classList.add('season-world-target', object.kind === 'season-event' ? 'season-event-target' : object.kind);
    }
    if (object.kind === 'season-project') {
      button.dataset.level = String(object.level);
      button.dataset.visited = String(object.visited);
      button.dataset.built = String(object.level > 0);
      button.dataset.buildAvailable = String(object.buildAvailable);
    }
    const ring = document.createElement('span');
    ring.className = 'target-ring';
    const marker = document.createElement('span');
    marker.className = object.kind === 'exit' ? 'exit-marker' : 'mainline-marker';
    marker.textContent = object.kind === 'exit'
      ? '海风路'
      : object.kind === 'free-action'
        ? getFreeAction(object.actionId.split(':')[1]).label
        : object.kind === 'season-action'
          ? SEASON_ACTIONS[object.actionId].label
          : object.kind === 'season-project'
            ? object.level > 0
              ? `${getConstructionScene(object.projectId).levels[object.level - 1].label} ${object.level}/3`
              : `${getSeasonProject(object.projectId).label} 待开工`
            : object.kind === 'season-event'
              ? '回应本轮事件'
            : object.kind === 'season-match'
              ? '进入本轮比赛'
              : '处理';
    button.append(ring, marker);
  }
  return button;
}

function renderConstructionVisuals() {
  const visible = isLeagueSeason();
  constructionVisuals.hidden = !visible;
  if (!visible) {
    constructionVisuals.replaceChildren();
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const visual of getConstructionVisuals(activeMapId, state.season.projects)) {
    const item = document.createElement('div');
    item.className = `construction-visual construction-${visual.projectId}${visual.complete ? ' is-complete' : ''}${recentProjectBuildId === visual.projectId ? ' is-revealing' : ''}`;
    item.dataset.constructionProject = visual.projectId;
    item.dataset.level = String(visual.level);
    item.style.setProperty('--construction-x', `${visual.x}%`);
    item.style.setProperty('--construction-y', `${visual.y}%`);
    item.style.setProperty('--construction-width', `${visual.width}%`);
    item.style.setProperty('--construction-height', `${visual.height}%`);
    const plaque = document.createElement('span');
    plaque.className = 'construction-plaque';
    const progress = document.createElement('small');
    progress.textContent = visual.complete ? '稳定运营' : `${visual.level} / 3`;
    const label = document.createElement('strong');
    label.textContent = visual.stageLabel;
    plaque.append(progress, label);
    item.append(plaque);
    fragment.append(item);
  }
  constructionVisuals.replaceChildren(fragment);
}

function renderStadiumSign() {
  const visible = activeMapId === 'stadium' && (isNamingRightsWeekDay(state.dayIndex) || isLeagueSeason());
  stadiumSign.hidden = !visible;
  if (!visible) return;
  const routeId = state.namingRights.voteRoute;
  const signMode = routeId === 'co-name' ? 'co-name' : routeId === 'community-save' ? 'community' : routeId === 'delay' ? 'delay' : isLeagueSeason() ? 'community' : 'covered';
  stadiumSign.dataset.sign = signMode;
  stadiumSign.querySelector('.stadium-name-old').textContent = '海风球场';
  stadiumSign.querySelector('.stadium-name-cloth').textContent = routeId === 'co-name' ? '澜岸' : '澜岸体育';
  stadiumSign.setAttribute('aria-label', routeId
    ? `球场招牌现在是${VOTE_ROUTES[routeId].stadiumName}`
    : '海风球场旧招牌被蓝色冠名布盖住');
}

function renderDynamicWorldContent() {
  const fragment = document.createDocumentFragment();
  for (const [id, object] of Object.entries(worldObjects)) {
    if (['tea-a', 'tea-b', 'fruit-a', 'fruit-b', 'coach', 'shop'].includes(id)) continue;
    if (!availableObject(id)) continue;
    fragment.append(makeWorldButton(id, object));
  }
  worldContent.replaceChildren(fragment);
}

function renderWorldTargets() {
  rebuildWorldObjects();
  const map = getMap(activeMapId);
  root.dataset.map = activeMapId;
  worldMap.src = map.image;
  worldMap.alt = map.alt;
  document.querySelector('[data-map-label]').textContent = map.label;

  morningLayer.hidden = state.phase !== 'morning' || activeMapId !== 'training';
  morningLayer.querySelectorAll('[data-object]').forEach(element => {
    element.hidden = !availableObject(element.dataset.object);
  });

  const coach = document.querySelector('[data-object="coach"]');
  if (worldObjects.coach) {
    const trainingReady = isPrologueDay(state.dayIndex)
      && currentDay().trainingAvailable
      && !state.training.completedToday;
    coach.classList.toggle('met', state.relationship.coachMet);
    coach.setAttribute('aria-label', trainingReady ? '和郭教练踢三脚' : worldObjects.coach.label);
    if (trainingReady) worldObjects.coach.label = '和郭教练踢三脚';
  }

  const door = document.querySelector('[data-open-shop]');
  const shopReady = isPrologueDay(state.dayIndex) && isShopReady();
  door.classList.toggle('ready', shopReady);
  document.querySelector('[data-door-label]').textContent = isManagementWeekDay(state.dayIndex)
    ? worldObjects.shop?.actionId === 'promise:fundraise' ? '和许姨开店筹钱' : '场边小店'
    : shopReady ? '可以开店' : '场边小店';

  renderStadiumSign();
  renderConstructionVisuals();
  renderDynamicWorldContent();
  updateProximity(true);
}

function setCustomerSprite(customer) {
  const sprite = document.querySelector('[data-customer-sprite]');
  sprite.className = 'npc-sprite';
  sprite.classList.add(customerClasses[customer] ?? 'npc-assistant');
}

function orderCopy(order) {
  if (order.recipe === 'tea') return '刚从场上下来，想喝一杯青草茶。';
  if (order.recipe === 'fruit') return '海风吹得口干，想要一杯凉的果子水。';
  return '手上沾了球网的灰，想拿一条干净毛巾。';
}

function renderShop() {
  const active = state.phase === 'shop';
  shopPanel.hidden = !active;
  shopActors.hidden = !active;
  if (!active) return;
  const order = currentOrders()[state.ordersServed];
  document.querySelector('[data-customer-name]').textContent = order.customer;
  document.querySelector('[data-order-copy]').textContent = orderCopy(order);
  setCustomerSprite(order.customer);
}

function renderRepairs() {
  repairPanel.hidden = state.phase !== 'evening';
  document.querySelectorAll('[data-repair]').forEach(button => {
    const repairId = button.dataset.repair;
    const repair = REPAIRS[repairId];
    button.hidden = state.repairs.includes(repairId);
    button.disabled = Boolean(state.eveningChoice) || state.money < repair.cost;
  });
  const saveButton = document.querySelector('[data-save-money]');
  saveButton.classList.toggle('selected', state.eveningChoice === 'save');
  saveButton.disabled = Boolean(state.eveningChoice);
  document.querySelector('[data-finish-day]').disabled = !state.eveningChoice;

  document.querySelectorAll('[data-repair-visual]').forEach(visual => {
    visual.hidden = activeMapId !== 'training' || !state.repairs.includes(visual.dataset.repairVisual);
  });
}

function choiceLabel(actionId, choiceId) {
  if (actionId === 'episode-notice') return '先听完每个人';
  if (actionId === 'episode-promises') return choiceId.split('+').map(id => PROMISES[id]?.label ?? id).join('、');
  if (actionId === 'episode-promise') return PROMISES[choiceId]?.label ?? choiceId;
  if (actionId === 'episode-funding') {
    return {
      'pay-lights': '先付灯光复检',
      'protect-work': '保住小满下一周的工作',
      'shen-advance': '接受沈峤垫款',
      'pay-both': '灯和工作都付'
    }[choiceId] ?? choiceId;
  }
  if (actionId === 'episode-offer') return '让小满自己回答';
  if (actionId === 'episode-match') return '完成比赛与听证';
  if (actionId === 'naming-proposal') return '周五公开表决';
  if (actionId === 'naming-chairs') return '写下五种条件';
  if (actionId === 'naming-alternative') return '打开每天的自由时间';
  if (actionId === 'naming-plaque') return '公开承认创办历史';
  if (actionId === 'naming-vote') return VOTE_ROUTES[choiceId]?.label ?? choiceId;
  if (actionId === 'naming-response') return REVEAL_RESPONSES[choiceId]?.label ?? choiceId;
  if (actionId === 'naming-match') return '完成比赛并揭开招牌';
  return choiceId;
}

function getDecisionConfig(actionId) {
  if (actionId === 'resolve-shortfall') {
    return {
      kicker: '现金周转',
      title: '账本已经低于零',
      copy: '球场不会立刻关门，但这次缺口必须由某个人承担。',
      options: [
        { id: 'delay', label: '延迟一项支出', detail: '现金回到 0 / 郭教练信任 -1' },
        { id: 'community', label: '请求社区短期援助', detail: '现金回到 0 / 社区支持 -6' },
        { id: 'shen', label: '接受沈峤过桥资金', detail: '现金回到 0 / 沈峤影响 +1' }
      ]
    };
  }
  if (actionId.startsWith('season-action:')) {
    const seasonActionId = actionId.slice('season-action:'.length);
    const action = SEASON_ACTIONS[seasonActionId];
    if (!action) return null;
    const effects = [];
    if (action.effects.attack) effects.push(`进攻 +${action.effects.attack}`);
    if (action.effects.defense) effects.push(`防守 +${action.effects.defense}`);
    if (action.effects.cohesion) effects.push(`凝聚 +${action.effects.cohesion}`);
    if (action.effects.cash) effects.push(`现金 +${action.effects.cash}`);
    if (action.effects.community) effects.push(`社区 +${action.effects.community}`);
    if (action.effects.facility) effects.push(`球场 +${action.effects.facility}`);
    if (seasonActionId === 'rest') effects.push('体力恢复');
    return {
      kicker: `本轮行动 ${state.season.week.actions.length + 1} / 3`,
      title: action.label,
      copy: `${action.place}。这会占用本轮三个行动位中的一个。`,
      options: [{ id: seasonActionId, label: '就把今天留给这件事', detail: effects.join(' / ') || '让这一周稳稳向前' }]
    };
  }
  if (actionId.startsWith('season-project:')) {
    const projectId = actionId.slice('season-project:'.length);
    const project = SEASON_PROJECTS[projectId];
    if (!project) return null;
    const currentLevel = state.season.projects[projectId];
    const scene = getConstructionScene(projectId);
    const currentStage = currentLevel ? scene.levels[currentLevel - 1] : null;
    const upgrade = project.levels[currentLevel] ?? null;
    const affordable = upgrade ? state.economy.cash >= upgrade.cost : false;
    const alreadyBuilt = state.season.week.actions.includes(`build:${projectId}`);
    const actionsFull = state.season.week.actions.length >= 3;
    const visited = state.season.week.visitedProjectIds.includes(projectId);
    const options = [];
    if (currentLevel > 0) {
      options.push({
        id: `visit:${projectId}`,
        label: visited ? `本轮已经和${getSeasonNpc(scene.patronId).name}来过` : `和${getSeasonNpc(scene.patronId).name}一起用一会儿`,
        detail: visited ? '下一轮还可以再来' : '12 分钟 / 不占经营行动 / 关系 +1',
        disabled: visited
      });
    }
    if (upgrade) {
      const blocked = !affordable || alreadyBuilt || actionsFull;
      const blockedLabel = !affordable
        ? `还缺 ${upgrade.cost - state.economy.cash} 元`
        : alreadyBuilt
          ? '这轮已经完成一次建设'
          : actionsFull
            ? '本轮三个行动已经排满'
            : null;
      options.push({
        id: projectId,
        label: blockedLabel ?? `投入 ${upgrade.cost} 元继续建设`,
        detail: blocked ? '不会消耗现金或行动位' : `完成${upgrade.label}，达到 ${currentLevel + 1} / 3 级`,
        disabled: blocked
      });
    }
    return {
      kicker: `${project.label} ${currentLevel} / 3`,
      title: currentStage?.label ?? upgrade.label,
      copy: currentStage
        ? `${currentStage.copy}账上现有 ${state.economy.cash} 元。`
        : `这里仍被施工布盖着。建设会永久保留，账上现有 ${state.economy.cash} 元。`,
      options
    };
  }
  return null;
}

function renderDecisionPanel() {
  const config = decisionAction && decisionAction !== 'play-match' ? getDecisionConfig(decisionAction) : null;
  decisionPanel.hidden = !config;
  if (!config) return;
  document.querySelector('[data-decision-kicker]').textContent = config.kicker;
  document.querySelector('[data-decision-title]').textContent = config.title;
  document.querySelector('[data-decision-copy]').textContent = config.copy;
  const ledger = document.querySelector('[data-ledger-preview]');
  ledger.hidden = true;
  ledger.replaceChildren();
  document.querySelector('[data-decision-close]').hidden = decisionAction === 'resolve-shortfall';
  document.querySelector('[data-decision-options]').innerHTML = config.options.map(option => (
    `<button type="button" data-decision-choice="${option.id}"${option.disabled ? ' disabled' : ''}><strong>${option.label}</strong><small>${option.detail}</small></button>`
  )).join('');
}

function openStoryScene(sceneId, { readOnly = false } = {}) {
  storySceneId = sceneId;
  storyReadOnly = readOnly;
  promiseDraft = state.episode.promisesChosen.length ? [...state.episode.promisesChosen] : [];
  decisionAction = null;
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  notes.hidden = true;
  render();
}

function storyOption(id, label, detail = '', disabled = false) {
  return `<button type="button" data-story-action="${id}"${disabled ? ' disabled' : ''}><strong>${label}</strong>${detail ? `<small>${detail}</small>` : ''}</button>`;
}

function renderStoryScene() {
  storyScene.hidden = !storySceneId;
  if (!storySceneId) return;
  const namingScene = isNamingRightsWeekDay(state.dayIndex);
  const scene = namingScene ? getNamingScene(storySceneId) : getStoryScene(storySceneId);
  const day = currentDay();
  const portrait = document.querySelector('[data-story-portrait]');
  const prop = document.querySelector('[data-story-prop]');
  portrait.dataset.character = STORY_PORTRAIT_MAP[scene.portraitId] ?? scene.portraitId;
  prop.dataset.prop = STORY_PROP_MAP[scene.propId] ?? scene.propId;
  document.querySelector('[data-story-kicker]').textContent = `${day.weekday} / 春 ${day.date} 日`;
  document.querySelector('[data-story-speaker]').textContent = scene.speaker;
  document.querySelector('[data-story-beats]').innerHTML = scene.beats.map(beat => `<p>${beat}</p>`).join('');
  const captions = {
    notice: '名字那一栏仍然空着',
    bib: '门外那件褪色的七号背心',
    card: '沈峤二十年前的旧球员证',
    chairs: '中圈里正好放着五把椅子'
  };
  document.querySelector('[data-story-prop-caption]').textContent = NAMING_PROP_CAPTIONS[prop.dataset.prop] ?? captions[prop.dataset.prop];

  const picker = document.querySelector('[data-promise-picker]');
  const choosingPromises = storySceneId === 'seven-bib' && !storyReadOnly && !state.episode.promisesChosen.length;
  picker.hidden = !choosingPromises;
  picker.innerHTML = choosingPromises
    ? Object.values(PROMISES).map(promise => {
        const selected = promiseDraft.includes(promise.id);
        const detail = promise.id === 'train'
          ? '在旧训练场陪小满传三次球'
          : promise.id === 'fundraise'
            ? '在场边小店照顾三位客人'
            : '去主赛场办公室找三条旧记录';
        return `<button type="button" data-promise-pick="${promise.id}" aria-pressed="${selected}"><strong>${promise.label}</strong><small>${detail}</small></button>`;
      }).join('')
    : '';

  let options = '';
  if (!storyReadOnly && storySceneId === 'blank-notice') {
    options = storyOption('acknowledge-notice', '先听完每个人', '不在空白处写下任何名字');
  }
  if (choosingPromises) {
    options = storyOption('confirm-promises', promiseDraft.length === 2 ? '就先答应这两件事' : `还要选择 ${2 - promiseDraft.length} 件`, '第三件事会成为本周没有来得及回应的请求', promiseDraft.length !== 2);
  }
  if (!storyReadOnly && storySceneId === 'friday-funding') {
    const canPayBoth = state.episode.fundraisingTotal >= 48;
    options = [
      storyOption('funding:pay-lights', '先付灯光复检', '周日球场能亮，小满下一周的工作暂停'),
      storyOption('funding:protect-work', '保住小满下一周的工作', '灯光复检延后，球场要承担比赛风险'),
      storyOption('funding:shen-advance', '接受沈峤的垫款', '两笔都能付，但他取得书面干预权'),
      storyOption('funding:pay-both', canPayBoth ? '用筹款把两笔都付了' : '筹款还不够付两笔', canPayBoth ? '只有公开筹款达到 48 元才能做到' : `现在只筹到 ${state.episode.fundraisingTotal} 元`, !canPayBoth)
    ].join('');
  }
  if (!storyReadOnly && storySceneId === 'shen-offer') {
    options = storyOption('acknowledge-offer', '听完，让小满自己回答', state.episode.truthKnown ? '旧球员证已经证明沈峤当年也被丢下过' : '这份工作是真的，他的旧事仍只说了一半');
  }
  if (!storyReadOnly && storySceneId === 'sunday-match') {
    options = storyOption('start-match', '走进主场', '海岬大学联队已经在另一侧热身');
  }
  if (namingScene && !storyReadOnly && scene.choices.length) {
    options = scene.choices.map(choice => storyOption(choice.id, choice.label, choice.detail)).join('');
  }
  if (namingScene && !storyReadOnly && storySceneId === 'first-vote') {
    options = getAvailableVoteRoutes(state.namingRights).map(route => {
      const missing = route.disabled
        ? `还缺 ${route.missingFund} 元自救金和 ${route.missingSignatures} 个签名`
        : route.detail;
      return storyOption(`naming-vote:${route.id}`, route.label, missing, route.disabled);
    }).join('');
  }
  if (namingScene && !storyReadOnly && storySceneId === 'half-photo') {
    const evidence = getFreeActionTotals(state.namingRights.freeTime).evidence > 0;
    options = Object.values(REVEAL_RESPONSES).map(response => storyOption(
      `naming-response:${response.id}`,
      response.label,
      response.id === 'restore-history' && evidence ? '旧照片和章程已经能公开证明他的创办人身份' : response.detail
    )).join('');
  }
  document.querySelector('[data-story-options]').innerHTML = options;
}

function startEpisodePromiseActivity(promiseId) {
  if (!state.episode.promisesChosen.includes(promiseId) || state.episode.promisesCompleted.includes(promiseId)) return false;
  activePromiseId = promiseId;
  activeEpisodeActivity = createEpisodeActivity(promiseId);
  storySceneId = null;
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  render();
  return true;
}

function finishEpisodePromiseActivity(fundraisingMode = null) {
  if (!activeEpisodeActivity?.complete || !activePromiseId) return false;
  const previous = state;
  const payload = activePromiseId === 'fundraise' ? { fundraisingMode } : {};
  state = completeEpisodePromise(state, activePromiseId, payload);
  const changed = state !== previous;
  if (changed) {
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  activeEpisodeActivity = null;
  activePromiseId = null;
  decisionAction = state.management.shortfallPending ? 'resolve-shortfall' : null;
  render();
  return changed;
}

function startNamingFreeActivity(actionId) {
  const previous = state;
  state = startNamingFreeAction(state, actionId);
  const started = !previous.namingRights.freeTime.activeAction && Boolean(state.namingRights.freeTime.activeAction);
  if (!started) {
    showToast(state.journal.at(-1)?.text);
    render();
    return false;
  }
  persist();
  if (actionId === 'rest') {
    state = finishNamingFreeAction(state, { score: 1 });
    showToast(state.journal.at(-1)?.text);
    persist();
    render();
    return true;
  }
  activeFreeActivity = { actionId, step: 0, scoreTotal: 0, lastChoice: '' };
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  render();
  return true;
}

function takeNamingFreeChoice(quality, label) {
  if (!activeFreeActivity || activeFreeActivity.step >= 3) return false;
  activeFreeActivity = {
    ...activeFreeActivity,
    step: activeFreeActivity.step + 1,
    scoreTotal: activeFreeActivity.scoreTotal + Number(quality),
    lastChoice: label
  };
  renderEpisodeActivity();
  return true;
}

function finishNamingFreeActivity() {
  if (!activeFreeActivity || activeFreeActivity.step < 3) return false;
  const score = activeFreeActivity.scoreTotal / 3;
  const previous = state;
  state = finishNamingFreeAction(state, { score });
  const changed = state !== previous;
  if (changed) {
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  activeFreeActivity = null;
  render();
  return changed;
}

function renderEpisodeActivity() {
  episodeActivity.hidden = !activeEpisodeActivity && !activeFreeActivity;
  if (!activeEpisodeActivity && !activeFreeActivity) return;
  if (activeFreeActivity) {
    const action = FREE_ACTIONS[activeFreeActivity.actionId];
    const scenes = FREE_ACTIVITY_SCENES[activeFreeActivity.actionId];
    document.querySelector('[data-activity-kicker]').textContent = '今天只认真做这一件事';
    document.querySelector('[data-activity-title]').textContent = action.label;
    const stage = document.querySelector('[data-activity-stage]');
    document.querySelector('[data-activity-progress]').textContent = `${activeFreeActivity.step} / 3`;
    if (activeFreeActivity.step >= 3) {
      stage.innerHTML = `<h3>这件事今天做完了</h3><p>${action.resultCopy}</p><button type="button" data-free-finish>把结果放进周五的票箱</button>`;
    } else {
      const scene = scenes[activeFreeActivity.step];
      const feedback = activeFreeActivity.lastChoice ? `<small>刚才你选择了：${activeFreeActivity.lastChoice}</small>` : '';
      stage.innerHTML = `<h3>${scene.title}</h3><p>${scene.copy}</p>${feedback}<div class="activity-choices">${scene.options.map(([label, quality]) => `<button type="button" data-free-quality="${quality}">${label}</button>`).join('')}</div>`;
    }
    return;
  }
  const promise = PROMISES[activePromiseId];
  document.querySelector('[data-activity-kicker]').textContent = '今天只做一件事';
  document.querySelector('[data-activity-title]').textContent = promise.activityTitle;
  const stage = document.querySelector('[data-activity-stage]');
  let progress = '';

  if (activeEpisodeActivity.type === 'train') {
    progress = `${activeEpisodeActivity.step} / 3`;
    if (activeEpisodeActivity.complete) {
      const clean = activeEpisodeActivity.attempts.filter(attempt => attempt.quality === 'clean').length;
      stage.innerHTML = `<h3>三次球都传回来了</h3><p>小满记住的不是准不准，而是你真的来了。干净传球 ${clean} 次。</p><button type="button" data-activity-finish>坐在边线聊一会儿</button>`;
    } else {
      const labels = ['第一次：把球送到他脚边', '第二次：让他转身接球', '第三次：让他自己选择方向'];
      const feedback = activeEpisodeActivity.attempts.at(-1)?.quality;
      const feedbackCopy = feedback === 'clean' ? '上一球很干净。' : feedback === 'close' ? '上一球擦着他的步点。' : feedback ? '上一球慢了一点，他还是追上了。' : '';
      stage.innerHTML = `<h3>${labels[activeEpisodeActivity.step]}</h3><p>${feedbackCopy}选一个你想送到的位置，不完美也会继续。</p><div class="pass-targets"><button type="button" data-pass-value="0.22">传到左脚</button><button type="button" data-pass-value="0.50">传到正前</button><button type="button" data-pass-value="0.78">传到右脚</button></div>`;
    }
  }

  if (activeEpisodeActivity.type === 'fundraise') {
    progress = `${activeEpisodeActivity.customersServed} / 3`;
    if (activeEpisodeActivity.complete) {
      stage.innerHTML = `<h3>三位客人都拿到了需要的东西</h3><p>许姨问，铁盒里的钱要不要公开说成“小满留下来的筹款”。</p><div class="activity-choices"><button type="button" data-fundraising-mode="public">公开筹款 48 元</button><button type="button" data-fundraising-mode="private">只算小店收入 30 元</button></div>`;
    } else {
      const order = activeEpisodeActivity.orders[activeEpisodeActivity.step];
      stage.innerHTML = `<h3>${order.customer}想要${order.label}</h3><p>看清这一位客人真正需要什么。选错不会扣钱，但队伍不会往前走。</p><div class="activity-choices"><button type="button" data-fundraiser-item="tea">青草茶</button><button type="button" data-fundraiser-item="fruit">果子水</button><button type="button" data-fundraiser-item="towel">干净毛巾</button></div>`;
    }
  }

  if (activeEpisodeActivity.type === 'records') {
    progress = `${activeEpisodeActivity.cluesFound.length} / 3`;
    if (activeEpisodeActivity.complete) {
      stage.innerHTML = `<h3>三个地方指向同一个人</h3><p>日期、签字和旧照片放在一起。二十年前被空白通知留下的人，就是沈峤。</p><button type="button" data-activity-finish>把旧球员证收好</button>`;
    } else {
      const clueLabels = { signature: '核对通知签字', date: '翻看离队日期', photo: '比对旧队合照' };
      stage.innerHTML = `<h3>旧柜子里有三处不一致</h3><p>顺序不重要。把签字、日期和照片都看过，旧事才会完整。</p><div class="archive-clues">${ARCHIVE_CLUES.map(id => `<button type="button" data-archive-clue="${id}"${activeEpisodeActivity.cluesFound.includes(id) ? ' disabled' : ''}>${activeEpisodeActivity.cluesFound.includes(id) ? '已经看过：' : ''}${clueLabels[id]}</button>`).join('')}</div>`;
    }
  }

  document.querySelector('[data-activity-progress]').textContent = progress;
}

function renderHearing() {
  const active = Boolean(state.dayIndex === 9 && state.management?.matchResult && !state.episode.hearingChoice);
  hearingPanel.hidden = !active;
  if (!active) return;
  const xiaoman = state.episode.xiaomanDecision === 'stay-trial'
    ? '小满说：我愿意按自己的条件再留一周。下一次讨论我时，我要在场。'
    : '小满说：那份工作我会去。我不是因为你们说我不够好才走。';
  document.querySelector('[data-hearing-copy]').textContent = `${xiaoman} 现在要决定的，是以后谁能替球场签字。`;
  document.querySelector('[data-hearing-options]').innerHTML = [
    storyOption('hearing:manager-signs', '由经营者最后签字', '责任集中，也意味着其他人只能在决定以后知道'),
    storyOption('hearing:coach-decides', '涉及球队时由教练决定', '保护专业判断，但小店和社区仍没有席位'),
    storyOption('hearing:five-party-week', '每周召开一次五方会议', '教练、队员、小店、社区和安若童各有一把椅子')
  ].join('');
}

function renderMatchPanel() {
  const namingMatch = decisionAction === 'play-naming-match';
  const seasonMatch = decisionAction === 'play-season-match';
  const match = seasonMatch ? state.season?.match : namingMatch ? state.namingRights?.match : state.management?.match;
  const active = seasonMatch
    ? Boolean(match && !state.season.week.roundComplete)
    : namingMatch
    ? Boolean(match && !state.namingRights.weekComplete)
    : decisionAction === 'play-match' && match && !state.management.matchResult;
  matchPanel.hidden = !active;
  if (!active) return;
  const opponent = seasonMatch
    ? getLeagueTeam(match.opponentId)
    : getOpponent(namingMatch ? 'harbor-workers' : state.management.opponentId);
  document.querySelector('[data-match-home]').textContent = seasonMatch
    ? '海风队'
    : namingMatch && state.namingRights.voteRoute
      ? VOTE_ROUTES[state.namingRights.voteRoute].stadiumName
      : '海风球场';
  document.querySelector('[data-match-score]').textContent = `${match.homeGoals} : ${match.awayGoals}`;
  document.querySelector('[data-match-opponent]').textContent = opponent.name;
  const highlight = seasonMatch
    ? getSeasonMatchMoment(state.season)
    : namingMatch
      ? getNamingMatchMoment(state.namingRights)
      : getAvailableHighlights(match, state.episode);
  document.querySelector('[data-match-minute]').textContent = `第 ${highlight.minute} 分钟`;
  document.querySelector('[data-match-title]').textContent = highlight.title;
  document.querySelector('[data-match-copy]').textContent = highlight.copy;
  document.querySelector('[data-match-options]').innerHTML = highlight.choices.map(choice => {
    const detail = seasonMatch
      ? choice.callbackReady ? '本轮做过的事会回应这个选择。' : '这件准备还不充分，但比赛仍会继续。'
      : namingMatch && choice.callbackReady ? `本周做过的事会回应这个选择。${choice.detail}` : choice.detail;
    return `<button type="button" data-highlight-choice="${choice.id}"><strong>${choice.label}</strong><small>${detail}</small></button>`;
  }).join('');
}

function renderManagementMetrics() {
  const active = isManagementMode();
  const metrics = document.querySelector('[data-management-metrics]');
  const care = document.querySelector('[data-weekly-care]');
  metrics.hidden = !active || !ledgerOpen || isLeagueSeason();
  care.hidden = !active || isLeagueSeason();
  if (!active) return;
  if (isLeagueSeason()) return;
  const namingWeek = isNamingRightsWeekDay(state.dayIndex);
  const totals = namingWeek ? getFreeActionTotals(state.namingRights.freeTime) : null;
  const careCopy = namingWeek
    ? state.namingRights.weekComplete
      ? [state.namingRights.settlement.stadiumName, state.namingRights.settlement.nextCrisis]
      : state.dayIndex === 10
        ? ['蓝布盖住了旧名字', '周五以前，谁都不能私下签字']
        : state.dayIndex === 11
          ? ['五把椅子的条件', state.namingRights.freeTime.available ? '今天还能亲手做一件事' : '先听完五种底线']
          : state.dayIndex === 12
            ? ['海风自救箱', `已有 ${totals.fund} 元，${totals.signatures} 个签名`]
            : state.dayIndex === 13
              ? ['被刮掉的名字', totals.evidence ? '完整证据已经整理好' : '承认过去，也要决定现在']
              : state.dayIndex === 14
                ? ['五张纸票', state.namingRights.voteRoute ? VOTE_ROUTES[state.namingRights.voteRoute].label : `自救金 ${totals.fund} 元，签名 ${totals.signatures} 个`]
                : state.dayIndex === 15
                  ? ['沈峤的半张合照', state.namingRights.response ? REVEAL_RESPONSES[state.namingRights.response].label : '他在等一个明确回答']
                  : ['招牌下的比赛', state.namingRights.match ? '终场以后揭开招牌' : '港口工人队已经入场']
    : state.management.weekComplete
      ? ['这一周留下的决定', state.management.settlement.character.nextCrisis]
      : state.dayIndex === 3
    ? ['空白通知还没有名字', '先听完每个人']
    : state.dayIndex === 4
      ? ['小满的七号背心', state.episode.promisesChosen.length ? '两项承诺已经写下' : '只能先答应两件事']
      : [5, 6].includes(state.dayIndex)
        ? ['答应过的两件事', `已经完成 ${state.episode.promisesCompleted.length} / 2`]
        : state.dayIndex === 7
          ? ['灯光和一个人的工作', state.episode.missedRequest ? `没来得及：${PROMISES[state.episode.missedRequest].label}` : '周五以前必须取舍']
          : state.dayIndex === 8
            ? ['沈峤的旧球员证', state.episode.truthKnown ? '旧记录已经对上' : '他当年也被不公平对待']
            : ['小满要自己回答', state.management.matchResult ? '五把椅子正在等' : '先把比赛踢完'];
  document.querySelector('[data-care-title]').textContent = careCopy[0];
  document.querySelector('[data-care-progress]').textContent = careCopy[1];
  document.querySelector('[data-ledger-toggle]').textContent = ledgerOpen ? '收起账本' : '查看账本';
  document.querySelector('[data-metric="cash"]').textContent = `${state.economy.cash}元`;
  document.querySelector('[data-metric="facility"]').textContent = state.facilities.condition;
  document.querySelector('[data-metric="cohesion"]').textContent = state.roster.cohesion;
  document.querySelector('[data-metric="community"]').textContent = state.communitySupport;
  document.querySelector('[data-metric="governance"]').textContent = `${state.governance.support}/5`;
}

function seasonRank() {
  return getStandings(state.season).findIndex(row => row.teamId === 'haifeng') + 1;
}

function renderMatchOutlook() {
  const outlookLine = document.querySelector('[data-match-outlook]');
  if (!outlookLine) return;
  const round = getSeasonRound(state.season.roundIndex);
  const opponent = getLeagueTeam(round.playerOpponentId);
  const difficulty = opponent.strength + Math.max(0, state.season.seasonNumber - 1) * 2;
  const outlook = getMatchOutlook({
    attack: state.roster.attack,
    defense: state.roster.defense,
    cohesion: state.roster.cohesion,
    facility: state.facilities.condition,
    cash: state.economy.cash
  }, state.season.projects, difficulty);

  const levels = Object.values(state.season.projects).reduce((sum, value) => sum + value, 0);
  const edge = -outlook.gap;
  const unlocks = getConstructionUnlocks(state.season.projects);
  const nextMilestone = [
    CONSTRUCTION_MILESTONES.extraMoment,
    CONSTRUCTION_MILESTONES.forgiveOpening,
    CONSTRUCTION_MILESTONES.fullBuild
  ].find(target => levels < target) ?? null;

  document.querySelector('[data-outlook-construction]').textContent = nextMilestone === null
    ? `建设 ${levels} 级 · 已建成`
    : `建设 ${levels} 级 · 距 ${nextMilestone} 级还差 ${nextMilestone - levels}`;
  document.querySelector('[data-outlook-deficit]').textContent = outlook.concededGoals === 0
    ? '开场不落后'
    : `开场落后 ${outlook.concededGoals} 球`;
  document.querySelector('[data-outlook-edge]').textContent = edge >= 0
    ? `实力领先 ${edge.toFixed(1)}`
    : `实力落后 ${Math.abs(edge).toFixed(1)}`;
  document.querySelector('[data-outlook-summary]').textContent = unlockSummary(unlocks, nextMilestone);
  outlookLine.classList.toggle('behind', outlook.concededGoals > 0);
}

function unlockSummary(unlocks, nextMilestone) {
  if (unlocks.fullBuild) return '整座球场都在使用，比赛里有五个时刻可以回应';
  if (nextMilestone === CONSTRUCTION_MILESTONES.forgiveOpening) {
    return unlocks.extraMoment
      ? '再建到 10 级，开场准备不足时不会被追加失球'
      : `再建到 ${nextMilestone} 级，球场会在比赛里多给一次机会`;
  }
  if (nextMilestone === CONSTRUCTION_MILESTONES.fullBuild) return '建完最后几级，球场会有属于自己的比赛时刻';
  return `再建到 ${CONSTRUCTION_MILESTONES.extraMoment} 级，比赛里会多出一个可以回应的时刻`;
}

function renderSeasonDocket() {
  const active = isLeagueSeason();
  seasonDocket.hidden = !active;
  if (!active) return;
  const round = getSeasonRound(state.season.roundIndex);
  const opponent = getLeagueTeam(round.playerOpponentId);
  document.querySelector('[data-season-round-label]').textContent = `第 ${state.season.seasonNumber} 赛季 · 第 ${round.round} 轮`;
  document.querySelector('[data-season-opponent]').textContent = `对阵${opponent.name}`;
  document.querySelector('[data-season-rank]').textContent = `当前第 ${seasonRank()} 名`;
  document.querySelector('[data-season-actions]').textContent = `行动 ${state.season.week.actions.length} / 3`;
  const event = getSeasonEvent(state.season.roundIndex, state.season.seasonNumber);
  const status = document.querySelector('[data-season-incident-status]');
  status.textContent = state.season.week.eventChoiceId
    ? `已回应：${getSeasonEventChoice(event.id, state.season.week.eventChoiceId).label}`
    : `待回应：${event.title}`;
  status.classList.toggle('complete', Boolean(state.season.week.eventChoiceId));
  renderMatchOutlook();
}

function renderSeasonConversation() {
  const active = isLeagueSeason() && Boolean(activeSeasonNpcId);
  seasonConversation.hidden = !active;
  if (!active) return;
  const npc = getSeasonNpc(activeSeasonNpcId);
  const scheduled = getNpcSchedule(state.dayIndex, 'morning', { season: state.season }).find(item => item.id === activeSeasonNpcId);
  const alreadyTalked = state.season.week.talkedNpcIds.includes(activeSeasonNpcId);
  const roleLabels = { coach: '球队教练', captain: '球队队长', market: '场边小店', youth: '年轻球员', sponsor: '外部投资人', governance: '场馆评审' };
  const sprite = document.querySelector('[data-season-npc-sprite]');
  sprite.className = `npc-sprite ${npc.spriteClass}`;
  document.querySelector('[data-season-npc-role]').textContent = roleLabels[npc.domain];
  document.querySelector('[data-season-npc-name]').textContent = npc.name;
  document.querySelector('[data-season-npc-bond]').textContent = `关系 ${state.season.relationships[activeSeasonNpcId]} / 5`;
  document.querySelector('[data-season-npc-copy]').textContent = scheduled?.copy ?? npc.copies[state.season.roundIndex % npc.copies.length];
  const memoryPanel = document.querySelector('[data-season-memory]');
  const memory = scheduled?.memory ?? null;
  const memoryDone = state.season.week.memoryNpcIds.includes(activeSeasonNpcId);
  memoryPanel.hidden = !memory;
  if (memory) {
    document.querySelector('[data-season-memory-source]').textContent = memory.label;
    document.querySelector('[data-season-memory-choice]').textContent = memory.choiceLabel;
    document.querySelector('[data-season-memory-status]').textContent = memoryDone
      ? '你们已经把这件事谈清楚了，关系已经改变。'
      : '花 6 分钟，不占本轮经营行动，关系 +1。';
    const memoryButton = document.querySelector('[data-season-memory-talk]');
    memoryButton.disabled = memoryDone;
    memoryButton.textContent = memoryDone ? '本轮已谈清楚' : '把这件事谈清楚';
  }
  document.querySelector('[data-season-response-options]').innerHTML = alreadyTalked
    ? '<p class="season-talked-note">这轮已经认真谈过。下一轮，他会记得你这次怎么回答。</p>'
    : npc.responses.map(response => (
        `<button type="button" data-season-response="${response.id}"><strong>${response.label}</strong><small>${response.bond ? '关系 +1，并可能在比赛中回应' : '坚持立场，不为了好感回避分歧'}</small></button>`
      )).join('');
}

function seasonEventEffectCopy(choice) {
  const labels = {
    cash: '现金', attack: '进攻', defense: '防守', cohesion: '凝聚', community: '社区',
    facility: '球场', energy: '体力', support: '委员会', shenInfluence: '沈峤影响'
  };
  const effects = Object.entries(choice.effects)
    .filter(([, value]) => value)
    .map(([key, value]) => `${labels[key]} ${value > 0 ? '+' : ''}${value}`);
  const relationships = Object.entries(choice.relationships)
    .filter(([, value]) => value)
    .map(([npcId, value]) => `${getSeasonNpc(npcId).name}关系 ${value > 0 ? '+' : ''}${value}`);
  return [...effects, ...relationships].join(' / ');
}

function renderSeasonEvent() {
  const active = isLeagueSeason() && Boolean(activeSeasonEventId);
  seasonEventPanel.hidden = !active;
  if (!active) return;
  const event = SEASON_EVENTS.find(item => item.id === activeSeasonEventId);
  if (!event) {
    activeSeasonEventId = null;
    seasonEventPanel.hidden = true;
    return;
  }
  const speaker = getSeasonNpc(event.speakerId);
  const selected = state.season.week.eventId === event.id && state.season.week.eventChoiceId
    ? getSeasonEventChoice(event.id, state.season.week.eventChoiceId)
    : null;
  document.querySelector('[data-season-event-kicker]').textContent = event.kicker;
  document.querySelector('[data-season-event-place]').textContent = event.mapId === 'training' ? '旧训练场' : '海风主赛场';
  document.querySelector('[data-season-event-speaker]').textContent = `${speaker.name}带来的事`;
  document.querySelector('[data-season-event-title]').textContent = event.title;
  document.querySelector('[data-season-event-sprite]').className = `npc-sprite ${speaker.spriteClass}`;
  document.querySelector('[data-season-event-beats]').innerHTML = event.beats.map(beat => `<p>${beat}</p>`).join('');
  const options = document.querySelector('[data-season-event-options]');
  options.hidden = Boolean(selected);
  options.innerHTML = selected ? '' : event.choices.map(choice => (
    `<button type="button" data-season-event-choice="${choice.id}"><strong>${choice.label}</strong><span>${choice.detail}</span><small>${seasonEventEffectCopy(choice)}</small></button>`
  )).join('');
  const result = document.querySelector('[data-season-event-result]');
  result.hidden = !selected;
  result.innerHTML = selected
    ? `<span>这轮已经决定</span><strong>${selected.label}</strong><p>${selected.resultCopy}</p><small>${seasonEventEffectCopy(selected)}</small>`
    : '';
}

function renderSeasonBoard() {
  const active = isLeagueSeason() && seasonBoardOpen;
  seasonBoard.hidden = !active;
  if (!active) return;
  document.querySelector('[data-season-board-title]').textContent = `第 ${state.season.seasonNumber} 赛季 · 第 ${state.season.roundIndex + 1} 轮`;
  const standings = getStandings(state.season);
  document.querySelector('[data-season-standings]').innerHTML = standings.map((row, index) => {
    const team = getLeagueTeam(row.teamId);
    return `<div class="season-standing-row${row.teamId === 'haifeng' ? ' is-player' : ''}"><b>${index + 1}</b><strong>${team.shortName}</strong><span>${row.played}</span><span>${row.won}-${row.drawn}-${row.lost}</span><em>${row.points} 分</em></div>`;
  }).join('');
  const goals = getSeasonGoalStatus(state.season, { cash: state.economy.cash });
  document.querySelector('[data-season-goals]').innerHTML = Object.entries(SEASON_GOALS).map(([id, goal]) => {
    const status = goals[id];
    const progress = id === 'ranking' ? `当前第 ${status.current} 名` : `${status.current} / ${status.target}`;
    return `<div class="season-goal${status.complete ? ' complete' : ''}"><i>${status.complete ? '完成' : '目标'}</i><strong>${goal.label}</strong><small>${progress}</small></div>`;
  }).join('');
  document.querySelector('[data-season-projects]').innerHTML = Object.values(SEASON_PROJECTS).map(project => {
    const level = state.season.projects[project.id];
    const next = project.levels[level];
    return `<div><span>${project.label}</span><strong>${level} / 3</strong><small>${next ? `下一步 ${next.label} · ${next.cost} 元` : '已经稳定运营'}</small></div>`;
  }).join('');
  const history = state.season.eventHistory ?? [];
  document.querySelector('[data-season-history]').innerHTML = history.length
    ? history.slice(-3).reverse().map(item => {
        const event = SEASON_EVENTS.find(candidate => candidate.id === item.eventId);
        const choice = getSeasonEventChoice(item.eventId, item.choiceId);
        return `<div><span>第 ${item.seasonNumber} 赛季第 ${item.round} 轮</span><strong>${event.title}</strong><small>${choice.label}</small></div>`;
      }).join('')
    : '<p>第一件事还在球场里等你回应。</p>';
}

function renderSeasonSummary() {
  const active = isLeagueSeason() && state.phase === 'complete' && state.season.week.roundComplete && !seasonBoardOpen && !elitePanelOpen;
  seasonSummary.hidden = !active;
  if (!active) return;
  const result = state.season.week.result;
  const opponent = getLeagueTeam(result.opponentId);
  const rank = seasonRank();
  const seasonComplete = state.season.seasonComplete;
  document.querySelector('[data-season-summary-kicker]').textContent = `海风联赛 · 第 ${state.season.roundIndex + 1} 轮`;
  document.querySelector('[data-season-summary-title]').textContent = seasonComplete
    ? state.season.eliteQualified ? '海风队拿到了精英邀请赛资格' : '第一个赛季留下了可以继续的球场'
    : result.points === 3 ? '海风队把准备带进了比分' : result.points === 1 ? '这一分没有白拿' : '输掉比赛，球场仍然向前';
  document.querySelector('[data-season-summary-copy]').textContent = seasonComplete
    ? `七轮结束，海风队排名第 ${rank}。建设与关系不会清零，下一赛季仍能继续争取精英资格。`
    : `本轮的三项行动、建设和谈话都已经结算。下一轮会换一个对手，也会出现新的关系回应。`;
  document.querySelector('[data-season-summary-score]').textContent = `海风 ${result.homeGoals} : ${result.awayGoals} ${opponent.shortName}`;
  document.querySelector('[data-season-summary-rank]').textContent = `当前第 ${rank} 名 · ${state.season.standings.find(row => row.teamId === 'haifeng').points} 分`;
  const event = getSeasonEvent(state.season.roundIndex, state.season.seasonNumber);
  const eventChoice = state.season.week.eventChoiceId
    ? getSeasonEventChoice(event.id, state.season.week.eventChoiceId)
    : null;
  document.querySelector('[data-season-summary-event]').innerHTML = eventChoice
    ? `<span>本轮发生了</span><strong>${event.title}</strong><small>${eventChoice.label}</small>`
    : '<span>旧赛季记录</span><strong>这轮没有留下事件选择</strong><small>下一轮会正常出现新的球场事件</small>';
  const goals = getSeasonGoalStatus(state.season, { cash: state.economy.cash });
  document.querySelector('[data-season-summary-grid]').innerHTML = [
    ['本轮行动', `${state.season.week.actions.length} 件`],
    ['认真谈过', `${state.season.week.talkedNpcIds.length} 人`],
    ['建设总级', `${Object.values(state.season.projects).reduce((sum, value) => sum + value, 0)} / 15`],
    ['账上现金', `${state.economy.cash} 元`]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  const nextButton = document.querySelector('[data-season-next]');
  nextButton.textContent = seasonComplete && goals.eliteQualified
    ? state.season.elite.status === 'invited'
      ? '接受精英邀请'
      : state.season.elite.status === 'match'
        ? '继续精英邀请赛'
        : '查看精英赛结果'
    : seasonComplete
      ? '带着这些进入下一赛季'
      : `进入第 ${state.season.roundIndex + 2} 轮`;
  nextButton.dataset.elite = String(Boolean(goals.eliteQualified));
}

function eliteCallbackCopy(choice) {
  if (!choice.callback) return '这是此刻的取舍，没有过去成果自动回应。';
  const label = choice.callback === 'ranking'
    ? '联赛前四'
    : choice.callback === 'construction'
      ? '六级球场建设'
      : ELITE_PREPARATIONS[choice.callback.replace('preparation:', '')]?.label ?? '赛前准备';
  return choice.callbackReady ? `${label}会回应这次选择。` : `${label}没有在赛前准备好。`;
}

function renderElitePanel() {
  const elite = state.season?.elite;
  const active = elitePanelOpen && isLeagueSeason() && state.season.seasonComplete && ['invited', 'match', 'complete'].includes(elite?.status);
  elitePanel.hidden = !active;
  if (!active) return;

  const invitation = document.querySelector('[data-elite-invitation]');
  const match = document.querySelector('[data-elite-match]');
  const result = document.querySelector('[data-elite-result]');
  invitation.hidden = elite.status !== 'invited';
  match.hidden = elite.status !== 'match';
  result.hidden = elite.status !== 'complete';
  document.querySelector('[data-elite-opponent]').textContent = ELITE_OPPONENT.name;
  document.querySelector('[data-elite-opponent-copy]').textContent = ELITE_OPPONENT.copy;
  document.querySelector('[data-elite-title]').textContent = elite.status === 'invited'
    ? '球场收到了一封正式邀请'
    : elite.status === 'match'
      ? '海风第一次站进精英赛'
      : '这场比赛已经写进记录';

  if (elite.status === 'invited') {
    const rank = seasonRank();
    const construction = Object.values(state.season.projects).reduce((sum, value) => sum + value, 0);
    document.querySelector('[data-elite-qualification]').textContent = `联赛第 ${rank} 名，球场建设 ${construction} 级。两项条件一起换来了这封邀请。先决定赛前最认真做哪一件事。`;
    document.querySelector('[data-elite-preparations]').innerHTML = Object.values(ELITE_PREPARATIONS).map(preparation => (
      `<button type="button" data-elite-preparation="${preparation.id}"><strong>${preparation.label}</strong><span>${preparation.copy}</span><small>${preparation.callbackLabel}</small></button>`
    )).join('');
  }

  if (elite.status === 'match') {
    const moment = getSeasonEliteMoment(state.season);
    document.querySelector('[data-elite-score]').textContent = `${elite.match.homeGoals} : ${elite.match.awayGoals}`;
    document.querySelector('[data-elite-minute]').textContent = moment.minute;
    document.querySelector('[data-elite-moment-title]').textContent = moment.title;
    document.querySelector('[data-elite-moment-copy]').textContent = moment.copy;
    document.querySelector('[data-elite-choices]').innerHTML = moment.choices.map(choice => (
      `<button type="button" data-elite-choice="${choice.id}" class="${choice.callbackReady ? 'is-ready' : ''}"><strong>${choice.label}</strong><span>${choice.copy}</span><small>${eliteCallbackCopy(choice)}</small></button>`
    )).join('');
  }

  if (elite.status === 'complete') {
    const content = ELITE_RESULTS[elite.result.id];
    document.querySelector('[data-elite-score]').textContent = `${elite.result.homeGoals} : ${elite.result.awayGoals}`;
    document.querySelector('[data-elite-result-title]').textContent = content.label;
    document.querySelector('[data-elite-result-score]').textContent = `海风 ${elite.result.homeGoals} : ${elite.result.awayGoals} 鹤岭`;
    document.querySelector('[data-elite-result-copy]').textContent = content.copy;
    document.querySelector('[data-elite-rewards]').innerHTML = [
      ['奖金', `+${content.effects.cash} 元`],
      ['凝聚', `+${content.effects.cohesion}`],
      ['社区', `+${content.effects.community}`]
    ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  }
}

function renderManagementControls() {
  const button = document.querySelector('[data-end-management-day]');
  if (state.dayIndex === 16 && state.namingRights.weekComplete && weekSummaryDismissed && !isLeagueSeason()) {
    button.hidden = false;
    button.textContent = '进入海风联赛';
    return;
  }
  if (state.dayIndex === 9 && state.management.weekComplete && weekSummaryDismissed) {
    button.hidden = false;
    button.textContent = '进入第二个经营周';
    return;
  }
  if (!isManagementWeekDay(state.dayIndex) || state.phase !== 'morning' || state.management.weekComplete) {
    button.hidden = true;
    return;
  }
  const actionId = getRequiredAction(state.dayIndex);
  button.hidden = !isEpisodeDayResolved()
    || state.management.shortfallPending
    || Boolean(decisionAction)
    || Boolean(storySceneId)
    || Boolean(activeEpisodeActivity)
    || !hearingPanel.hidden;
  button.textContent = state.dayIndex === 9 ? '结算这一周' : '收好今天的决定';
}

function renderSummary() {
  if (isLeagueSeason()) {
    summary.hidden = true;
    return;
  }
  const managementDay = isManagementWeekDay(state.dayIndex);
  const namingDay = isNamingRightsWeekDay(state.dayIndex);
  const complete = state.phase === 'complete'
    && !state.chapterComplete
    && !((managementDay || namingDay) && state.management.weekComplete);
  summary.hidden = !complete;
  if (!complete) return;

  const day = currentDay();
  if (namingDay) {
    const records = state.management.dailyRecords.filter(entry => entry.dayIndex === state.dayIndex);
    const freeRecord = records.find(entry => entry.actionId === 'free-time');
    const mainlineRecord = records.find(entry => entry.actionId !== 'free-time');
    const totals = getFreeActionTotals(state.namingRights.freeTime);
    const dayCopies = {
      10: '合同没有被任何人私下带走。周五以前，五把椅子会一起听完它。',
      11: '五种条件都贴在墙上。它们互相冲突，但没有一张被钱盖住。',
      12: '救命钱之外，球场又多了一件真实做成的事。',
      13: '沈峤确实被从创办历史里抹去。承认这件事以后，问题变得更难了。',
      14: `五张票已经落下。球场选择了“${VOTE_ROUTES[state.namingRights.voteRoute]?.label ?? '延期'}”。`,
      15: '半张合照没有替任何人赢得辩论，但它让所有人不能再否认过去。'
    };
    document.querySelector('[data-summary-date]').textContent = `${day.weekday} / 春 ${day.date} 日`;
    document.querySelector('[data-summary-title]').textContent = ACTION_COPY[getRequiredAction(state.dayIndex)].title;
    document.querySelector('[data-summary-copy]').textContent = dayCopies[state.dayIndex];
    document.querySelector('[data-summary-label="orders"]').textContent = '今天做了';
    document.querySelector('[data-summary-label="repair"]').textContent = '自救金';
    document.querySelector('[data-summary-label="money"]').textContent = '签名';
    document.querySelector('[data-summary-label="person"]').textContent = '球场名字';
    document.querySelector('[data-summary-orders]').textContent = freeRecord
      ? getFreeAction(freeRecord.choiceId).label
      : choiceLabel(mainlineRecord?.actionId, mainlineRecord?.choiceId ?? '完成');
    document.querySelector('[data-summary-repair]').textContent = `${totals.fund} 元`;
    document.querySelector('[data-summary-money]').textContent = `${totals.signatures} 个`;
    document.querySelector('[data-summary-person]').textContent = state.namingRights.voteRoute
      ? VOTE_ROUTES[state.namingRights.voteRoute].stadiumName
      : '仍被蓝布盖着';
    document.querySelector('[data-next-day]').textContent = `去往春 ${getCampaignDay(state.dayIndex + 1).date} 日`;
    return;
  }
  if (managementDay) {
    const record = state.management.dailyRecords.findLast(entry => entry.dayIndex === state.dayIndex);
    const actionId = getRequiredAction(state.dayIndex);
    document.querySelector('[data-summary-date]').textContent = `${day.weekday} / 春 ${day.date} 日`;
    document.querySelector('[data-summary-title]').textContent = ACTION_COPY[actionId].title;
    const dayCopies = {
      3: '通知上的名字仍然空着。今天没有解决问题，但大家第一次知道自己可以先说话。',
      4: '你只答应了两件事。第三个请求没有消失，它只是开始等待。',
      5: '第一件承诺已经亲自做完。剩下的时间只够再回应一个人。',
      6: '两件承诺都做完了。没被选中的那件事，会在明天成为真正的代价。',
      7: '灯光和一个人的下一周被写进同一张账单。你留下了清楚的先后顺序。',
      8: '沈峤给出的是一份真实工作。小满没有让任何人替他回答。'
    };
    document.querySelector('[data-summary-copy]').textContent = dayCopies[state.dayIndex] ?? '今天的选择已经留下。';
    document.querySelector('[data-summary-label="orders"]').textContent = '决定';
    document.querySelector('[data-summary-label="repair"]').textContent = '现金';
    document.querySelector('[data-summary-label="money"]').textContent = '社区';
    document.querySelector('[data-summary-label="person"]').textContent = '委员会';
    document.querySelector('[data-summary-orders]').textContent = choiceLabel(actionId, record?.choiceId ?? '完成');
    document.querySelector('[data-summary-repair]').textContent = `${state.economy.cash} 元`;
    document.querySelector('[data-summary-money]').textContent = String(state.communitySupport);
    document.querySelector('[data-summary-person]').textContent = `${state.governance.support}/5`;
    const nextDay = getCampaignDay(state.dayIndex + 1);
    document.querySelector('[data-next-day]').textContent = `去往春 ${nextDay.date} 日`;
    return;
  }

  const history = state.history.at(-1);
  const repair = history?.repair ? REPAIRS[history.repair] : null;
  document.querySelector('[data-summary-label="orders"]').textContent = '接待';
  document.querySelector('[data-summary-label="repair"]').textContent = '场地';
  document.querySelector('[data-summary-label="money"]').textContent = '余下';
  document.querySelector('[data-summary-label="person"]').textContent = '认识';
  document.querySelector('[data-summary-date]').textContent = `${day.season} ${day.date} · 晚间`;
  document.querySelector('[data-summary-title]').textContent = day.date === 14 ? '友谊赛散场了' : '今天留下了痕迹';
  document.querySelector('[data-summary-copy]').textContent = repair
    ? `${repair.result}海风停下来以后，场地看上去比早晨更像一个会继续存在的地方。`
    : '安若童把今天的钱留了下来。没有立刻改变的地方，也已经被认真看见。';
  document.querySelector('[data-summary-orders]').textContent = `${currentOrders().length} 人`;
  document.querySelector('[data-summary-repair]').textContent = repair?.label ?? '今天先存下';
  document.querySelector('[data-summary-money]').textContent = `${state.money} 元`;
  document.querySelector('[data-summary-person]').textContent = state.training.lastScore !== null
    ? `训练 ${state.training.lastScore} 分`
    : state.relationship.coachMet ? '郭教练' : '留到明天';
  document.querySelector('[data-next-day]').textContent = day.date === 14 ? '看看这三天' : `去往春 ${day.date + 1} 日`;
}

function renderWeekSummary() {
  const active = Boolean(!isLeagueSeason() && state.management?.weekComplete && state.management.settlement && !weekSummaryDismissed);
  weekSummary.hidden = !active;
  if (!active) return;
  const settlement = state.management.settlement;
  const opponent = getOpponent(state.management.opponentId);
  const outcomeCopy = settlement.outcome === 'win' ? '赢下' : settlement.outcome === 'draw' ? '战平' : '输给';
  const namingWeek = isNamingRightsWeekDay(state.dayIndex) && state.namingRights.weekComplete;
  const namingReveal = document.querySelector('[data-naming-summary]');
  const beginNamingButton = document.querySelector('[data-begin-naming-week]');
  const beginSeasonButton = document.querySelector('[data-begin-season]');
  if (namingWeek) {
    const route = VOTE_ROUTES[settlement.route];
    document.querySelector('[data-week-range]').textContent = '春 22 日至春 28 日';
    document.querySelector('[data-week-summary-title]').textContent = '球场终于揭开了招牌';
    document.querySelector('[data-week-summary-copy]').textContent = `${settlement.stadiumName}${outcomeCopy}${opponent.name}，来了${settlement.audience}名观众。终场比分不是唯一结果，球场的名字和决定权也一起留下了。`;
    namingReveal.hidden = false;
    document.querySelector('[data-final-stadium-name]').textContent = settlement.stadiumName;
    document.querySelector('[data-final-authority]').textContent = settlement.authority;
    document.querySelector('[data-week-label="first"]').textContent = '本周亲手做过';
    document.querySelector('[data-week-label="second"]').textContent = '公开表决';
    document.querySelector('[data-week-label="third"]').textContent = '沈峤';
    document.querySelector('[data-week-label="fourth"]').textContent = '下一件难题';
    document.querySelector('[data-week-xiaoman]').textContent = settlement.rememberedAction;
    document.querySelector('[data-week-missed]').textContent = route.label;
    document.querySelector('[data-week-shen]').textContent = settlement.shenCopy;
    document.querySelector('[data-week-next-crisis]').textContent = settlement.nextCrisis;
    document.querySelector('[data-week-score]').textContent = `${settlement.stadiumName} ${settlement.score.home} : ${settlement.score.away} ${opponent.shortName}`;
    document.querySelector('.week-next').textContent = settlement.nextCrisis;
    beginNamingButton.hidden = true;
    beginSeasonButton.hidden = false;
    const items = [
      ['现金', `${settlement.metrics.cash}元`],
      ['球场', settlement.metrics.facility],
      ['凝聚', settlement.metrics.cohesion],
      ['社区', settlement.metrics.community],
      ['委员会', `${settlement.metrics.governance}/5`]
    ];
    document.querySelector('[data-week-metrics]').innerHTML = items.map(([label, value]) => (
      `<div><span>${label}</span><strong>${value}</strong></div>`
    )).join('');
    return;
  }
  document.querySelector('[data-week-range]').textContent = '春 15 日至春 21 日';
  namingReveal.hidden = true;
  beginNamingButton.hidden = false;
  beginSeasonButton.hidden = true;
  document.querySelector('[data-week-label="first"]').textContent = '小满';
  document.querySelector('[data-week-label="second"]').textContent = '没来得及的事';
  document.querySelector('[data-week-label="third"]').textContent = '沈峤';
  document.querySelector('[data-week-label="fourth"]').textContent = '下周危机';
  const character = settlement.character;
  document.querySelector('[data-week-summary-title]').textContent = character.xiaomanDecision === 'stay-trial' ? '小满决定再留一周' : '小满决定接受那份工作';
  document.querySelector('[data-week-summary-copy]').textContent = `海风球场${outcomeCopy}${opponent.name}，来了${settlement.audience}名观众。比分已经结束，但这一周真正留下的是谁能替别人作决定。`;
  document.querySelector('[data-week-score]').textContent = `海风球场 ${settlement.score.home} : ${settlement.score.away} ${opponent.shortName}`;
  document.querySelector('[data-week-xiaoman]').textContent = character.xiaomanCopy;
  document.querySelector('[data-week-missed]').textContent = character.missedCopy;
  document.querySelector('[data-week-shen]').textContent = character.shenAdvantage;
  document.querySelector('[data-week-next-crisis]').textContent = character.nextCrisis;
  document.querySelector('.week-next').textContent = `下周：${character.nextCrisis}`;
  const items = [
    ['现金', `${settlement.metrics.cash}元`],
    ['球场', settlement.metrics.facility],
    ['凝聚', settlement.metrics.cohesion],
    ['社区', settlement.metrics.community],
    ['委员会', `${settlement.metrics.governance}/5`]
  ];
  document.querySelector('[data-week-metrics]').innerHTML = items.map(([label, value]) => (
    `<div><span>${label}</span><strong>${value}</strong></div>`
  )).join('');
}

function renderChapterSummary() {
  chapterSummary.hidden = !state.chapterComplete;
  if (!state.chapterComplete) return;
  document.querySelector('[data-chapter-history]').innerHTML = state.history.map(day => {
    const repair = day.repair ? REPAIRS[day.repair].label : '存下收入';
    const training = day.trainingScore === null ? '没有训练' : `训练 ${day.trainingScore} 分`;
    return `<article><span>春 ${day.date}</span><strong>${day.title}</strong><small>收入 ${day.revenue} 元<br>${repair}<br>${training}</small></article>`;
  }).join('');
}

function renderTraining() {
  root.classList.toggle('training-active', trainingActive);
  trainingLayer.hidden = !trainingActive;
  const hearingActive = Boolean(state.dayIndex === 9 && state.management?.matchResult && !state.episode.hearingChoice);
  const managementModal = Boolean(decisionAction || storySceneId || activeEpisodeActivity || activeFreeActivity || hearingActive || activeSeasonNpcId || activeSeasonEventId || seasonBoardOpen || elitePanelOpen || !seasonSummary.hidden);
  touchControls.hidden = trainingActive || state.phase !== 'morning' || managementModal;
  touchAction.hidden = trainingActive || state.phase !== 'morning' || managementModal;
  if (managementModal) prompt.hidden = true;
  if (!trainingActive || !trainingSession) return;

  const target = TRAINING_TARGETS[trainingSession.shotIndex];
  document.querySelector('[data-training-count]').textContent = `第 ${trainingSession.shotIndex + 1} 脚`;
  document.querySelector('[data-training-score]').textContent = trainingFeedback
    ? `${trainingSession.score} 分 · ${trainingFeedback}`
    : `现在 ${trainingSession.score} 分`;
  document.querySelector('[data-training-zone]').style.left = `${target * 100}%`;
  document.querySelector('[data-training-target]').style.left = `${target * 100}%`;
  document.querySelector('[data-training-pointer]').style.left = `${trainingPointer * 100}%`;
}

function renderStartCard() {
  startCard.hidden = hasStarted;
  if (hasStarted) return;
  const continueButton = document.querySelector('[data-continue]');
  startCard.dataset.hasSave = String(loaded.ok);
  continueButton.hidden = !loaded.ok;
  document.querySelector('[data-save-summary]').textContent = loaded.ok
    ? isLeagueSeason()
      ? `存档停在第 ${state.season.seasonNumber} 赛季第 ${state.season.roundIndex + 1} 轮。人物关系、建设和积分都已经保存。`
      : `存档停在春 ${currentDay().date} 日。可以继续原进度，也可以从第一周的空白通知重新开始。`
    : loaded.reason === 'absent'
      ? '现在可以连续体验序章、两个剧情周，以及会不断延续的海风联赛。'
      : '上次存档无法读取。可以直接进入第一周故事，或从抵达的早晨重新开始。';
}

function renderModals() {
  renderSummary();
  renderChapterSummary();
  renderWeekSummary();
  renderDecisionPanel();
  renderStoryScene();
  renderEpisodeActivity();
  renderMatchPanel();
  renderHearing();
  renderSeasonConversation();
  renderSeasonEvent();
  renderSeasonBoard();
  renderSeasonSummary();
  renderElitePanel();
  renderStartCard();
  summaryDim.hidden = summary.hidden
    && chapterSummary.hidden
    && weekSummary.hidden
    && decisionPanel.hidden
    && storyScene.hidden
    && episodeActivity.hidden
    && matchPanel.hidden
    && hearingPanel.hidden
    && seasonConversation.hidden
    && seasonEventPanel.hidden
    && seasonBoard.hidden
    && seasonSummary.hidden
    && elitePanel.hidden
    && startCard.hidden;
}

function render() {
  root.dataset.phase = state.phase;
  root.dataset.day = String(state.dayIndex);
  root.dataset.mode = isManagementMode() ? 'management' : 'prologue';
  root.dataset.campaign = String(isManagementMode());
  root.dataset.season = String(isLeagueSeason());
  const details = phaseDetails();
  renderCalendar();
  document.querySelector('[data-time]').textContent = formatTime(state.minute);
  document.querySelector('[data-phase-title]').textContent = details.title;
  document.querySelector('[data-current-goal]').textContent = details.goal;
  document.querySelector('[data-resource-label]').textContent = details.label;
  document.querySelector('[data-resource-value]').textContent = details.value;
  resourceIcon.classList.remove('item-tea', 'item-coins');
  resourceIcon.classList.add(details.icon);

  for (const [key, value] of Object.entries(state.inventory)) {
    document.querySelector(`[data-inventory="${key}"]`).textContent = value;
  }

  const optional = document.querySelector('[data-optional-event]');
  if (isLeagueSeason()) {
    const talked = state.season.week.talkedNpcIds.map(id => getSeasonNpc(id).name);
    optional.classList.toggle('complete', talked.length > 0);
    document.querySelector('[data-relationship-status]').textContent = talked.length
      ? `本轮和${talked.join('、')}认真谈过`
      : '本轮还没有和场上的人认真谈过';
  } else if (isCampaignDay(state.dayIndex)) {
    const talked = getNpcSchedule(state.dayIndex, 'morning', { opponentId: state.management.opponentId, episode: state.episode })
      .filter(npc => state.events.includes(`talk-${npc.id}-day-${state.dayIndex}`))
      .map(npc => npc.name);
    optional.classList.toggle('complete', talked.length > 0);
    document.querySelector('[data-relationship-status]').textContent = talked.length
      ? `今天和${talked.join('、')}谈过`
      : '今天还没有和场上的人谈过';
  } else {
    optional.classList.toggle('complete', state.relationship.coachMet);
    const trustCopy = state.relationship.coachTrust > 0 ? `，默契 ${state.relationship.coachTrust}` : '';
    document.querySelector('[data-relationship-status]').textContent = state.relationship.coachMet
      ? `郭教练已经记住了你的名字${trustCopy}`
      : '还没有和郭教练说话';
  }

  renderPhases();
  renderJournal();
  renderWorldTargets();
  renderShop();
  renderRepairs();
  renderManagementMetrics();
  renderSeasonDocket();
  renderTraining();
  renderModals();
  renderManagementControls();
  updatePlayerVisual();
}

function beginTraining() {
  const started = applyTransition(
    startTraining,
    (before, after) => !before.training.started && after.training.started
  );
  if (!started) return false;
  trainingSession = createTrainingSession();
  trainingPointer = reducedMotion.matches ? TRAINING_TARGETS[0] : 0.5;
  trainingFeedback = '';
  trainingActive = true;
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  toastHost.replaceChildren();
  showSpeech('郭教练', '不用证明什么。看准了，踢三脚就好。', { x: 53, y: 48 }, 3000);
  render();
  return true;
}

function resolveTrainingShot(pointer = trainingPointer) {
  if (!trainingActive || !trainingSession) return false;
  const beforeScore = trainingSession.score;
  trainingSession = takeShot(trainingSession, pointer);
  const points = trainingSession.score - beforeScore;
  trainingFeedback = points === 2 ? '正中目标' : points === 1 ? '擦到边缘' : '偏了一点';

  if (trainingSession.complete) {
    const finalScore = trainingSession.score;
    trainingActive = false;
    trainingFeedback = '';
    applyTransition(
      current => finishTraining(current, finalScore),
      (before, after) => !before.training.completedToday && after.training.completedToday
    );
    showSpeech('郭教练', finalScore >= 5 ? '下周训练，你也站我们这边。' : '脚感会慢慢回来的。', { x: 53, y: 48 }, 3400);
  } else {
    if (reducedMotion.matches) trainingPointer = TRAINING_TARGETS[trainingSession.shotIndex];
    renderTraining();
  }
  return true;
}

function openManagementAction(actionId) {
  if (!isCampaignDay(state.dayIndex) || state.phase !== 'morning') return false;
  notes.hidden = true;
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  if (actionId.startsWith('promise:')) {
    return startEpisodePromiseActivity(actionId.split(':')[1]);
  }
  if (actionId === 'episode-match' && state.management.match && !state.management.matchResult) {
    decisionAction = 'play-match';
    render();
    return true;
  }
  if (actionId === 'naming-match' && state.namingRights.match && !state.namingRights.weekComplete) {
    decisionAction = 'play-naming-match';
    render();
    return true;
  }
  openStoryScene(isNamingRightsWeekDay(state.dayIndex)
    ? getNamingDay(state.dayIndex).sceneId
    : getEpisodeDay(state.dayIndex).sceneId);
  return true;
}

function applyDecisionChoice(choiceId) {
  if (!decisionAction || ['play-match', 'play-naming-match', 'play-season-match'].includes(decisionAction)) return false;
  const previous = state;
  if (decisionAction === 'resolve-shortfall') state = resolveManagementShortfall(state, choiceId);
  if (decisionAction.startsWith('season-action:')) state = chooseSeasonAction(state, choiceId);
  if (decisionAction.startsWith('season-project:')) {
    const projectId = decisionAction.slice('season-project:'.length);
    const levelBefore = state.season.projects[projectId];
    state = choiceId.startsWith('visit:')
      ? visitSeasonProject(state, choiceId.slice('visit:'.length))
      : buildSeasonProject(state, choiceId);
    if (state.season.projects[projectId] > levelBefore) {
      recentProjectBuildId = projectId;
      window.clearTimeout(constructionRevealTimer);
      constructionRevealTimer = window.setTimeout(() => {
        document.querySelector(`[data-construction-project="${projectId}"]`)?.classList.remove('is-revealing');
        recentProjectBuildId = null;
      }, reducedMotion.matches ? 0 : 1400);
    }
  }
  const changed = state !== previous;
  if (changed) {
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  decisionAction = state.management.shortfallPending ? 'resolve-shortfall' : null;
  render();
  return changed;
}

function applyStoryAction(actionId) {
  const previous = state;
  if (actionId === 'acknowledge-notice') {
    state = acknowledgeEpisodeNotice(state);
  } else if (actionId === 'confirm-promises') {
    if (promiseDraft.length !== 2) return false;
    state = chooseEpisodePromises(state, promiseDraft);
  } else if (actionId.startsWith('funding:')) {
    state = resolveEpisodeFunding(state, actionId.split(':')[1]);
  } else if (actionId === 'acknowledge-offer') {
    state = acknowledgeEpisodeOffer(state);
  } else if (actionId === 'start-match') {
    state = startWeeklyMatch(state);
    if (!state.management.match) {
      showToast(state.journal.at(-1)?.text);
      render();
      return false;
    }
    storySceneId = null;
    decisionAction = 'play-match';
  } else if (actionId.startsWith('hearing:')) {
    state = completeEpisodeHearing(state, actionId.split(':')[1]);
  } else if (['hold-public-vote', 'write-conditions', 'open-free-time', 'acknowledge-history'].includes(actionId)) {
    const requiredAction = getRequiredAction(state.dayIndex);
    state = completeNamingMainline(state, requiredAction, actionId);
  } else if (actionId.startsWith('naming-vote:')) {
    state = completeNamingMainline(state, 'naming-vote', actionId.slice('naming-vote:'.length));
  } else if (actionId.startsWith('naming-response:')) {
    state = completeNamingMainline(state, 'naming-response', actionId.slice('naming-response:'.length));
  } else if (actionId === 'start-naming-match') {
    state = startSecondWeeklyMatch(state);
    if (!state.namingRights.match) {
      showToast(state.journal.at(-1)?.text);
      render();
      return false;
    }
    storySceneId = null;
    decisionAction = 'play-naming-match';
  } else {
    return false;
  }

  const changed = state !== previous;
  if (changed) {
    storySceneId = null;
    storyReadOnly = false;
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  if (state.management.shortfallPending) decisionAction = 'resolve-shortfall';
  render();
  return changed;
}

function applyHighlightChoice(choiceId) {
  if (!['play-match', 'play-naming-match', 'play-season-match'].includes(decisionAction)) return false;
  const previous = state;
  const namingMatch = decisionAction === 'play-naming-match';
  const seasonMatch = decisionAction === 'play-season-match';
  state = seasonMatch
    ? resolveLeagueMatchChoice(state, choiceId)
    : namingMatch
      ? resolveSecondWeeklyMatchChoice(state, choiceId)
      : chooseMatchHighlight(state, choiceId);
  if (state !== previous) persist();
  if (seasonMatch && state.season.week.roundComplete) {
    decisionAction = null;
    const result = state.season.week.result;
    showToast(`终场 ${result.homeGoals} 比 ${result.awayGoals}。积分榜已经更新。`);
  } else if (namingMatch && state.namingRights.weekComplete) {
    decisionAction = null;
    weekSummaryDismissed = false;
    const result = state.namingRights.settlement;
    showToast(`终场 ${result.score.home} 比 ${result.score.away}。蓝布正在从招牌上落下来。`);
  } else if (!seasonMatch && !namingMatch && state.management.matchResult) {
    decisionAction = null;
    const result = state.management.matchResult;
    showToast(`终场 ${result.score.home} 比 ${result.score.away}。${result.crowdMood}。`);
  }
  render();
  return state !== previous;
}

function changeMap(exit) {
  state.world.positions[activeMapId] = { ...position };
  activeMapId = exit.targetMap;
  state.world.mapId = activeMapId;
  position = { ...exit.targetPosition };
  state.world.positions[activeMapId] = { ...position };
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  speech.hidden = true;
  render();
  fitWorld();
  persist();
  showToast(activeMapId === 'stadium' ? '沿海滨路到了海风主赛场。' : '沿海滨路回到旧训练场。');
  return true;
}

function interact(id) {
  if (!availableObject(id)) return false;
  const object = worldObjects[id];
  if (pixelDistance(position, object) > INTERACTION_DISTANCE) {
    showToast('要走近一点，才能看清。');
    return false;
  }

  let successful = false;
  if (object.kind === 'gather') {
    successful = applyTransition(
      current => collectItem(current, id),
      (before, after) => after.collectedToday.length > before.collectedToday.length
    );
  }
  if (object.kind === 'coach') {
    if (currentDay().trainingAvailable && !state.training.completedToday) {
      successful = beginTraining();
    } else {
      successful = applyTransition(
        talkToCoach,
        (before, after) => !before.relationship.coachMet && after.relationship.coachMet
      );
      showSpeech(
        '郭教练',
        successful ? '我还以为你是来让大家收拾东西的。既然不是，就先随便看看吧。' : '海边的风向一天会变好几次。',
        { x: 53, y: 48 }
      );
    }
  }
  if (object.kind === 'shop') {
    successful = applyTransition(openShop, (before, after) => before.phase !== after.phase);
    if (successful) {
      destination = null;
      pendingInteraction = null;
      movementRoute = [];
      position = { x: 73, y: 43 };
      persist();
      showSpeech(currentOrders()[0].customer, '今天这里真的开门？那我先来。', { x: 70, y: 35 }, 2800);
    }
  }
  if (object.kind === 'exit') {
    successful = changeMap(object);
  }
  if (object.kind === 'npc') {
    if (object.npc.seasonNpc) {
      activeSeasonNpcId = object.npc.id;
      destination = null;
      pendingInteraction = null;
      movementRoute = [];
      render();
      successful = true;
    } else {
      successful = applyTransition(
        current => recordNpcConversation(current, object.npc.id, object.npc.copy)
      );
      showSpeech(object.npc.name, object.npc.copy, { x: object.x, y: Math.max(20, object.y - 12) }, 5200);
    }
  }
  if (object.kind === 'mainline') {
    successful = openManagementAction(object.actionId);
  }
  if (object.kind === 'free-action') {
    successful = startNamingFreeActivity(object.actionId.split(':')[1]);
  }
  if (object.kind === 'season-action') {
    decisionAction = `season-action:${object.actionId}`;
    destination = null;
    pendingInteraction = null;
    movementRoute = [];
    render();
    successful = true;
  }
  if (object.kind === 'season-project') {
    decisionAction = `season-project:${object.projectId}`;
    destination = null;
    pendingInteraction = null;
    movementRoute = [];
    render();
    successful = true;
  }
  if (object.kind === 'season-event') {
    activeSeasonEventId = object.eventId;
    destination = null;
    pendingInteraction = null;
    movementRoute = [];
    render();
    successful = true;
  }
  if (object.kind === 'season-match') {
    const previous = state;
    state = startLeagueMatch(state);
    successful = Boolean(state.season.match && state !== previous);
    if (successful) {
      decisionAction = 'play-season-match';
      persist();
    } else {
      showToast(state.journal.at(-1)?.text);
    }
    render();
  }
  return successful;
}

function interactNearest() {
  if (trainingActive) {
    resolveTrainingShot();
    return;
  }
  const nearby = nearestObject();
  if (nearby) interact(nearby.id);
  else if (state.phase === 'morning') showToast('附近暂时没有要处理的东西。');
}

function walkToObject(id) {
  const object = worldObjects[id];
  if (!object || !availableObject(id)) return false;
  if (pixelDistance(position, object) <= INTERACTION_DISTANCE) return interact(id);
  movementRoute = [...(object.route ?? []), object.approach].map(point => ({ ...point }));
  destination = movementRoute.shift() ?? { ...object.approach };
  pendingInteraction = id;
  return true;
}

function updateDirection(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) player.dataset.direction = dx < 0 ? 'left' : 'right';
  else if (Math.abs(dy) > 0.001) player.dataset.direction = dy < 0 ? 'up' : 'down';
}

function tryMove(dxPixels, dyPixels) {
  if (!dxPixels && !dyPixels) return false;
  const nextX = position.x + dxPixels / viewMetrics.planeWidth * 100;
  const nextY = position.y + dyPixels / viewMetrics.planeHeight * 100;
  let changed = false;

  if (canStand(nextX, position.y)) {
    position.x = nextX;
    changed = true;
  }
  if (canStand(position.x, nextY)) {
    position.y = nextY;
    changed = true;
  }
  return changed;
}

function keyboardVector() {
  const left = pressedKeys.has('a') || pressedKeys.has('ArrowLeft');
  const right = pressedKeys.has('d') || pressedKeys.has('ArrowRight');
  const up = pressedKeys.has('w') || pressedKeys.has('ArrowUp');
  const down = pressedKeys.has('s') || pressedKeys.has('ArrowDown');
  return { x: Number(right) - Number(left), y: Number(down) - Number(up) };
}

function advanceMovement(deltaSeconds, timestamp) {
  if (!hasStarted
    || trainingActive
    || decisionAction
    || storySceneId
    || activeEpisodeActivity
    || activeFreeActivity
    || activeSeasonNpcId
    || activeSeasonEventId
    || seasonBoardOpen
    || elitePanelOpen
    || !hearingPanel.hidden
    || state.phase !== 'morning'
    || !summary.hidden
    || !chapterSummary.hidden
    || (!weekSummary.hidden && !weekSummaryDismissed)
    || !seasonSummary.hidden
    || !elitePanel.hidden) {
    moving = false;
    player.classList.remove('moving');
    player.dataset.frame = '0';
    return;
  }

  let vector = keyboardVector();
  if (vector.x || vector.y) {
    destination = null;
    pendingInteraction = null;
    movementRoute = [];
  } else if (destination) {
    const current = toPixels(position);
    const goal = toPixels(destination);
    vector = { x: goal.x - current.x, y: goal.y - current.y };
    if (Math.hypot(vector.x, vector.y) <= ARRIVAL_DISTANCE) {
      position = { ...destination };
      if (movementRoute.length) {
        destination = movementRoute.shift();
      } else {
        destination = null;
        const interaction = pendingInteraction;
        pendingInteraction = null;
        if (interaction) interact(interaction);
      }
      vector = { x: 0, y: 0 };
    }
  }

  const length = Math.hypot(vector.x, vector.y);
  moving = length > 0.001;
  if (moving) {
    const unitX = vector.x / length;
    const unitY = vector.y / length;
    updateDirection(unitX, unitY);
    tryMove(unitX * WALK_SPEED * deltaSeconds, unitY * WALK_SPEED * deltaSeconds);
    player.dataset.frame = String(Math.floor(timestamp / 135) % 4);
    player.classList.add('moving');
    if (hasStarted && timestamp - lastPositionSave > 2000) persist();
  } else {
    player.dataset.frame = '0';
    player.classList.remove('moving');
  }
}

function updatePlayerVisual() {
  player.style.setProperty('--screen-x', `${position.x * viewMetrics.planeWidth / 100}px`);
  player.style.setProperty('--screen-y', `${position.y * viewMetrics.planeHeight / 100}px`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fitWorld() {
  const map = getMap(activeMapId);
  const scale = Math.max(viewMetrics.viewportWidth / map.width, viewMetrics.viewportHeight / map.height);
  plane.style.width = `${Math.ceil(map.width * scale)}px`;
  plane.style.height = `${Math.ceil(map.height * scale)}px`;
  refreshViewMetrics();
  updatePlayerVisual();
  updateCamera();
}

function updateCamera() {
  const focusX = position.x * viewMetrics.planeWidth / 100;
  const focusY = position.y * viewMetrics.planeHeight / 100;
  const cameraX = clamp(viewMetrics.viewportWidth / 2 - focusX, viewMetrics.viewportWidth - viewMetrics.planeWidth, 0);
  const cameraY = clamp(viewMetrics.viewportHeight / 2 - focusY, viewMetrics.viewportHeight - viewMetrics.planeHeight, 0);
  plane.style.setProperty('--camera-x', `${cameraX}px`);
  plane.style.setProperty('--camera-y', `${cameraY}px`);
}

function pointerAt(timestamp) {
  const cycle = (timestamp % 1800) / 1800;
  return cycle <= 0.5 ? cycle * 2 : 2 - cycle * 2;
}

let visualDirty = true;

function frame(timestamp) {
  const delta = Math.min(0.04, Math.max(0, (timestamp - lastFrame) / 1000));
  lastFrame = timestamp;
  advanceMovement(delta, timestamp);
  if (trainingActive && !reducedMotion.matches) {
    trainingPointer = pointerAt(timestamp);
    const pointer = document.querySelector('[data-training-pointer]');
    if (pointer) pointer.style.left = `${trainingPointer * 100}%`;
    visualDirty = true;
  }
  if (moving || destination || visualDirty) {
    updatePlayerVisual();
    updateCamera();
    if (state.phase === 'morning') updateProximity();
    visualDirty = moving || Boolean(destination);
  }
  requestAnimationFrame(frame);
}

function enterManagementWeek(nextState) {
  if (!isManagementWeekDay(nextState.dayIndex)) return false;
  state = nextState;
  hasStarted = true;
  activeMapId = state.world.mapId;
  position = { ...(state.world.positions[activeMapId] ?? getMap(activeMapId).start) };
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  decisionAction = null;
  storySceneId = null;
  activeEpisodeActivity = null;
  activePromiseId = null;
  activeFreeActivity = null;
  activeSeasonNpcId = null;
  activeSeasonEventId = null;
  seasonBoardOpen = false;
  ledgerOpen = false;
  directWeekArmed = false;
  weekSummaryDismissed = false;
  window.clearTimeout(speechTimer);
  speech.hidden = true;
  chapterSummary.hidden = true;
  persist();
  render();
  fitWorld();
  showToast('春15日。办公室里有一张没有名字的通知。');
  return true;
}

function startManagementWeek() {
  const previous = state;
  const nextState = beginManagementWeek(state);
  if (nextState === previous || !isManagementWeekDay(nextState.dayIndex)) {
    state = nextState;
    showToast(state.journal.at(-1)?.text);
    render();
    return false;
  }
  return enterManagementWeek(nextState);
}

function startDirectManagementWeek() {
  clearSave(localStorage);
  return enterManagementWeek(createFirstWeekEntryState());
}

function startNamingRightsWeek() {
  const previous = state;
  const nextState = beginNamingRightsWeek(state);
  if (nextState === previous || !isNamingRightsWeekDay(nextState.dayIndex)) {
    state = nextState;
    showToast(state.journal.at(-1)?.text);
    render();
    return false;
  }
  state = nextState;
  hasStarted = true;
  activeMapId = 'stadium';
  state.world.mapId = activeMapId;
  position = { ...(state.world.positions.stadium ?? getMap('stadium').start) };
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  decisionAction = null;
  storySceneId = null;
  activeEpisodeActivity = null;
  activePromiseId = null;
  activeFreeActivity = null;
  ledgerOpen = false;
  weekSummaryDismissed = false;
  speech.hidden = true;
  persist();
  render();
  fitWorld();
  showToast('春22日。蓝色冠名布已经盖住旧招牌。');
  return true;
}

function enterLeagueSeason() {
  const previous = state;
  state = beginLeagueSeason(state);
  if (state === previous || !state.season.active) {
    showToast(state.journal.at(-1)?.text);
    render();
    return false;
  }
  hasStarted = true;
  activeMapId = 'stadium';
  state.world.mapId = activeMapId;
  position = { ...(state.world.positions.stadium ?? getMap('stadium').start) };
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  decisionAction = null;
  storySceneId = null;
  activeEpisodeActivity = null;
  activePromiseId = null;
  activeFreeActivity = null;
  activeSeasonNpcId = null;
  activeSeasonEventId = null;
  seasonBoardOpen = false;
  ledgerOpen = false;
  weekSummaryDismissed = true;
  speech.hidden = true;
  persist();
  render();
  fitWorld();
  showToast('七轮海风联赛开始。先在两座场地安排本轮的三件事。');
  return true;
}

function continueLeagueSeason() {
  if (!isLeagueSeason() || !state.season.week.roundComplete) return false;
  const previous = state;
  state = state.season.seasonComplete ? beginNextLeagueSeason(state) : advanceLeagueRound(state);
  if (state === previous) return false;
  activeMapId = 'stadium';
  state.world.mapId = activeMapId;
  position = { ...(state.world.positions.stadium ?? getMap('stadium').start) };
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  decisionAction = null;
  activeSeasonNpcId = null;
  activeSeasonEventId = null;
  seasonBoardOpen = false;
  elitePanelOpen = false;
  notes.hidden = true;
  persist();
  render();
  fitWorld();
  showToast(`第 ${state.season.seasonNumber} 赛季，第 ${state.season.roundIndex + 1} 轮开始。`);
  return true;
}

function goToNextDay() {
  const previousDay = state.dayIndex;
  const previousChapter = state.chapterComplete;
  state = isCampaignDay(state.dayIndex) ? advanceCampaignDay(state) : advanceDay(state);
  const successful = state.dayIndex !== previousDay || state.chapterComplete !== previousChapter;
  showToast(state.journal.at(-1)?.text);
  if (state.dayIndex !== previousDay) {
    activeMapId = isCampaignDay(state.dayIndex) ? getCampaignDay(state.dayIndex).defaultMap : 'training';
    state.world.mapId = activeMapId;
    position = { ...(state.world.positions[activeMapId] ?? getMap(activeMapId).start) };
    state.world.positions[activeMapId] = { ...position };
    destination = null;
    pendingInteraction = null;
    movementRoute = [];
    speech.hidden = true;
    notes.hidden = true;
    prompt.hidden = false;
    storySceneId = null;
    activeEpisodeActivity = null;
    activePromiseId = null;
    activeFreeActivity = null;
    decisionAction = null;
  }
  if (successful) persist();
  render();
  fitWorld();
}

function resetGame() {
  clearSave(localStorage);
  state = createGameState();
  activeMapId = 'training';
  position = { ...getMap(activeMapId).start };
  destination = null;
  pendingInteraction = null;
  movementRoute = [];
  trainingActive = false;
  trainingSession = null;
  trainingFeedback = '';
  hasStarted = true;
  newGameArmed = false;
  directWeekArmed = false;
  chapterResetArmed = false;
  weekResetArmed = false;
  decisionAction = null;
  storySceneId = null;
  storyReadOnly = false;
  promiseDraft = [];
  activeEpisodeActivity = null;
  activePromiseId = null;
  activeFreeActivity = null;
  activeSeasonNpcId = null;
  activeSeasonEventId = null;
  seasonBoardOpen = false;
  ledgerOpen = false;
  weekSummaryDismissed = false;
  speech.hidden = true;
  notes.hidden = true;
  toastHost.replaceChildren();
  prompt.hidden = false;
  document.querySelector('[data-new-game]').textContent = '从抵达序章开始';
  document.querySelector('[data-direct-week]').textContent = '直接进入春 15 日';
  document.querySelector('[data-chapter-restart]').textContent = '从抵达那天重新开始';
  document.querySelector('[data-week-restart]').textContent = '从序章重新开始';
  render();
  fitWorld();
}

plane.addEventListener('click', event => {
  if (!hasStarted || trainingActive || state.phase !== 'morning') return;
  const objectTarget = event.target.closest('[data-object]');
  if (objectTarget) {
    event.stopPropagation();
    walkToObject(objectTarget.dataset.object);
    return;
  }
  const rect = plane.getBoundingClientRect();
  const point = {
    x: (event.clientX - rect.left) / rect.width * 100,
    y: (event.clientY - rect.top) / rect.height * 100
  };
  if (canStand(point.x, point.y)) {
    destination = point;
    pendingInteraction = null;
    movementRoute = [];
  } else {
    showToast('那边过不去，沿着场边的小路走。');
  }
});

document.querySelectorAll('[data-recipe]').forEach(button => {
  button.addEventListener('click', () => {
    const served = applyTransition(
      current => serveOrder(current, button.dataset.recipe),
      (before, after) => after.ordersServed > before.ordersServed
    );
    if (served && state.phase === 'shop') {
      showSpeech(currentOrders()[state.ordersServed].customer, '轮到我了吗？不用着急。', { x: 70, y: 35 }, 1900);
    }
  });
});

document.querySelectorAll('[data-repair]').forEach(button => {
  button.addEventListener('click', () => {
    applyTransition(
      current => buyRepair(current, button.dataset.repair),
      (before, after) => after.repairs.length > before.repairs.length
    );
  });
});

document.querySelector('[data-save-money]').addEventListener('click', () => {
  applyTransition(
    chooseSaveMoney,
    (before, after) => before.eveningChoice !== after.eveningChoice
  );
});

document.querySelector('[data-finish-day]').addEventListener('click', () => {
  applyTransition(finishDay, (before, after) => before.phase !== after.phase);
});

document.querySelector('[data-next-day]').addEventListener('click', goToNextDay);

document.querySelector('[data-begin-week]').addEventListener('click', startManagementWeek);

document.querySelector('[data-decision-options]').addEventListener('click', event => {
  const button = event.target.closest('[data-decision-choice]');
  if (button) applyDecisionChoice(button.dataset.decisionChoice);
});

document.querySelector('[data-decision-close]').addEventListener('click', () => {
  if (decisionAction === 'resolve-shortfall') return;
  decisionAction = null;
  render();
});

document.querySelector('[data-season-response-options]').addEventListener('click', event => {
  const button = event.target.closest('[data-season-response]');
  if (!button || !activeSeasonNpcId) return;
  const previous = state;
  state = chooseSeasonNpcResponse(state, activeSeasonNpcId, button.dataset.seasonResponse);
  if (state !== previous) {
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  render();
});

document.querySelector('[data-season-memory-talk]').addEventListener('click', () => {
  if (!activeSeasonNpcId) return;
  const previous = state;
  state = chooseSeasonNpcMemory(state, activeSeasonNpcId);
  if (state !== previous && state.season.week.memoryNpcIds.includes(activeSeasonNpcId)) {
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  render();
});

document.querySelector('[data-season-conversation-close]').addEventListener('click', () => {
  activeSeasonNpcId = null;
  render();
  viewport.focus();
});

document.querySelector('[data-season-event-options]').addEventListener('click', event => {
  const button = event.target.closest('[data-season-event-choice]');
  if (!button || !activeSeasonEventId || state.season.week.eventChoiceId) return;
  const previous = state;
  state = chooseSeasonEventDecision(state, activeSeasonEventId, button.dataset.seasonEventChoice);
  if (state !== previous && state.season.week.eventChoiceId) {
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  render();
});

document.querySelector('[data-season-event-close]').addEventListener('click', () => {
  activeSeasonEventId = null;
  render();
  viewport.focus();
});

document.querySelector('[data-season-board-open]').addEventListener('click', () => {
  if (!isLeagueSeason()) return;
  seasonBoardOpen = true;
  render();
});

document.querySelector('[data-season-board-close]').addEventListener('click', () => {
  seasonBoardOpen = false;
  render();
  viewport.focus();
});

document.querySelector('[data-story-options]').addEventListener('click', event => {
  const button = event.target.closest('[data-story-action]');
  if (button && !button.disabled) applyStoryAction(button.dataset.storyAction);
});

document.querySelector('[data-promise-picker]').addEventListener('click', event => {
  const button = event.target.closest('[data-promise-pick]');
  if (!button) return;
  const promiseId = button.dataset.promisePick;
  if (promiseDraft.includes(promiseId)) {
    promiseDraft = promiseDraft.filter(id => id !== promiseId);
  } else if (promiseDraft.length < 2) {
    promiseDraft = [...promiseDraft, promiseId];
  } else {
    showToast('今天只能先答应两件事。可以先取消一件。');
  }
  renderStoryScene();
});

document.querySelector('[data-story-close]').addEventListener('click', () => {
  storySceneId = null;
  storyReadOnly = false;
  render();
  viewport.focus();
});

document.querySelector('[data-episode-activity]').addEventListener('click', event => {
  if (activeFreeActivity) {
    const choice = event.target.closest('[data-free-quality]');
    if (choice) {
      takeNamingFreeChoice(Number(choice.dataset.freeQuality), choice.textContent.trim());
      return;
    }
    if (event.target.closest('[data-free-finish]')) finishNamingFreeActivity();
    return;
  }
  const pass = event.target.closest('[data-pass-value]');
  if (pass && activeEpisodeActivity?.type === 'train') {
    activeEpisodeActivity = takePass(activeEpisodeActivity, Number(pass.dataset.passValue));
    renderEpisodeActivity();
    return;
  }
  const item = event.target.closest('[data-fundraiser-item]');
  if (item && activeEpisodeActivity?.type === 'fundraise') {
    const previousStep = activeEpisodeActivity.step;
    activeEpisodeActivity = serveFundraiser(activeEpisodeActivity, item.dataset.fundraiserItem);
    if (activeEpisodeActivity.step === previousStep) showToast('这位客人要的不是这个。再看一眼。');
    renderEpisodeActivity();
    return;
  }
  const clue = event.target.closest('[data-archive-clue]');
  if (clue && activeEpisodeActivity?.type === 'records') {
    activeEpisodeActivity = inspectArchiveClue(activeEpisodeActivity, clue.dataset.archiveClue);
    renderEpisodeActivity();
    return;
  }
  const mode = event.target.closest('[data-fundraising-mode]');
  if (mode) {
    finishEpisodePromiseActivity(mode.dataset.fundraisingMode);
    return;
  }
  if (event.target.closest('[data-activity-finish]')) finishEpisodePromiseActivity();
});

document.querySelector('[data-activity-close]').addEventListener('click', () => {
  if (activeFreeActivity) {
    showToast('这件事已经开始了。做完三个小步骤，今天就能安心结束。');
    return;
  }
  activeEpisodeActivity = null;
  activePromiseId = null;
  render();
  viewport.focus();
});

document.querySelector('[data-hearing-options]').addEventListener('click', event => {
  const button = event.target.closest('[data-story-action]');
  if (button) applyStoryAction(button.dataset.storyAction);
});

document.querySelector('[data-care-open]').addEventListener('click', () => {
  if (isLeagueSeason()) {
    seasonBoardOpen = true;
    render();
    return;
  }
  if (!isCampaignDay(state.dayIndex)) return;
  openStoryScene(
    isNamingRightsWeekDay(state.dayIndex) ? getNamingDay(state.dayIndex).sceneId : getEpisodeDay(state.dayIndex).sceneId,
    { readOnly: isCurrentCampaignDayResolved() }
  );
});

document.querySelector('[data-ledger-toggle]').addEventListener('click', () => {
  ledgerOpen = !ledgerOpen;
  renderManagementMetrics();
});

document.querySelector('[data-match-options]').addEventListener('click', event => {
  const button = event.target.closest('[data-highlight-choice]');
  if (button) applyHighlightChoice(button.dataset.highlightChoice);
});

document.querySelector('[data-end-management-day]').addEventListener('click', () => {
  if (state.dayIndex === 9 && state.management.weekComplete) {
    startNamingRightsWeek();
    return;
  }
  if (state.dayIndex === 16 && state.namingRights.weekComplete) {
    enterLeagueSeason();
    return;
  }
  const previous = state;
  state = finishManagementDay(state);
  showToast(state.journal.at(-1)?.text);
  if (state !== previous) {
    weekSummaryDismissed = false;
    persist();
  }
  render();
});

document.querySelector('[data-week-walk]').addEventListener('click', () => {
  weekSummaryDismissed = true;
  state = { ...state, phase: 'morning' };
  persist();
  render();
  viewport.focus();
});

document.querySelector('[data-begin-naming-week]').addEventListener('click', startNamingRightsWeek);
document.querySelector('[data-begin-season]').addEventListener('click', enterLeagueSeason);

document.querySelector('[data-season-summary-board]').addEventListener('click', () => {
  seasonBoardOpen = true;
  render();
});

document.querySelector('[data-season-next]').addEventListener('click', () => {
  if (state.season?.seasonComplete && state.season.eliteQualified && ['invited', 'match', 'complete'].includes(state.season.elite?.status)) {
    elitePanelOpen = true;
    render();
    return;
  }
  continueLeagueSeason();
});

document.querySelector('[data-elite-preparations]').addEventListener('click', event => {
  const button = event.target.closest('[data-elite-preparation]');
  if (!button) return;
  const previous = state;
  state = chooseElitePreparation(state, button.dataset.elitePreparation);
  if (state !== previous && state.season.elite.status === 'match') {
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  render();
});

document.querySelector('[data-elite-choices]').addEventListener('click', event => {
  const button = event.target.closest('[data-elite-choice]');
  if (!button) return;
  const previous = state;
  state = chooseEliteMatchChoice(state, button.dataset.eliteChoice);
  if (state !== previous) {
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  render();
});

document.querySelector('[data-elite-close]').addEventListener('click', () => {
  elitePanelOpen = false;
  render();
  viewport.focus();
});

document.querySelector('[data-elite-skip]').addEventListener('click', () => {
  elitePanelOpen = false;
  continueLeagueSeason();
});

document.querySelector('[data-elite-next]').addEventListener('click', () => {
  elitePanelOpen = false;
  continueLeagueSeason();
});

document.querySelector('[data-week-restart]').addEventListener('click', event => {
  if (!weekResetArmed) {
    weekResetArmed = true;
    event.currentTarget.textContent = '确认从序章重新开始';
    return;
  }
  resetGame();
});

document.querySelector('[data-continue]').addEventListener('click', () => {
  hasStarted = true;
  persist();
  render();
  viewport.focus();
});

document.querySelector('[data-direct-week]').addEventListener('click', event => {
  if (loaded.ok && !directWeekArmed) {
    directWeekArmed = true;
    event.currentTarget.textContent = '确认进入春 15 日';
    return;
  }
  startDirectManagementWeek();
});

document.querySelector('[data-new-game]').addEventListener('click', event => {
  if (!loaded.ok) {
    resetGame();
    return;
  }
  if (!newGameArmed) {
    newGameArmed = true;
    event.currentTarget.textContent = '确认从序章开始';
    return;
  }
  resetGame();
});

document.querySelector('[data-chapter-restart]').addEventListener('click', event => {
  if (!chapterResetArmed) {
    chapterResetArmed = true;
    event.currentTarget.textContent = '确认从春 12 日开始';
    return;
  }
  resetGame();
});

document.querySelector('[data-shoot]').addEventListener('click', () => resolveTrainingShot());
document.querySelector('[data-training-track]').addEventListener('pointerdown', event => {
  const rect = event.currentTarget.getBoundingClientRect();
  trainingPointer = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  renderTraining();
});

function toggleNotes(force) {
  notes.hidden = typeof force === 'boolean' ? !force : !notes.hidden;
}

document.querySelector('[data-notes-toggle]').addEventListener('click', () => toggleNotes());
document.querySelector('[data-notes-close]').addEventListener('click', () => { notes.hidden = true; });

document.querySelectorAll('[data-move]').forEach(button => {
  const key = button.dataset.move;
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    destination = null;
    pendingInteraction = null;
    movementRoute = [];
    pressedKeys.add(key);
    button.setPointerCapture?.(event.pointerId);
  });
  const release = () => pressedKeys.delete(key);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

touchAction.addEventListener('click', interactNearest);

document.addEventListener('keydown', event => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  if (trainingActive) {
    if (reducedMotion.matches && ['ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      trainingPointer = clamp(trainingPointer + (key === 'ArrowLeft' ? -0.06 : 0.06), 0, 1);
      renderTraining();
    }
    if ((key === 'e' || key === ' ') && !event.repeat) {
      event.preventDefault();
      resolveTrainingShot();
    }
    return;
  }

  if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(key)) {
    event.preventDefault();
    pressedKeys.add(key);
  }
  if (key === 'e' && !event.repeat) {
    event.preventDefault();
    interactNearest();
  }
  if (key === 'j' && !event.repeat) {
    event.preventDefault();
    toggleNotes();
  }
});

document.addEventListener('keyup', event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  pressedKeys.delete(key);
});

window.addEventListener('blur', () => pressedKeys.clear());
window.addEventListener('resize', fitWorld);

window.__integratedDayDebug = {
  getState: () => structuredClone(state),
  getPosition: () => ({ ...position }),
  getMapId: () => activeMapId,
  walkToObject,
  interact,
  openManagementAction,
  beginNamingRightsWeek: startNamingRightsWeek,
  startNamingFreeActivity,
  finishNamingFreeActivity,
  chooseDecision: applyDecisionChoice,
  chooseHighlight: applyHighlightChoice,
  finishManagementDay: () => {
    const previous = state;
    state = finishManagementDay(state);
    if (state !== previous) persist();
    render();
    return state !== previous;
  },
  advanceCampaignDay: goToNextDay,
  shootAt: value => resolveTrainingShot(value),
  isMoving: () => moving || Boolean(destination),
  setSeasonProjects: levels => {
    if (!state.season) return false;
    state.season.projects = { ...state.season.projects, ...levels };
    render();
    return true;
  },
  hasSave: () => loadSave(localStorage).ok,
  clearProjectSave: () => clearSave(localStorage)
};

fitWorld();
render();
requestAnimationFrame(frame);
