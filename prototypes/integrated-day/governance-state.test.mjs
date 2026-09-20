import test from 'node:test';
import assert from 'node:assert/strict';
import { createGovernance, applyGovernanceEffect } from './governance-state.js';

test('governance starts with one point of support and Shen influence', () => {
  assert.deepEqual(createGovernance(), { support: 1, shenInfluence: 1 });
});

test('effects move both axes', () => {
  const moved = applyGovernanceEffect(createGovernance(), { support: 2, shenInfluence: 1 });
  assert.equal(moved.support, 3);
  assert.equal(moved.shenInfluence, 2);
});

test('negative effects and missing fields stay safe', () => {
  const drained = applyGovernanceEffect(createGovernance(), { support: -3, shenInfluence: -2 });
  assert.equal(drained.support, 0);
  assert.equal(drained.shenInfluence, 0);
  assert.deepEqual(applyGovernanceEffect(createGovernance()), { support: 1, shenInfluence: 1 });
});

test('both axes are clamped between zero and five', () => {
  assert.deepEqual(applyGovernanceEffect(createGovernance(), { support: 99, shenInfluence: 99 }), { support: 5, shenInfluence: 5 });
  assert.deepEqual(applyGovernanceEffect({ support: 4, shenInfluence: 4 }, { support: 1, shenInfluence: 1 }), { support: 5, shenInfluence: 5 });
});
