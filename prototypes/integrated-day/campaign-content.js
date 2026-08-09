const entries = [
  ['周五', 12, '抵达', null, 'training'],
  ['周六', 13, '一起训练', null, 'training'],
  ['周日', 14, '友谊赛日', null, 'training'],
  ['周一', 15, '账本上的缺口', 'review-ledger', 'stadium'],
  ['周二', 16, '谁能上场', 'choose-training', 'training'],
  ['周三', 17, '邀请谁来', 'choose-opponent', 'stadium'],
  ['周四', 18, '看台之外', 'choose-market', 'training'],
  ['周五', 19, '比赛前夜', 'prepare-facility', 'stadium'],
  ['周六', 20, '客队抵达', 'welcome-opponent', 'stadium'],
  ['周日', 21, '第一场主场周赛', 'play-match', 'stadium']
];

export const CAMPAIGN_DAYS = Object.freeze(entries.map((entry, dayIndex) => Object.freeze({
  dayIndex,
  season: '春',
  weekday: entry[0],
  date: entry[1],
  title: entry[2],
  requiredAction: entry[3],
  defaultMap: entry[4],
  weather: dayIndex === 9 ? '晴，傍晚有海风' : dayIndex === 5 ? '云薄，风很轻' : '海风转晴'
})));

export function getCampaignDay(dayIndex) {
  const index = Math.max(0, Math.min(CAMPAIGN_DAYS.length - 1, Math.trunc(Number(dayIndex) || 0)));
  return CAMPAIGN_DAYS[index];
}

export const getRequiredAction = dayIndex => getCampaignDay(dayIndex).requiredAction;
export const isPrologueDay = dayIndex => dayIndex >= 0 && dayIndex <= 2;
export const isManagementWeekDay = dayIndex => dayIndex >= 3 && dayIndex <= 9;
