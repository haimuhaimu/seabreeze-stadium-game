import test from 'node:test';
import assert from 'node:assert/strict';
import { createEconomy, postLedgerEntry, resolveShortfall } from './economy-state.js';
import { createFacilities, prepareFacility } from './facility-state.js';
import { createGovernance, applyGovernanceEffect } from './governance-state.js';
import { OPPONENTS, getOpponent } from './opponent-content.js';

test('ledger records signed income and expense entries', () => {
  let economy = createEconomy(40);
  economy = postLedgerEntry(economy, { id: 'deposit', label: '社区预约金', amount: 120 });
  economy = postLedgerEntry(economy, { id: 'wages', label: '本周工资', amount: -70 });
  assert.equal(economy.cash, 90);
  assert.deepEqual(economy.entries.map(entry => entry.id), ['deposit', 'wages']);
});

test('negative cash offers three recoverable shortfall routes', () => {
  const economy = postLedgerEntry(createEconomy(10), { id: 'bill', label: '维护', amount: -40 });
  assert.equal(resolveShortfall(economy, 'delay').cash, 0);
  assert.equal(resolveShortfall(economy, 'community').communityDelta, -6);
  assert.equal(resolveShortfall(economy, 'shen').shenInfluenceDelta, 1);
});

test('opponents create different cost audience and difficulty profiles', () => {
  assert.deepEqual(Object.keys(OPPONENTS), ['harbor-workers', 'city-university']);
  assert.ok(getOpponent('harbor-workers').cost < getOpponent('city-university').cost);
  assert.ok(getOpponent('harbor-workers').difficulty < getOpponent('city-university').difficulty);
  assert.ok(getOpponent('city-university').expectedAudience > getOpponent('harbor-workers').expectedAudience);
});

test('facility and governance effects are clamped', () => {
  assert.equal(prepareFacility(createFacilities(), 'floodlights').condition, 56);
  assert.equal(applyGovernanceEffect(createGovernance(), { support: 9, shenInfluence: 2 }).support, 5);
});
