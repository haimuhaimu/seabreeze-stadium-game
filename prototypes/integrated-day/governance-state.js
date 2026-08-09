const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createGovernance() {
  return { support: 1, shenInfluence: 1 };
}

export function applyGovernanceEffect(state, effect = {}) {
  return {
    support: clamp(state.support + (effect.support || 0), 0, 5),
    shenInfluence: clamp(state.shenInfluence + (effect.shenInfluence || 0), 0, 5)
  };
}
