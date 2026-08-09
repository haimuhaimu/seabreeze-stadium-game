export function createEconomy(cash = 0) {
  if (!Number.isFinite(cash)) throw new TypeError('Invalid opening cash');
  return { cash, entries: [], shortfall: null };
}

export function postLedgerEntry(economy, entry) {
  if (!entry?.id || !entry?.label || !Number.isFinite(entry.amount)) {
    throw new TypeError('Invalid ledger entry');
  }
  if (economy.entries.some(item => item.id === entry.id)) return economy;
  return {
    ...economy,
    cash: economy.cash + entry.amount,
    entries: [...economy.entries, { ...entry }]
  };
}

export function resolveShortfall(economy, route) {
  if (economy.cash >= 0) {
    return { ...economy, communityDelta: 0, trustDelta: 0, shenInfluenceDelta: 0 };
  }

  const debt = Math.abs(economy.cash);
  const effects = {
    delay: { communityDelta: 0, trustDelta: -1, shenInfluenceDelta: 0 },
    community: { communityDelta: -6, trustDelta: 0, shenInfluenceDelta: 0 },
    shen: { communityDelta: 0, trustDelta: 0, shenInfluenceDelta: 1 }
  };
  if (!effects[route]) throw new TypeError('Invalid shortfall route');
  return {
    ...economy,
    cash: 0,
    shortfall: { route, amount: debt },
    ...effects[route]
  };
}
