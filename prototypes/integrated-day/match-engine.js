export const HIGHLIGHTS = Object.freeze([
  Object.freeze({
    id: 'opening',
    minute: 18,
    title: '对方第一次压上来了',
    copy: '林川回撤接球，边路留下了一段空当。',
    choices: Object.freeze([
      Object.freeze({ id: 'patient-build', label: '耐心从脚下组织' }),
      Object.freeze({ id: 'direct-ball', label: '直接送到前场' })
    ])
  }),
  Object.freeze({
    id: 'middle',
    minute: 56,
    title: '小满连续被对手针对',
    copy: '替补席看着郭教练，场上的小满没有举手。',
    choices: Object.freeze([
      Object.freeze({ id: 'protect-youngster', label: '让林川靠近保护他' }),
      Object.freeze({ id: 'replace-youngster', label: '立刻换下小满' })
    ])
  }),
  Object.freeze({
    id: 'closing',
    minute: 82,
    title: '比分仍然咬得很紧',
    copy: '看台全部站了起来，海风正从客队半场吹来。',
    choices: Object.freeze([
      Object.freeze({ id: 'press-late', label: '最后压上一次' }),
      Object.freeze({ id: 'hold-shape', label: '保持站位等机会' })
    ])
  })
]);

const EFFECTS = Object.freeze({
  'patient-build': Object.freeze({ home: 1, away: 0, momentum: 1 }),
  'direct-ball': Object.freeze({ home: 0, away: 0, momentum: 0 }),
  'protect-youngster': Object.freeze({ home: 0, away: 0, momentum: 1 }),
  'replace-youngster': Object.freeze({ home: 0, away: 0, momentum: -1 }),
  'press-late': Object.freeze({ home: 1, away: 1, momentum: 0 }),
  'hold-shape': Object.freeze({ home: 0, away: 0, momentum: 0 })
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

export function resolveHighlight(match, choiceId) {
  if (match.complete || match.highlightIndex >= HIGHLIGHTS.length) return match;
  const highlight = HIGHLIGHTS[match.highlightIndex];
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
