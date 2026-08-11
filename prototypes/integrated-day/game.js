import { getDayContent, getOrders, requiredInventoryForDay } from './daily-content.js';
import { getCampaignDay, getRequiredAction, isPrologueDay, isManagementWeekDay } from './campaign-content.js';
import {
  GATHERABLES,
  REPAIRS,
  MARKET_PLANS,
  WELCOME_PLANS,
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
  completeRequiredAction,
  resolveManagementShortfall,
  startWeeklyMatch,
  chooseMatchHighlight,
  finishManagementDay,
  advanceCampaignDay,
  recordNpcConversation
} from './game-state.js';
import { loadSave, writeSave, clearSave } from './save-game.js';
import { TRAINING_TARGETS, createTrainingSession, takeShot } from './training-game.js';
import { getMap, getMapObjects, canStandOnMap } from './world-content.js';
import { getNpcSchedule } from './npc-schedules.js';
import { OPPONENTS, getOpponent } from './opponent-content.js';
import { FACILITY_PLANS } from './facility-state.js';
import { TRAINING_FOCUS } from './roster-state.js';
import { HIGHLIGHTS } from './match-engine.js';

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
let weekSummaryDismissed = false;
const pressedKeys = new Set();

function currentDay() {
  return isPrologueDay(state.dayIndex) ? getDayContent(state.dayIndex) : getCampaignDay(state.dayIndex);
}

function currentOrders() {
  return isPrologueDay(state.dayIndex) ? getOrders(state.dayIndex) : [];
}

const MAINLINE_OBJECTS = Object.freeze({
  'review-ledger': 'stadium-office',
  'choose-training': 'coach',
  'choose-opponent': 'stadium-office',
  'choose-market': 'shop',
  'prepare-facility': 'pitch-prep',
  'welcome-opponent': 'guest-gate',
  'play-match': 'match-center'
});

const ACTION_COPY = Object.freeze({
  'review-ledger': { title: '账本上的缺口', goal: '去主赛场办公室看本周账本。沈峤正在等你。' },
  'choose-training': { title: '谁能上场', goal: '到旧训练场决定本周训练重点。' },
  'choose-opponent': { title: '邀请谁来', goal: '去主赛场办公室确认第一支外队。' },
  'choose-market': { title: '看台之外', goal: '回场边小店安排周末集市。' },
  'prepare-facility': { title: '比赛前夜', goal: '在主赛场决定本周最重要的设施准备。' },
  'welcome-opponent': { title: '客队抵达', goal: '去主赛场客队通道完成接待。' },
  'play-match': { title: '第一场主场周赛', goal: '走到草场边，开始今天的比赛。' }
});

function rebuildWorldObjects() {
  const map = getMap(activeMapId);
  const objects = {};
  const requiredAction = getRequiredAction(state.dayIndex);
  const requiredObjectId = MAINLINE_OBJECTS[requiredAction];

  for (const object of getMapObjects(activeMapId)) {
    if (isPrologueDay(state.dayIndex)) {
      objects[object.id] = { ...object };
    } else if (object.id === requiredObjectId) {
      objects[object.id] = {
        ...object,
        kind: 'mainline',
        actionId: requiredAction,
        label: state.management.completedActions.includes(requiredAction)
          ? '今天的决定已经完成'
          : object.label
      };
    }
  }

  for (const exit of map.exits) {
    objects[exit.id] = { ...exit, kind: 'exit' };
  }

  const schedules = isManagementWeekDay(state.dayIndex)
    ? getNpcSchedule(state.dayIndex, state.phase, { opponentId: state.management.opponentId })
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
  if (!hasStarted || trainingActive || state.phase !== 'morning') return false;
  if (GATHERABLES[id] && state.collectedToday.includes(id)) return false;
  const object = worldObjects[id];
  if (!object) return false;
  if (isManagementWeekDay(state.dayIndex) && object.kind === 'mainline') {
    return !state.management.completedActions.includes(object.actionId);
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
    const completed = state.management.completedActions.includes(actionId);
    return {
      title: state.management.weekComplete ? '第一周已经结算' : state.phase === 'complete' ? '今天的决定已经记下' : action.title,
      goal: state.management.weekComplete
        ? '可以继续在球场走走。这一周的结果已经保存。'
        : state.phase === 'complete'
        ? state.dayIndex === 9 ? '这一周已经结算。' : '今天已经结束，可以去往下一天。'
        : completed
          ? '决定已经完成。准备好以后，收好今天的记录。'
          : action.goal,
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
    ? '安排周末集市'
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
  if (actionId === 'review-ledger') return '确认本周账本';
  if (actionId === 'choose-training') return TRAINING_FOCUS[choiceId]?.label ?? choiceId;
  if (actionId === 'choose-opponent') return OPPONENTS[choiceId]?.name ?? choiceId;
  if (actionId === 'choose-market') return MARKET_PLANS[choiceId]?.label ?? choiceId;
  if (actionId === 'prepare-facility') return FACILITY_PLANS[choiceId]?.label ?? choiceId;
  if (actionId === 'welcome-opponent') return WELCOME_PLANS[choiceId]?.label ?? choiceId;
  if (actionId === 'play-match') return '完成主场比赛';
  return choiceId;
}

function getDecisionConfig(actionId) {
  if (actionId === 'review-ledger') {
    return {
      kicker: '春 15 日 / 主赛场办公室',
      title: '先承认账本里的缺口',
      copy: '社区预约金暂时补上了周转，但工资和维护已经先到期。沈峤提出由澜岸体育承担后续债务。',
      options: [{ id: 'acknowledge', label: '把账本签下来', detail: '委员会支持 +1 / 沈峤正式提出合作' }]
    };
  }
  if (actionId === 'choose-training') {
    return {
      kicker: '春 16 日 / 旧训练场',
      title: '这周首先练什么',
      copy: '一次训练不可能解决所有问题。你的选择也会告诉球员，谁的风险更值得承担。',
      options: [
        { id: 'pressing', label: '前场压迫', detail: '进攻 +6 / 伤病风险 +2' },
        { id: 'shape', label: '整体站位', detail: '防守 +5 / 凝聚 +2' },
        { id: 'youth', label: '给年轻人机会', detail: '凝聚 +3 / 小满信任 +2' }
      ]
    };
  }
  if (actionId === 'choose-opponent') {
    return {
      kicker: '春 17 日 / 外队邀请',
      title: '第一场周赛邀请谁',
      copy: '强队会带来更多观众，也会放大接待成本和球队差距。',
      options: Object.values(OPPONENTS).map(opponent => ({
        id: opponent.id,
        label: opponent.name,
        detail: `${opponent.cost}元 / 预计${opponent.expectedAudience}人 / ${opponent.style}`
      }))
    };
  }
  if (actionId === 'choose-market') {
    return {
      kicker: '春 18 日 / 场边小店',
      title: '比赛以外，留下什么',
      copy: '周末的热闹需要有人愿意提前来，也需要球场愿意为社区让出位置。',
      options: Object.entries(MARKET_PLANS).map(([id, plan]) => ({
        id,
        label: plan.label,
        detail: `${plan.cost}元 / 观众 +${plan.audience} / 社区 +${plan.community}`
      }))
    };
  }
  if (actionId === 'prepare-facility') {
    return {
      kicker: '春 19 日 / 主赛场',
      title: '钱只能先花在一处',
      copy: '灯光、看台和草皮都需要修。周日会直接看出你先保护了谁。',
      options: Object.entries(FACILITY_PLANS).map(([id, plan]) => ({
        id,
        label: plan.label,
        detail: `${plan.cost}元 / 球场 +${plan.condition} / 观众 +${plan.audience || 0}`
      }))
    };
  }
  if (actionId === 'welcome-opponent') {
    return {
      kicker: '春 20 日 / 客队通道',
      title: '用什么方式迎接客队',
      copy: '正式流程让评审看见专业，社区迎接则让比赛先成为大家的事。',
      options: Object.entries(WELCOME_PLANS).map(([id, plan]) => ({
        id,
        label: plan.label,
        detail: `${plan.cost}元 / 观众 +${plan.audience} / 社区 +${plan.community}`
      }))
    };
  }
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
  ledger.hidden = decisionAction !== 'review-ledger';
  ledger.innerHTML = decisionAction === 'review-ledger'
    ? state.economy.entries.map(entry => `<div><span>${entry.label}</span><strong>${entry.amount > 0 ? '+' : ''}${entry.amount} 元</strong></div>`).join('')
      + `<div><span>现在可用</span><strong>${state.economy.cash} 元</strong></div>`
    : '';
  document.querySelector('[data-decision-close]').hidden = decisionAction === 'resolve-shortfall';
  document.querySelector('[data-decision-options]').innerHTML = config.options.map(option => (
    `<button type="button" data-decision-choice="${option.id}"><strong>${option.label}</strong><small>${option.detail}</small></button>`
  )).join('');
}

function renderMatchPanel() {
  const match = state.management?.match;
  const active = decisionAction === 'play-match' && match && !state.management.matchResult;
  matchPanel.hidden = !active;
  if (!active) return;
  const opponent = getOpponent(state.management.opponentId);
  document.querySelector('[data-match-score]').textContent = `${match.homeGoals} : ${match.awayGoals}`;
  document.querySelector('[data-match-opponent]').textContent = opponent.name;
  const highlight = HIGHLIGHTS[match.highlightIndex];
  document.querySelector('[data-match-minute]').textContent = `第 ${highlight.minute} 分钟`;
  document.querySelector('[data-match-title]').textContent = highlight.title;
  document.querySelector('[data-match-copy]').textContent = highlight.copy;
  document.querySelector('[data-match-options]').innerHTML = highlight.choices.map(choice => (
    `<button type="button" data-highlight-choice="${choice.id}"><strong>${choice.label}</strong><small>这个决定会立即改变场上局面</small></button>`
  )).join('');
}

function renderManagementMetrics() {
  const active = isManagementWeekDay(state.dayIndex);
  const metrics = document.querySelector('[data-management-metrics]');
  metrics.hidden = !active;
  if (!active) return;
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
  button.hidden = !state.management.completedActions.includes(actionId)
    || state.management.shortfallPending
    || Boolean(decisionAction);
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
    document.querySelector('[data-summary-copy]').textContent = state.dayIndex === 8
      ? '客队已经住下。明天的比分会被看见，但今天的接待方式也会留在大家的判断里。'
      : '决定已经记入本周账本。它不会单独决定球场的命运，但会改变下一天的余地。';
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
  document.querySelector('[data-week-summary-title]').textContent = '球场撑过了第一周';
  document.querySelector('[data-week-summary-copy]').textContent = `海风球场${outcomeCopy}${opponent.name}。比赛带来了${settlement.audience}名观众，也让委员会第一次有了继续经营的完整账目。`;
  document.querySelector('[data-week-score]').textContent = `海风球场 ${settlement.score.home} : ${settlement.score.away} ${opponent.shortName}`;
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
  const managementModal = Boolean(decisionAction);
  touchControls.hidden = trainingActive || state.phase !== 'morning' || managementModal;
  touchAction.hidden = trainingActive || state.phase !== 'morning' || managementModal;
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
    ? `存档停在春 ${currentDay().date} 日。可以继续原进度，也可以直接从主赛场的第一份账本开始。`
    : loaded.reason === 'absent'
      ? '新内容从春 15 日开始：经营大球场、邀请外队、处理现金缺口，并完成第一场主场周赛。'
      : '上次存档无法读取。可以直接体验经营周，或从抵达的早晨重新开始。';
}

function renderModals() {
  renderSummary();
  renderChapterSummary();
  renderWeekSummary();
  renderDecisionPanel();
  renderMatchPanel();
  renderStartCard();
  summaryDim.hidden = summary.hidden
    && chapterSummary.hidden
    && weekSummary.hidden
    && decisionPanel.hidden
    && matchPanel.hidden
    && startCard.hidden;
}

function render() {
  root.dataset.phase = state.phase;
  root.dataset.day = String(state.dayIndex);
  root.dataset.mode = isManagementWeekDay(state.dayIndex) ? 'management' : 'prologue';
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
    const talked = getNpcSchedule(state.dayIndex, 'morning', { opponentId: state.management.opponentId })
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
  if (actionId === 'play-match') {
    const previousMatch = state.management.match;
    state = startWeeklyMatch(state);
    if (!state.management.match) {
      showToast(state.journal.at(-1)?.text);
      render();
      return false;
    }
    decisionAction = 'play-match';
    if (state.management.match !== previousMatch) persist();
  } else {
    decisionAction = actionId;
  }
  render();
  return true;
}

function applyDecisionChoice(choiceId) {
  if (!decisionAction || decisionAction === 'play-match') return false;
  const previous = state;
  state = decisionAction === 'resolve-shortfall'
    ? resolveManagementShortfall(state, choiceId)
    : completeRequiredAction(state, decisionAction, choiceId);
  const changed = state !== previous;
  if (changed) {
    showToast(state.journal.at(-1)?.text);
    persist();
  }
  decisionAction = state.management.shortfallPending ? 'resolve-shortfall' : null;
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
  directWeekArmed = false;
  weekSummaryDismissed = false;
  window.clearTimeout(speechTimer);
  speech.hidden = true;
  chapterSummary.hidden = true;
  persist();
  render();
  fitWorld();
  showToast('春15日。主赛场的账本已经摊开。');
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
  weekSummaryDismissed = false;
  speech.hidden = true;
  notes.hidden = true;
  toastHost.replaceChildren();
  prompt.hidden = false;
  document.querySelector('[data-new-game]').textContent = '从抵达序章开始';
  document.querySelector('[data-direct-week]').textContent = '直接进入经营周';
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
    event.currentTarget.textContent = '确认进入经营周';
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
