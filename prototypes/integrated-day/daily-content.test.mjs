import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS,
  getDayContent,
  getOrders,
  requiredInventoryForDay
} from './daily-content.js';

test('the slice contains three distinct spring days', () => {
  assert.deepEqual(DAYS.map(day => day.date), [12, 13, 14]);
  assert.equal(new Set(DAYS.map(day => day.weather)).size, 3);
  assert.deepEqual(DAYS.map(day => day.orders.length), [4, 4, 5]);
});

test('required stock is derived from each order list', () => {
  assert.deepEqual(requiredInventoryForDay(0), { tea: 2, fruit: 1, cloth: 1, water: 3 });
  assert.deepEqual(requiredInventoryForDay(1), { tea: 1, fruit: 2, cloth: 1, water: 3 });
  assert.deepEqual(requiredInventoryForDay(2), { tea: 2, fruit: 2, cloth: 1, water: 4 });
});

test('day access is clamped to the three-day chapter', () => {
  assert.equal(getDayContent(-1).date, 12);
  assert.equal(getDayContent(99).date, 14);
  assert.equal(getOrders(1)[0].recipe, 'fruit');
});
