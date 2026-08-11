import { getDayContent, getOrders, requiredInventoryForDay } from './daily-content.js';
import { getCampaignDay, getRequiredAction, isPrologueDay, isManagementWeekDay } from './campaign-content.js';
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
  recordNpcConversation
} from './game-state.js';
import { loadSave, writeSave, clearSave } from './save-game.js';
import { TRAINING_TARGETS, createTrainingSession, takeShot } from './training-game.js';
import { getMap, getMapObjects, canStandOnMap } from './world-content.js';
import { getNpcSchedule } from './npc-schedules.js';
import { getOpponent } from './opponent-content.js';
import { getAvailableHighlights } from './match-engine.js';
import { PROMISES, getEpisodeDay, getStoryScene } from './episode-content.js';
import {
  ARCHIVE_CLUES,
  createEpisodeActivity,
  inspectArchiveClue,
  serveFundraiser,
  takePass
} from './episode-activities.js';

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
const summaryDim = document.querySelector('[data-summary-dim]');
const resourceIcon = document.querySelector('.money-slot .item-sprite');
const touchControls = document.querySelector('.touch-controls');
const touchAction = document.querySelector('[data-action]');

const WALK_SPEED = 230;
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
let ledgerOpen = false;
let weekSummaryDismissed = false;
const pressedKeys = new Set();

function currentDay() {
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
  'episode-match': 'match-center'
});

const ACTION_COPY = Object.freeze({
  'episode-notice': { title: '空白通知', goal: '去主赛场办公室看看那张还没有名字的通知。' },
  'episode-promises': { title: '门外的七号', goal: '去旧训练场找小满。今天只能先答应两件事。' },
  'episode-promise': { title: '只来得及两件事', goal: '在两个答应过的请求中，亲自完成今天这一件。' },
  'episode-funding': { title: '灯亮以前', goal: '到主赛场边决定灯光和小满下一周的工作。' },
  'episode-offer': { title: '沈峤的旧球员证', goal: '去主赛场办公室听完沈峤给出的真工作。' },
  'episode-match': { title: '比赛与五把椅子', goal: '走到中圈。比赛以后，让小满先说自己的选择。' }
});

const STORY_PROP_MAP = Object.freeze({ 'player-card': 'card' });
const STORY_PORTRAIT_MAP = Object.freeze({ 'aunt-xu': 'xu' });

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

function pendingPromiseIds() {
  return state.episode.promisesChosen.filter(id => !state.episode.promisesCompleted.includes(id));
}

function rebuildWorldObjects() {
  const map = getMap(activeMapId);
  const objects = {};
  const requiredAction = getRequiredAction(state.dayIndex);
  const requiredObjectId = MAINLINE_OBJECTS[requiredAction];
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
        label: isEpisodeDayResolved()
          ? '今天的决定已经完成'
          : requiredAction === 'episode-promises'
            ? '去看小满的七号背心'
            : ACTION_COPY[requiredAction].goal
      };
    }
  }

  for (const exit of map.exits) {
    objects[exit.id] = { ...exit, kind: 'exit' };
  }

  const schedules = isManagementWeekDay(state.dayIndex)
    ? getNpcSchedule(state.dayIndex, state.phase, { opponentId: state.management.opponentId, episode: state.episode })
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

function persist() {
  if (!hasStarted) return;
  state.world.mapId = activeMapId;
  state.world.positions[activeMapId] = { ...position };
  writeSave(localStorage, state, position, activeMapId);
  lastPositionSave = performance.now();
}

function hasIngredients(inventory, required) {
  return Object.entries(required).every(([key, amount]) => inventory[key] >= amount);
}

function isShopReady() {
  return hasIngredients(state.inventory, requiredInventoryForDay(state.dayIndex));
}

function toPixels(point) {
  return {
    x: point.x * plane.clientWidth / 100,
    y: point.y * plane.clientHeight / 100
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
  if (!hasStarted || trainingActive || activeEpisodeActivity || storySceneId || state.phase !== 'morning') return false;
  if (GATHERABLES[id] && state.collectedToday.includes(id)) return false;
  const object = worldObjects[id];
  if (!object) return false;
  if (isManagementWeekDay(state.dayIndex) && object.kind === 'mainline') {
    if (object.actionId.startsWith('promise:')) {
      const promiseId = object.actionId.split(':')[1];
      return [5, 6].includes(state.dayIndex)
        && state.episode.promisesChosen.includes(promiseId)
        && !state.episode.promisesCompleted.includes(promiseId)
        && !isEpisodeDayResolved();
    }
    return !isEpisodeDayResolved();
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
  if (isManagementWeekDay(state.dayIndex)) {
    if (track.dataset.mode !== 'week') {
      track.dataset.mode = 'week';
      track.classList.add('week-track');
      track.innerHTML = Array.from({ length: 7 }, (_, offset) => {
        const day = getCampaignDay(offset + 3);
        return `<li data-week-day="${offset + 3}"><span>${day.weekday}</span><strong>${day.date}日</strong></li>`;
      }).join('');
    }
    track.querySelectorAll('[data-week-day]').forEach(step => {
      const dayIndex = Number(step.dataset.weekDay);
      step.classList.toggle('active', dayIndex === state.dayIndex);
      step.classList.toggle('done', dayIndex < state.dayIndex || (dayIndex === state.dayIndex && state.phase === 'complete'));
    });
    return;
  }

  if (track.dataset.mode === 'week') {
    track.dataset.mode = 'day';
    track.classList.remove('week-track');
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
    const ring = document.createElement('span');
    ring.className = 'target-ring';
    const marker = document.createElement('span');
    marker.className = object.kind === 'exit' ? 'exit-marker' : 'mainline-marker';
    marker.textContent = object.kind === 'exit' ? '海风路' : '处理';
    button.append(ring, marker);
  }
  return button;
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
    `<button type="button" data-decision-choice="${option.id}"><strong>${option.label}</strong><small>${option.detail}</small></button>`
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
  const scene = getStoryScene(storySceneId);
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
  document.querySelector('[data-story-prop-caption]').textContent = captions[prop.dataset.prop];

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

function renderEpisodeActivity() {
  episodeActivity.hidden = !activeEpisodeActivity;
  if (!activeEpisodeActivity) return;
  const promise = PROMISES[activePromiseId];
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
  const match = state.management?.match;
  const active = decisionAction === 'play-match' && match && !state.management.matchResult;
  matchPanel.hidden = !active;
  if (!active) return;
  const opponent = getOpponent(state.management.opponentId);
  document.querySelector('[data-match-score]').textContent = `${match.homeGoals} : ${match.awayGoals}`;
  document.querySelector('[data-match-opponent]').textContent = opponent.name;
  const highlight = getAvailableHighlights(match, state.episode);
  document.querySelector('[data-match-minute]').textContent = `第 ${highlight.minute} 分钟`;
  document.querySelector('[data-match-title]').textContent = highlight.title;
  document.querySelector('[data-match-copy]').textContent = highlight.copy;
  document.querySelector('[data-match-options]').innerHTML = highlight.choices.map(choice => (
    `<button type="button" data-highlight-choice="${choice.id}"><strong>${choice.label}</strong><small>${choice.detail}</small></button>`
  )).join('');
}

function renderManagementMetrics() {
  const active = isManagementWeekDay(state.dayIndex);
  const metrics = document.querySelector('[data-management-metrics]');
  const care = document.querySelector('[data-weekly-care]');
  metrics.hidden = !active || !ledgerOpen;
  care.hidden = !active;
  if (!active) return;
  const careCopy = state.management.weekComplete
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

function renderManagementControls() {
  const button = document.querySelector('[data-end-management-day]');
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
  const managementDay = isManagementWeekDay(state.dayIndex);
  const complete = state.phase === 'complete'
    && !state.chapterComplete
    && !(managementDay && state.management.weekComplete);
  summary.hidden = !complete;
  if (!complete) return;

  const day = currentDay();
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
  const active = Boolean(state.management?.weekComplete && state.management.settlement && !weekSummaryDismissed);
  weekSummary.hidden = !active;
  if (!active) return;
  const settlement = state.management.settlement;
  const opponent = getOpponent(state.management.opponentId);
  const outcomeCopy = settlement.outcome === 'win' ? '赢下' : settlement.outcome === 'draw' ? '战平' : '输给';
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
  const managementModal = Boolean(decisionAction || storySceneId || activeEpisodeActivity || hearingActive);
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
    ? `存档停在春 ${currentDay().date} 日。可以继续原进度，也可以直接从那张空白通知开始。`
    : loaded.reason === 'absent'
      ? '新内容从春 15 日开始：一张空白通知、只能完成的两项承诺，以及周日中圈的五把椅子。'
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
  renderStartCard();
  summaryDim.hidden = summary.hidden
    && chapterSummary.hidden
    && weekSummary.hidden
    && decisionPanel.hidden
    && storyScene.hidden
    && episodeActivity.hidden
    && matchPanel.hidden
    && hearingPanel.hidden
    && startCard.hidden;
}

function render() {
  root.dataset.phase = state.phase;
  root.dataset.day = String(state.dayIndex);
  root.dataset.mode = isManagementWeekDay(state.dayIndex) ? 'management' : 'prologue';
  root.dataset.campaign = String(isManagementWeekDay(state.dayIndex));
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
  if (isManagementWeekDay(state.dayIndex)) {
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
  if (!isManagementWeekDay(state.dayIndex) || state.phase !== 'morning') return false;
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
  openStoryScene(getEpisodeDay(state.dayIndex).sceneId);
  return true;
}

function applyDecisionChoice(choiceId) {
  if (!decisionAction || decisionAction === 'play-match') return false;
  const previous = state;
  state = decisionAction === 'resolve-shortfall' ? resolveManagementShortfall(state, choiceId) : state;
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
  if (decisionAction !== 'play-match') return false;
  const previous = state;
  state = chooseMatchHighlight(state, choiceId);
  if (state !== previous) persist();
  if (state.management.matchResult) {
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
    successful = applyTransition(
      current => recordNpcConversation(current, object.npc.id, object.npc.copy)
    );
    showSpeech(object.npc.name, object.npc.copy, { x: object.x, y: Math.max(20, object.y - 12) }, 5200);
  }
  if (object.kind === 'mainline') {
    successful = openManagementAction(object.actionId);
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
  const nextX = position.x + dxPixels / plane.clientWidth * 100;
  const nextY = position.y + dyPixels / plane.clientHeight * 100;
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
    || !hearingPanel.hidden
    || state.phase !== 'morning'
    || !summary.hidden
    || !chapterSummary.hidden
    || (!weekSummary.hidden && !weekSummaryDismissed)) {
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
  player.style.setProperty('--screen-x', `${position.x * plane.clientWidth / 100}px`);
  player.style.setProperty('--screen-y', `${position.y * plane.clientHeight / 100}px`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fitWorld() {
  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const map = getMap(activeMapId);
  const scale = Math.max(viewportWidth / map.width, viewportHeight / map.height);
  plane.style.width = `${Math.ceil(map.width * scale)}px`;
  plane.style.height = `${Math.ceil(map.height * scale)}px`;
  updatePlayerVisual();
  updateCamera();
}

function updateCamera() {
  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const focusX = position.x * plane.clientWidth / 100;
  const focusY = position.y * plane.clientHeight / 100;
  const cameraX = clamp(viewportWidth / 2 - focusX, viewportWidth - plane.clientWidth, 0);
  const cameraY = clamp(viewportHeight / 2 - focusY, viewportHeight - plane.clientHeight, 0);
  plane.style.setProperty('--camera-x', `${cameraX}px`);
  plane.style.setProperty('--camera-y', `${cameraY}px`);
}

function pointerAt(timestamp) {
  const cycle = (timestamp % 1800) / 1800;
  return cycle <= 0.5 ? cycle * 2 : 2 - cycle * 2;
}

function frame(timestamp) {
  const delta = Math.min(0.04, Math.max(0, (timestamp - lastFrame) / 1000));
  lastFrame = timestamp;
  advanceMovement(delta, timestamp);
  if (trainingActive && !reducedMotion.matches) {
    trainingPointer = pointerAt(timestamp);
    document.querySelector('[data-training-pointer]').style.left = `${trainingPointer * 100}%`;
  }
  updatePlayerVisual();
  updateCamera();
  if (state.phase === 'morning') updateProximity();
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

function goToNextDay() {
  const previousDay = state.dayIndex;
  const previousChapter = state.chapterComplete;
  state = isManagementWeekDay(state.dayIndex) ? advanceCampaignDay(state) : advanceDay(state);
  const successful = state.dayIndex !== previousDay || state.chapterComplete !== previousChapter;
  showToast(state.journal.at(-1)?.text);
  if (state.dayIndex !== previousDay) {
    activeMapId = isManagementWeekDay(state.dayIndex) ? getCampaignDay(state.dayIndex).defaultMap : 'training';
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
  if (!isManagementWeekDay(state.dayIndex)) return;
  openStoryScene(getEpisodeDay(state.dayIndex).sceneId, { readOnly: isEpisodeDayResolved() });
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
  hasSave: () => loadSave(localStorage).ok,
  clearProjectSave: () => clearSave(localStorage)
};

fitWorld();
render();
requestAnimationFrame(frame);
