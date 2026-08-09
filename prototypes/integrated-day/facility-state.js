const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const FACILITY_PLANS = Object.freeze({
  floodlights: Object.freeze({ label: '检修灯光', cost: 30, condition: 8, audience: 18, performance: 0 }),
  stands: Object.freeze({ label: '加固看台', cost: 18, condition: 5, audience: 10, performance: 0 }),
  grass: Object.freeze({ label: '补平草皮', cost: 24, condition: 7, audience: 0, performance: 4 })
});

export function createFacilities() {
  return { condition: 48, prepared: null, audienceBonus: 0, performanceBonus: 0 };
}

export function prepareFacility(facilities, planId) {
  const plan = FACILITY_PLANS[planId];
  if (!plan) throw new TypeError('Invalid facility plan');
  return {
    ...facilities,
    prepared: planId,
    condition: clamp(facilities.condition + plan.condition, 0, 100),
    audienceBonus: facilities.audienceBonus + plan.audience,
    performanceBonus: facilities.performanceBonus + plan.performance
  };
}
