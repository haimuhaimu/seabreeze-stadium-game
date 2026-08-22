const entries = [
  ['周五', 12, '抵达', null, 'training'],
  ['周六', 13, '一起训练', null, 'training'],
  ['周日', 14, '友谊赛日', null, 'training'],
  ['周一', 15, '空白通知', 'episode-notice', 'stadium'],
  ['周二', 16, '门外的七号', 'episode-promises', 'training'],
  ['周三', 17, '只来得及两件事', 'episode-promise', 'training'],
  ['周四', 18, '第二个承诺', 'episode-promise', 'training'],
  ['周五', 19, '灯亮以前', 'episode-funding', 'stadium'],
  ['周六', 20, '沈峤的旧球员证', 'episode-offer', 'stadium'],
  ['周日', 21, '比赛与五把椅子', 'episode-match', 'stadium'],
  ['周一', 22, '蓝布盖住了旧名字', 'naming-proposal', 'stadium'],
  ['周二', 23, '五把椅子，五种条件', 'naming-chairs', 'stadium'],
  ['周三', 24, '救命钱不是唯一的钱', 'naming-alternative', 'stadium'],
  ['周四', 25, '被刮掉的名字', 'naming-plaque', 'stadium'],
  ['周五', 26, '第一次真正表决', 'naming-vote', 'stadium'],
  ['周六', 27, '沈峤的半张合照', 'naming-response', 'stadium'],
  ['周日', 28, '招牌下的比赛', 'naming-match', 'stadium']
];

export const CAMPAIGN_DAYS = Object.freeze(entries.map((entry, dayIndex) => Object.freeze({
  dayIndex,
  season: '春',
  weekday: entry[0],
  date: entry[1],
  title: entry[2],
  requiredAction: entry[3],
  defaultMap: entry[4],
  weather: dayIndex === 16
    ? '云散得很快，海风正大'
    : dayIndex === 13
      ? '潮气很重，午后有雨'
      : dayIndex === 9
        ? '晴，傍晚有海风'
        : dayIndex === 5
          ? '云薄，风很轻'
          : '海风转晴'
})));

export function getCampaignDay(dayIndex) {
  const index = Math.max(0, Math.min(CAMPAIGN_DAYS.length - 1, Math.trunc(Number(dayIndex) || 0)));
  return CAMPAIGN_DAYS[index];
}

export const getRequiredAction = dayIndex => getCampaignDay(dayIndex).requiredAction;
export const isPrologueDay = dayIndex => dayIndex >= 0 && dayIndex <= 2;
export const isManagementWeekDay = dayIndex => dayIndex >= 3 && dayIndex <= 9;
export const isNamingRightsWeekDay = dayIndex => dayIndex >= 10 && dayIndex <= 16;
export const isCampaignDay = dayIndex => isManagementWeekDay(dayIndex) || isNamingRightsWeekDay(dayIndex);
