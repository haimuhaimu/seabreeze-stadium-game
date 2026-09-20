import test from 'node:test';
import assert from 'node:assert/strict';
import { FACILITY_PLANS, createFacilities, prepareFacility } from './facility-state.js';

test('fresh facilities start in worn but usable shape', () => {
  const facilities = createFacilities();
  assert.equal(facilities.condition, 48);
  assert.equal(facilities.prepared, null);
  assert.equal(facilities.audienceBonus, 0);
  assert.equal(facilities.performanceBonus, 0);
});

test('each plan prepares the ground and adds its bonuses', () => {
  const prepared = prepareFacility(createFacilities(), 'grass');
  assert.equal(prepared.prepared, 'grass');
  assert.equal(prepared.condition, 55);
  assert.equal(prepared.performanceBonus, 4);
  assert.equal(prepared.audienceBonus, 0);

  const floodlights = prepareFacility(createFacilities(), 'floodlights');
  assert.equal(floodlights.condition, 56);
  assert.equal(floodlights.audienceBonus, 18);

  const stands = prepareFacility(createFacilities(), 'stands');
  assert.equal(stands.condition, 53);
  assert.equal(stands.audienceBonus, 10);
});

test('facility condition is capped at one hundred', () => {
  const strong = { condition: 98, prepared: null, audienceBonus: 0, performanceBonus: 0 };
  const prepared = prepareFacility(strong, 'floodlights');
  assert.equal(prepared.condition, 100);
});

test('an unknown facility plan fails loudly', () => {
  assert.throws(() => prepareFacility(createFacilities(), 'missing'), /Invalid facility plan/);
});

test('the three documented preparation plans are available', () => {
  assert.deepEqual(Object.keys(FACILITY_PLANS), ['floodlights', 'stands', 'grass']);
});
