import test from 'node:test';
import assert from 'node:assert/strict';
import { createEconomy, postLedgerEntry, resolveShortfall } from './economy-state.js';

test('an economy starts with the given cash and no ledger', () => {
  assert.deepEqual(createEconomy(120), { cash: 120, entries: [], shortfall: null });
  assert.throws(() => createEconomy(Number.NaN), /Invalid opening cash/);
});

test('a valid ledger entry updates cash and copies the entry', () => {
  const ledger = postLedgerEntry(createEconomy(50), { id: 'a', label: '小店收入', amount: 30 });
  assert.equal(ledger.cash, 80);
  assert.equal(ledger.entries[0].id, 'a');
});

test('a duplicate ledger id is ignored', () => {
  let ledger = postLedgerEntry(createEconomy(0), { id: 'a', label: '一次', amount: 20 });
  ledger = postLedgerEntry(ledger, { id: 'a', label: '重复', amount: 999 });
  assert.equal(ledger.cash, 20);
  assert.equal(ledger.entries.length, 1);
});

test('malformed ledger entries fail loudly', () => {
  assert.throws(() => postLedgerEntry(createEconomy(0), { id: 'a', label: 'x' }), /Invalid ledger entry/);
  assert.throws(() => postLedgerEntry(createEconomy(0), { id: 'a', amount: 5 }), /Invalid ledger entry/);
  assert.throws(() => postLedgerEntry(createEconomy(0), { label: 'x', amount: 5 }), /Invalid ledger entry/);
});

test('a solvent economy ignores shortfall resolution', () => {
  const result = resolveShortfall(createEconomy(40), 'shen');
  assert.equal(result.cash, 40);
  assert.equal(result.communityDelta, 0);
  assert.equal(result.shortfall, null);
});

test('each shortfall route applies its own trade-off and records the debt', () => {
  const delayed = resolveShortfall(createEconomy(-15), 'delay');
  assert.equal(delayed.cash, 0);
  assert.equal(delayed.trustDelta, -1);
  assert.deepEqual(delayed.shortfall, { route: 'delay', amount: 15 });

  const community = resolveShortfall(createEconomy(-15), 'community');
  assert.equal(community.communityDelta, -6);
  assert.equal(community.shenInfluenceDelta, 0);

  const shen = resolveShortfall(createEconomy(-15), 'shen');
  assert.equal(shen.shenInfluenceDelta, 1);
  assert.equal(shen.communityDelta, 0);
});

test('an unknown shortfall route fails loudly', () => {
  assert.throws(() => resolveShortfall(createEconomy(-1), 'missing'), /Invalid shortfall route/);
});
