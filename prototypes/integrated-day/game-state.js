import { getDayContent, getOrders, requiredInventoryForDay } from './daily-content.js';
import { getCampaignDay, getRequiredAction, isManagementWeekDay } from './campaign-content.js';
import { createEconomy, postLedgerEntry, resolveShortfall } from './economy-state.js';
import { createFacilities, FACILITY_PLANS, prepareFacility } from './facility-state.js';
import { createGovernance, applyGovernanceEffect } from './governance-state.js';
import { getOpponent } from './opponent-content.js';
import { createRoster, chooseTrainingFocus } from './roster-state.js';
import { createMatch, resolveHighlight, finishMatch } from './match-engine.js';

export const GATHERABLES = Object.freeze({
  'tea-a': { inventoryKey: 'tea', label: '茶叶', journal: '花槽里的海岸茶草被风吹得很干净。' },
  'tea-b': { inventoryKey: 'tea', label: '茶叶', journal: '围网边还有一束可以用的茶草。' },
  'fruit-a': { inventoryKey: 'fruit', label: '果子', journal: '小店旁的配送箱里有一篮果子。' },
  'fruit-b': { inventoryKey: 'fruit', label: '果子', journal: '自行车架旁还放着一篮完整的果子。' }
});

export const ORDER_SEQUENCE = getOrders(0);

export const RECIPES = Object.freeze({
  tea: { label: '青草茶', cost: { tea: 1, water: 1 } },
  fruit: { label: '果子水', cost: { fruit: 1, water: 1 } },
  towel: { label: '干净毛巾', cost: { cloth: 1 } }
});

export const REPAIRS = Object.freeze({
  net: { label: '新球网', cost: 24, result: '两边球门都挂上了平整的新网。' },
  awning: { label: '小店遮雨棚', cost: 18, result: '褪色的遮雨棚重新撑了起来。' },
  bleachers: { label: '旧看台', cost: 28, result: '两排旧看台坐上去不再晃动。' }
});

export const MARKET_PLANS = Object.freeze({
  'seafood-market': Object.freeze({ label: '海鲜夜市', cost: 24, audience: 22, revenue: 30, community: 2 }),
  'youth-clinic': Object.freeze({ label: '青少年体验课', cost: 12, audience: 10, revenue: 12, community: 5 })
});

export const WELCOME_PLANS = Object.freeze({
  'business-welcome': Object.freeze({ label: '正式商务接待', cost: 20, audience: 12, community: 1, governance: 1 }),
  'community-welcome': Object.freeze({ label: '社区共同迎接', cost: 8, audience: 8, community: 4, governance: 0 })
});

function createManagementProgress() {
  return {
    completedActions: [],
    dailyRecords: [],
    opponentId: null,
    trainingFocus: null,
    marketPlan: null,
    facilityPlan: null,
    welcomePlan: null,
    match: null,
    matchResult: null,
    settlement: null,
    shortfallPending: false,
    weekComplete: false
  };
}

function copyState(state) {
  return {
    ...state,
    inventory: { ...state.inventory },
    collectedToday: [...state.collectedToday],
    repairs: [...state.repairs],
    relationship: { ...state.relationship },
    training: { ...state.training },
    events: [...state.events],
    journal: state.journal.map(entry => ({ ...entry })),
    history: state.history.map(entry => ({ ...entry })),
    campaign: state.campaign ? { ...state.campaign } : undefined,
    economy: state.economy ? {
      ...state.economy,
      entries: state.economy.entries.map(entry => ({ ...entry })),
      shortfall: state.economy.shortfall ? { ...state.economy.shortfall } : null
    } : undefined,
    facilities: state.facilities ? { ...state.facilities } : undefined,
    roster: state.roster ? { ...state.roster } : undefined,
    governance: state.governance ? { ...state.governance } : undefined,
    management: state.management ? {
      ...state.management,
      completedActions: [...state.management.completedActions],
      dailyRecords: state.management.dailyRecords.map(entry => ({ ...entry })),
      match: state.management.match ? {
        ...state.management.match,
        choices: [...state.management.match.choices]
      } : null,
      matchResult: state.management.matchResult ? {
        ...state.management.matchResult,
        score: { ...state.management.matchResult.score }
      } : null,
      settlement: state.management.settlement ? {
        ...state.management.settlement,
        score: { ...state.management.settlement.score },
        metrics: { ...state.management.settlement.metrics }
      } : null
    } : undefined,
    world: state.world ? {
      ...state.world,
      positions: Object.fromEntries(Object.entries(state.world.positions).map(([key, value]) => [key, { ...value }]))
    } : undefined
  };
}

function addJournal(state, kind, text) {
  const next = copyState(state);
  next.journal.push({ kind, text, minute: next.minute });
  return next;
}

function hasIngredients(inventory, cost) {
  return Object.entries(cost).every(([key, amount]) => inventory[key] >= amount);
}

function hasDailyStock(state) {
  return hasIngredients(state.inventory, requiredInventoryForDay(state.dayIndex));
}

function addEvent(next, eventId) {
  if (!next.events.includes(eventId)) next.events.push(eventId);
}

export function createGameState() {
  return {
    version: 2,
    dayIndex: 0,
    phase: 'morning',
    minute: 550,
    energy: 100,
    money: 0,
    dailyRevenue: 0,
    inventory: { tea: 0, fruit: 0, cloth: 2, water: 4 },
    collectedToday: [],
    ordersServed: 0,
    repairs: [],
    eveningChoice: null,
    relationship: { coachMet: false, coachTrust: 0 },
    training: { started: false, completedToday: false, lastScore: null },
    events: [],
    journal: [{ kind: 'arrival', text: '今天没有必须完成的事。', minute: 550 }],
    history: [],
    chapterComplete: false,
    campaign: { prologueComplete: false, week: 0 },
    economy: createEconomy(0),
    facilities: createFacilities(),
    roster: createRoster(),
    governance: createGovernance(),
    communitySupport: 52,
    management: createManagementProgress(),
    world: {
      mapId: 'training',
      positions: {
        training: { x: 50, y: 89 },
        stadium: { x: 12, y: 78 }
      }
    }
  };
}

export const createDayState = createGameState;

export function collectItem(state, itemId) {
  if (state.phase !== 'morning') {
    return addJournal(state, 'quiet', '备料时间已经过去了，明天再来看看。');
  }
  const item = GATHERABLES[itemId];
  if (!item) return addJournal(state, 'quiet', '这里暂时没有可以收起的东西。');
  if (state.collectedToday.includes(itemId)) {
    return addJournal(state, 'quiet', `这份${item.label}已经收好了。`);
  }

  const next = copyState(state);
  next.collectedToday.push(itemId);
  next.inventory[item.inventoryKey] += 1;
  next.minute += 12;
  next.energy = Math.max(0, next.energy - 3);
  next.journal.push({ kind: 'gather', text: item.journal, minute: next.minute });
  return next;
}

export function talkToCoach(state) {
  if (state.phase !== 'morning') {
    return addJournal(state, 'quiet', '郭教练已经开始带下午的练习。');
  }
  if (state.relationship.coachMet) {
    const day = getDayContent(state.dayIndex);
    const text = day.trainingAvailable && !state.training.completedToday
      ? '郭教练指了指球门，说有空可以来踢三脚。'
      : '郭教练朝你点点头，又把注意力放回场上。';
    return addJournal(state, 'quiet', text);
  }

  const next = copyState(state);
  next.relationship.coachMet = true;
  next.minute += 10;
  addEvent(next, 'met-coach');
  next.journal.push({
    kind: 'relationship',
    text: '郭教练说，他原以为你是来让大家收拾东西的。',
    minute: next.minute
  });
  return next;
}

export function startTraining(state) {
  const day = getDayContent(state.dayIndex);
  if (state.phase !== 'morning' || !day.trainingAvailable) {
    return addJournal(state, 'quiet', '今天先不用急着练球。');
  }
  if (state.training.started || state.training.completedToday) {
    return addJournal(state, 'quiet', '今天的三脚已经踢完了。');
  }

  const next = copyState(state);
  next.training.started = true;
  if (!next.relationship.coachMet) {
    next.relationship.coachMet = true;
    addEvent(next, 'met-coach');
  }
  next.minute += 5;
  next.journal.push({ kind: 'training', text: '郭教练把球拨到你脚边，只说：试三脚。', minute: next.minute });
  return next;
}

export function finishTraining(state, score) {
  if (!state.training.started) {
    return addJournal(state, 'quiet', '先去场边找郭教练拿球吧。');
  }

  const safeScore = Math.max(0, Math.min(6, Math.trunc(Number(score) || 0)));
  const next = copyState(state);
  next.training.started = false;
  next.training.completedToday = true;
  next.training.lastScore = safeScore;
  next.energy = Math.max(0, next.energy - 8);
  next.minute += 15;

  if (safeScore >= 3) {
    next.relationship.coachTrust += 1;
    addEvent(next, `training-trust-day-${next.dayIndex}`);
  }
  if (safeScore >= 5) {
    addEvent(next, 'clean-three-shots');
  }

  const text = safeScore >= 5
    ? '三脚都很干净。郭教练没有夸你，只把下一只球又推近了一点。'
    : safeScore >= 3
      ? '球路有点生，但郭教练说你的判断很稳。'
      : '最后一脚偏出了门柱，郭教练说今天只是找找脚感。';
  next.journal.push({ kind: 'training', text, minute: next.minute });
  return next;
}

export function openShop(state) {
  if (state.phase !== 'morning') return addJournal(state, 'quiet', '小店今天已经开过了。');
  if (state.training.started) return addJournal(state, 'quiet', '先把这轮训练踢完。');
  if (!hasDailyStock(state)) {
    return addJournal(state, 'quiet', '今天的订单还没有备齐，沿着场边再看看。');
  }

  const next = copyState(state);
  next.phase = 'shop';
  next.minute = Math.max(next.minute, 970);
  next.journal.push({ kind: 'phase', text: '练习快结束了，场边小店亮起了灯。', minute: next.minute });
  return next;
}

export function serveOrder(state, recipeId) {
  if (state.phase !== 'shop') return addJournal(state, 'quiet', '现在还没有客人站在柜台前。');
  const orders = getOrders(state.dayIndex);
  const order = orders[state.ordersServed];
  if (!order) return addJournal(state, 'quiet', '今天的客人都已经照顾好了。');
  if (recipeId !== order.recipe) {
    return addJournal(state, 'quiet', `${order.customer}今天想要的是${order.item}。`);
  }

  const recipe = RECIPES[recipeId];
  if (!hasIngredients(state.inventory, recipe.cost)) {
    return addJournal(state, 'quiet', `做${recipe.label}的备料已经不够了。`);
  }

  const next = copyState(state);
  for (const [key, amount] of Object.entries(recipe.cost)) {
    next.inventory[key] -= amount;
  }
  next.ordersServed += 1;
  next.money += order.price;
  next.dailyRevenue += order.price;
  next.minute += 20;
  next.journal.push({
    kind: 'sale',
    text: `${order.customer}接过${order.item}，在柜台边多站了一会儿。`,
    minute: next.minute
  });
  if (next.ordersServed === orders.length) {
    next.phase = 'evening';
    next.journal.push({ kind: 'phase', text: '最后一位客人离开了，场地慢慢安静下来。', minute: next.minute });
  }
  return next;
}

export function buyRepair(state, repairId) {
  if (state.phase !== 'evening') return addJournal(state, 'quiet', '收店以后再决定把钱用在哪里。');
  if (state.eveningChoice) return addJournal(state, 'quiet', '今晚的安排已经定下来了。');
  const repair = REPAIRS[repairId];
  if (!repair) return addJournal(state, 'quiet', '这处修缮今天还没有准备好。');
  if (state.repairs.includes(repairId)) return addJournal(state, 'quiet', `${repair.label}已经修好了。`);
  if (state.money < repair.cost) return addJournal(state, 'quiet', `现在的钱还不够修好${repair.label}。`);

  const next = copyState(state);
  next.money -= repair.cost;
  next.repairs.push(repairId);
  next.eveningChoice = repairId;
  next.minute += 35;
  addEvent(next, `repair-${repairId}`);
  next.journal.push({ kind: 'repair', text: repair.result, minute: next.minute });
  return next;
}

export function chooseSaveMoney(state) {
  if (state.phase !== 'evening') return addJournal(state, 'quiet', '收店以后再考虑明天的钱。');
  if (state.eveningChoice) return addJournal(state, 'quiet', '今晚的安排已经定下来了。');

  const next = copyState(state);
  next.eveningChoice = 'save';
  next.journal.push({ kind: 'save', text: '你把今天的钱收进铁盒，留给之后更需要的时候。', minute: next.minute });
  return next;
}

export function finishDay(state) {
  if (state.phase !== 'evening') return addJournal(state, 'quiet', '今天还没有到收尾的时候。');
  if (!state.eveningChoice) return addJournal(state, 'quiet', '修缮一处，或者把钱存下，再结束今天。');

  const next = copyState(state);
  next.phase = 'complete';
  next.minute = Math.max(next.minute, 1100);
  const day = getDayContent(next.dayIndex);
  next.history.push({
    dayIndex: next.dayIndex,
    season: day.season,
    date: day.date,
    title: day.title,
    revenue: next.dailyRevenue,
    money: next.money,
    repair: next.eveningChoice === 'save' ? null : next.eveningChoice,
    savedMoney: next.eveningChoice === 'save',
    trainingScore: next.training.lastScore,
    coachTrust: next.relationship.coachTrust
  });
  next.journal.push({ kind: 'complete', text: '今天留下的东西，明天还能看见。', minute: next.minute });
  return next;
}

export function advanceDay(state) {
  if (state.phase !== 'complete') return addJournal(state, 'quiet', '先把今天安稳地过完。');

  const next = copyState(state);
  if (next.dayIndex >= 2) {
    next.chapterComplete = true;
    addEvent(next, 'chapter-one-complete');
    next.journal.push({ kind: 'chapter', text: '球场的人问你，下一周还会不会来。', minute: next.minute });
    return next;
  }

  next.dayIndex += 1;
  next.phase = 'morning';
  next.minute = 550;
  next.energy = 100;
  next.dailyRevenue = 0;
  next.inventory.cloth = Math.min(3, next.inventory.cloth + 1);
  next.inventory.water = Math.max(4, next.inventory.water);
  next.collectedToday = [];
  next.ordersServed = 0;
  next.eveningChoice = null;
  next.training = { started: false, completedToday: false, lastScore: null };
  const day = getDayContent(next.dayIndex);
  next.journal = [{
    kind: 'arrival',
    text: `${day.season}${day.date}日，${day.weather}。场地比昨天早一点醒来。`,
    minute: next.minute
  }];
  return next;
}

function syncManagementCash(next) {
  next.money = next.economy.cash;
  next.management.shortfallPending = next.economy.cash < 0;
}

function recordManagementAction(next, actionId, choiceId) {
  if (!next.management.completedActions.includes(actionId)) {
    next.management.completedActions.push(actionId);
  }
  next.management.dailyRecords.push({
    dayIndex: next.dayIndex,
    actionId,
    choiceId,
    minute: next.minute
  });
  addEvent(next, `management-${actionId}`);
}

function appendManagementJournal(next, kind, text) {
  next.journal.push({ kind, text, minute: next.minute });
}

export function beginManagementWeek(state) {
  if (state.dayIndex !== 2 || state.phase !== 'complete' || !state.chapterComplete) {
    return addJournal(state, 'quiet', '先把抵达后的三天过完。');
  }

  const next = copyState(state);
  next.dayIndex = 3;
  next.phase = 'morning';
  next.minute = 550;
  next.energy = 100;
  next.chapterComplete = false;
  next.campaign = { prologueComplete: true, week: 1 };
  next.economy = createEconomy(next.money);
  next.economy = postLedgerEntry(next.economy, { id: 'community-deposit', label: '社区预约金', amount: 120 });
  next.economy = postLedgerEntry(next.economy, { id: 'weekly-wages', label: '本周工资', amount: -70 });
  next.economy = postLedgerEntry(next.economy, { id: 'basic-maintenance', label: '基础维护', amount: -30 });
  next.management = createManagementProgress();
  next.world.mapId = 'stadium';
  syncManagementCash(next);
  next.journal = [{
    kind: 'mainline',
    text: '周一的账本摊在办公室桌上，沈峤已经在看台下等你。',
    minute: next.minute
  }];
  return next;
}

export function completeRequiredAction(state, actionId, choiceId) {
  if (!isManagementWeekDay(state.dayIndex) || state.phase !== 'morning') {
    return addJournal(state, 'quiet', '现在还不能处理这项安排。');
  }
  const requiredAction = getRequiredAction(state.dayIndex);
  if (requiredAction !== actionId || actionId === 'play-match') {
    return addJournal(state, 'quiet', '先处理今天摆在面前的事情。');
  }
  if (state.management.completedActions.includes(actionId)) {
    return addJournal(state, 'quiet', '今天的决定已经记到账本里了。');
  }

  const next = copyState(state);
  next.minute += 35;

  if (actionId === 'review-ledger') {
    if (choiceId !== 'acknowledge') return addJournal(state, 'quiet', '先把账本逐项看清楚。');
    next.governance = applyGovernanceEffect(next.governance, { support: 1 });
    appendManagementJournal(next, 'mainline', '你在欠款旁签下了自己的名字。沈峤随即提出，由澜岸体育接手债务。');
  }

  if (actionId === 'choose-training') {
    next.roster = chooseTrainingFocus(next.roster, choiceId);
    next.management.trainingFocus = choiceId;
    appendManagementJournal(next, 'training', choiceId === 'youth'
      ? '你让小满留在主力组。林川没有说话，只把训练背心递给了他。'
      : '郭教练把今天的训练重点写在白板上，全队开始重新站位。');
  }

  if (actionId === 'choose-opponent') {
    const opponent = getOpponent(choiceId);
    next.management.opponentId = opponent.id;
    next.economy = postLedgerEntry(next.economy, {
      id: `opponent-${opponent.id}`,
      label: `${opponent.name}接待费`,
      amount: -opponent.cost
    });
    next.communitySupport = Math.min(100, next.communitySupport + opponent.community);
    appendManagementJournal(next, 'opponent', `邀请发给了${opponent.name}。这会带来观众，也会把球场的准备放到更多人眼前。`);
  }

  if (actionId === 'choose-market') {
    const plan = MARKET_PLANS[choiceId];
    if (!plan) return addJournal(state, 'quiet', '这个集市方案还没有准备好。');
    next.management.marketPlan = choiceId;
    next.economy = postLedgerEntry(next.economy, {
      id: `market-${choiceId}`,
      label: plan.label,
      amount: -plan.cost
    });
    next.communitySupport = Math.min(100, next.communitySupport + plan.community);
    appendManagementJournal(next, 'market', `许姨把${plan.label}写进周六的摊位表。`);
  }

  if (actionId === 'prepare-facility') {
    const plan = FACILITY_PLANS[choiceId];
    if (!plan) return addJournal(state, 'quiet', '这项场地准备还不能开始。');
    next.facilities = prepareFacility(next.facilities, choiceId);
    next.management.facilityPlan = choiceId;
    next.economy = postLedgerEntry(next.economy, {
      id: `facility-${choiceId}`,
      label: plan.label,
      amount: -plan.cost
    });
    appendManagementJournal(next, 'facility', `${plan.label}完成了，周日的球场会直接看出这笔钱花在了哪里。`);
  }

  if (actionId === 'welcome-opponent') {
    const plan = WELCOME_PLANS[choiceId];
    if (!plan) return addJournal(state, 'quiet', '客队接待还没有这样安排。');
    next.management.welcomePlan = choiceId;
    next.economy = postLedgerEntry(next.economy, {
      id: `welcome-${choiceId}`,
      label: plan.label,
      amount: -plan.cost
    });
    next.communitySupport = Math.min(100, next.communitySupport + plan.community);
    next.governance = applyGovernanceEffect(next.governance, { support: plan.governance });
    appendManagementJournal(next, 'welcome', choiceId === 'community-welcome'
      ? '客队大巴进门时，摊主和孩子们先迎了上去。'
      : '客队按正式流程进入更衣室，罗馆长记下了接待安排。');
  }

  recordManagementAction(next, actionId, choiceId);
  syncManagementCash(next);
  return next;
}

export function resolveManagementShortfall(state, route) {
  if (!state.management?.shortfallPending) {
    return addJournal(state, 'quiet', '账上的现金暂时还能周转。');
  }
  const next = copyState(state);
  next.economy = resolveShortfall(next.economy, route);
  next.communitySupport = Math.max(0, next.communitySupport + next.economy.communityDelta);
  next.relationship.coachTrust = Math.max(0, next.relationship.coachTrust + next.economy.trustDelta);
  next.governance = applyGovernanceEffect(next.governance, {
    shenInfluence: next.economy.shenInfluenceDelta
  });
  next.money = next.economy.cash;
  next.management.shortfallPending = false;
  appendManagementJournal(next, 'shortfall', route === 'shen'
    ? '沈峤补上了现金缺口，也在债权文件上多了一行名字。'
    : route === 'community'
      ? '社区先替球场垫上了缺口，但大家会记得这次求助。'
      : '一项支出被延后了，场上的人也知道自己的钱晚到了。');
  return next;
}

export function startWeeklyMatch(state) {
  if (state.dayIndex !== 9 || state.phase !== 'morning' || getRequiredAction(state.dayIndex) !== 'play-match') {
    return addJournal(state, 'quiet', '比赛还没有到开场的时候。');
  }
  if (state.management.match) return state;
  if (!state.management.opponentId) return addJournal(state, 'quiet', '还没有确认今天的客队。');
  const opponent = getOpponent(state.management.opponentId);
  const next = copyState(state);
  next.management.match = createMatch({
    opponentDifficulty: opponent.difficulty,
    attack: next.roster.attack,
    defense: next.roster.defense,
    cohesion: next.roster.cohesion,
    facilityBonus: next.facilities.performanceBonus
  });
  next.minute = 900;
  appendManagementJournal(next, 'match', `海风球场对阵${opponent.name}，第一声哨响了。`);
  return next;
}

export function chooseMatchHighlight(state, choiceId) {
  if (!state.management?.match || state.management.match.complete) return state;
  const next = copyState(state);
  next.management.match = resolveHighlight(next.management.match, choiceId);
  next.minute += 22;
  if (next.management.match.complete) {
    const result = finishMatch(next.management.match);
    next.management.matchResult = result;
    next.roster.cohesion = Math.max(0, Math.min(100, next.roster.cohesion + result.cohesionDelta));
    next.communitySupport = Math.max(0, Math.min(100, next.communitySupport + (result.outcome === 'win' ? 4 : result.outcome === 'draw' ? 2 : 1)));
    recordManagementAction(next, 'play-match', 'complete');
    appendManagementJournal(next, 'match', `终场比分是${result.score.home}比${result.score.away}。看台没有立刻散去。`);
  }
  return next;
}

function settleManagementWeek(state) {
  const next = copyState(state);
  const opponent = getOpponent(next.management.opponentId);
  const market = MARKET_PLANS[next.management.marketPlan];
  const welcome = WELCOME_PLANS[next.management.welcomePlan];
  const result = next.management.matchResult;
  const audience = opponent.expectedAudience
    + next.facilities.audienceBonus
    + market.audience
    + welcome.audience;
  const resultBonus = result.outcome === 'win' ? 20 : result.outcome === 'draw' ? 10 : 0;
  const revenue = Math.round(audience * 0.6) + market.revenue + resultBonus;
  const cashBefore = next.economy.cash;
  next.economy = postLedgerEntry(next.economy, {
    id: 'week-one-match-income',
    label: '主场周赛收入',
    amount: revenue
  });
  if (next.communitySupport >= 58 && result.outcome !== 'loss') {
    next.governance = applyGovernanceEffect(next.governance, { support: 1 });
  }
  next.money = next.economy.cash;
  next.management.settlement = {
    audience,
    revenue,
    cashBefore,
    cashAfter: next.economy.cash,
    outcome: result.outcome,
    score: { ...result.score },
    metrics: {
      cash: next.economy.cash,
      facility: next.facilities.condition,
      cohesion: next.roster.cohesion,
      community: next.communitySupport,
      governance: next.governance.support
    }
  };
  next.management.weekComplete = true;
  next.campaign.week = 1;
  return next;
}

export function finishManagementDay(state) {
  if (!isManagementWeekDay(state.dayIndex) || state.phase !== 'morning') return state;
  const requiredAction = getRequiredAction(state.dayIndex);
  if (!state.management.completedActions.includes(requiredAction)) {
    return addJournal(state, 'quiet', '今天最重要的决定还没有完成。');
  }
  if (state.management.shortfallPending) {
    return addJournal(state, 'quiet', '先决定怎么补上账本里的现金缺口。');
  }
  let next = copyState(state);
  next.phase = 'complete';
  next.minute = 1100;
  if (next.dayIndex === 9) next = settleManagementWeek(next);
  return next;
}

export function advanceCampaignDay(state) {
  if (!isManagementWeekDay(state.dayIndex) || state.phase !== 'complete' || state.dayIndex >= 9) return state;
  const next = copyState(state);
  next.dayIndex += 1;
  next.phase = 'morning';
  next.minute = 550;
  next.energy = 100;
  const day = getCampaignDay(next.dayIndex);
  next.world.mapId = day.defaultMap;
  next.journal = [{
    kind: 'arrival',
    text: `${day.weekday}，春${day.date}日。${day.title}。`,
    minute: next.minute
  }];
  return next;
}
