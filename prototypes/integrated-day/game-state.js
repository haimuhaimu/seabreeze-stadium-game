import { getDayContent, getOrders, requiredInventoryForDay } from './daily-content.js';

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
    history: state.history.map(entry => ({ ...entry }))
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
    version: 1,
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
    chapterComplete: false
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
