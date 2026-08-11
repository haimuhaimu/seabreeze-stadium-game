export const HIGHLIGHTS = Object.freeze([
  Object.freeze({
    id: 'opening',
    minute: 18,
    title: '小满第一次把球停远了',
    copy: '对手已经靠近。他下意识看向了场边。',
    choices: Object.freeze([
      Object.freeze({ id: 'repeat-practice', label: '做我们练过的事', requires: 'train', detail: '提醒小满，你们已经一起做过这件事' }),
      Object.freeze({ id: 'steady-everyone', label: '先让大家站稳', detail: '不把这次失误只留给一个人' })
    ])
  }),
  Object.freeze({
    id: 'middle',
    minute: 56,
    title: '小满连续被对手针对',
    copy: '替补席看着郭教练，场上的小满没有举手。',
    choices: Object.freeze([
      Object.freeze({ id: 'lin-protects', label: '请林川站到他身边', detail: '让队长分担他正在承受的压力' }),
      Object.freeze({ id: 'replace-xiaoman', label: '现在把他换下来', detail: '停止压力，也可能让他觉得自己再次被放弃' }),
      Object.freeze({ id: 'ask-xiaoman', label: '先问小满要不要继续', detail: '把是否继续的决定交还给他' })
    ])
  }),
  Object.freeze({
    id: 'closing',
    minute: 82,
    title: '终场前还有最后一次机会',
    copy: '没有人能保证下一次触球会发生什么。',
    choices: Object.freeze([
      Object.freeze({ id: 'trust-once-more', label: '再相信他一次', detail: '把最后一次机会交给小满' }),
      Object.freeze({ id: 'share-responsibility', label: '让大家一起承担', detail: '不让结果只落在一个人身上' }),
      Object.freeze({ id: 'keep-result', label: '先守住现在的结果', detail: '结束冒险，保住大家已经做到的事' })
    ])
  })
]);

const EFFECTS = Object.freeze({
  'repeat-practice': Object.freeze({ home: 1, away: 0, momentum: 1 }),
  'steady-everyone': Object.freeze({ home: 0, away: 0, momentum: 0 }),
  'lin-protects': Object.freeze({ home: 0, away: 0, momentum: 1 }),
  'replace-xiaoman': Object.freeze({ home: 0, away: 0, momentum: -1 }),
  'ask-xiaoman': Object.freeze({ home: 0, away: 0, momentum: 1 }),
  'trust-once-more': Object.freeze({ home: 1, away: 1, momentum: 0 }),
  'share-responsibility': Object.freeze({ home: 1, away: 0, momentum: 1 }),
  'keep-result': Object.freeze({ home: 0, away: 0, momentum: 0 })
});

function teamStrength({ attack, defense, cohesion, facilityBonus }) {
  return Math.round((attack + defense) / 2 + (cohesion - 46) * 0.25 + facilityBonus);
}

export function createMatch(input) {
  const values = [input?.opponentDifficulty, input?.attack, input?.defense, input?.cohesion, input?.facilityBonus];
  if (!values.every(Number.isFinite)) throw new TypeError('Invalid match input');
  const strength = teamStrength(input);
  return {
    opponentDifficulty: input.opponentDifficulty,
    teamStrength: strength,
    highlightIndex: 0,
    homeGoals: strength - input.opponentDifficulty >= 10 ? 1 : 0,
    awayGoals: input.opponentDifficulty - strength >= 10 ? 1 : 0,
    momentum: 0,
    choices: [],
    complete: false
  };
}

export function getAvailableHighlights(match, episode = null) {
  if (!match || match.highlightIndex >= HIGHLIGHTS.length) return null;
  const highlight = HIGHLIGHTS[match.highlightIndex];
  const completed = episode?.promisesCompleted ?? [];
  return {
    ...highlight,
    choices: highlight.choices.filter(choice => !choice.requires || completed.includes(choice.requires))
  };
}

export function resolveHighlight(match, choiceId, episode = null) {
  if (match.complete || match.highlightIndex >= HIGHLIGHTS.length) return match;
  const highlight = getAvailableHighlights(match, episode);
  if (!highlight.choices.some(choice => choice.id === choiceId)) throw new TypeError('Invalid highlight choice');
  const effect = EFFECTS[choiceId];
  const highlightIndex = match.highlightIndex + 1;
  return {
    ...match,
    highlightIndex,
    homeGoals: match.homeGoals + effect.home,
    awayGoals: match.awayGoals + effect.away,
    momentum: match.momentum + effect.momentum,
    choices: [...match.choices, choiceId],
    complete: highlightIndex === HIGHLIGHTS.length
  };
}

export function finishMatch(match) {
  if (!match.complete || match.highlightIndex !== HIGHLIGHTS.length) {
    throw new Error('Match needs three highlights before settlement');
  }
  const score = { home: match.homeGoals, away: match.awayGoals };
  const outcome = score.home > score.away ? 'win' : score.home < score.away ? 'loss' : 'draw';
  return {
    complete: true,
    score,
    outcome,
    cohesionDelta: match.momentum >= 2 ? 3 : match.momentum >= 0 ? 1 : -1,
    crowdMood: outcome === 'win' ? '沸腾' : outcome === 'draw' ? '意犹未尽' : '仍然鼓掌'
  };
}
