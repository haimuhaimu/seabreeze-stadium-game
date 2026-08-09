const RECIPE_COSTS = Object.freeze({
  tea: Object.freeze({ tea: 1, water: 1 }),
  fruit: Object.freeze({ fruit: 1, water: 1 }),
  towel: Object.freeze({ cloth: 1 })
});

function freezeDay(day) {
  return Object.freeze({
    ...day,
    orders: Object.freeze(day.orders.map(order => Object.freeze({ ...order })))
  });
}

export const DAYS = Object.freeze([
  freezeDay({
    season: '春',
    date: 12,
    weather: '海风转晴',
    title: '抵达',
    trainingAvailable: false,
    orders: [
      { customer: '林川', recipe: 'tea', item: '青草茶', price: 9 },
      { customer: '许姨', recipe: 'towel', item: '干净毛巾', price: 8 },
      { customer: '乔可', recipe: 'fruit', item: '果子水', price: 12 },
      { customer: '邓叔', recipe: 'tea', item: '青草茶', price: 9 }
    ]
  }),
  freezeDay({
    season: '春',
    date: 13,
    weather: '风大有云',
    title: '一起训练',
    trainingAvailable: true,
    orders: [
      { customer: '乔可', recipe: 'fruit', item: '果子水', price: 12 },
      { customer: '林川', recipe: 'tea', item: '青草茶', price: 9 },
      { customer: '许姨', recipe: 'towel', item: '干净毛巾', price: 8 },
      { customer: '小满', recipe: 'fruit', item: '果子水', price: 12 }
    ]
  }),
  freezeDay({
    season: '春',
    date: 14,
    weather: '晴，午后海风',
    title: '友谊赛日',
    trainingAvailable: true,
    orders: [
      { customer: '林川', recipe: 'tea', item: '青草茶', price: 9 },
      { customer: '乔可', recipe: 'fruit', item: '果子水', price: 12 },
      { customer: '许姨', recipe: 'towel', item: '干净毛巾', price: 8 },
      { customer: '小满', recipe: 'fruit', item: '果子水', price: 12 },
      { customer: '郭教练', recipe: 'tea', item: '青草茶', price: 9 }
    ]
  })
]);

export function getDayContent(dayIndex) {
  const numericIndex = Number.isFinite(dayIndex) ? Math.trunc(dayIndex) : 0;
  return DAYS[Math.max(0, Math.min(DAYS.length - 1, numericIndex))];
}

export function getOrders(dayIndex) {
  return getDayContent(dayIndex).orders;
}

export function requiredInventoryForDay(dayIndex) {
  const required = { tea: 0, fruit: 0, cloth: 0, water: 0 };

  for (const order of getOrders(dayIndex)) {
    for (const [key, amount] of Object.entries(RECIPE_COSTS[order.recipe])) {
      required[key] += amount;
    }
  }

  return required;
}
