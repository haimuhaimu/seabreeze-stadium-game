function preparation(id, label, copy, callbackLabel) {
  return Object.freeze({ id, label, copy, callbackLabel });
}

function choice(id, label, copy, callback, effect = {}) {
  return Object.freeze({ id, label, copy, callback, effect: Object.freeze({ ...effect }) });
}

function moment(id, minute, title, copy, choices) {
  return Object.freeze({ id, minute, title, copy, choices: Object.freeze(choices) });
}

export const ELITE_OPPONENT = Object.freeze({
  id: 'heling-academy',
  name: '鹤岭青训联队',
  shortName: '鹤岭',
  copy: '他们有完整的青训体系、随队理疗和固定客场预算。海风队带来的是一座刚刚学会共同作决定的球场。'
});

export const ELITE_PREPARATIONS = Object.freeze({
  'shared-plan': preparation(
    'shared-plan',
    '六个人共写比赛计划',
    '不把分歧藏起来。教练、队长、年轻球员、小店、投资方和评审各写下一条底线。',
    '最后十分钟，所有人知道该按哪张纸行动'
  ),
  'repair-buffer': preparation(
    'repair-buffer',
    '留出临场维修预案',
    '把入口、灯光、急救点和备用工具重新走一遍，先写清楚出问题时谁去处理。',
    '临场故障不会让整支队停在原地'
  ),
  'open-gates': preparation(
    'open-gates',
    '照常开放社区时段',
    '精英队来访也不取消已经约好的时段，让孩子和摊主照常走进球场。',
    '看台上的人知道自己不只是被请来鼓掌'
  )
});

export const ELITE_MOMENTS = Object.freeze([
  moment(
    'first-pass',
    '第 17 分钟',
    '第一脚怎么交出去',
    '鹤岭连续压上，海风队第一次拿稳球。场边有人喊着快一点，但队员都在等一个熟悉的次序。',
    [
      choice('use-league-shape', '照联赛里练过的次序出球', '七轮联赛留下的站位会回应这次选择。', 'ranking', { home: 1 }),
      choice('rush-the-middle', '让一个人带球冲过中路', '把压力交给此刻最有胆量的人。', null),
      choice('clear-it-away', '先把球踢出边线', '先让所有人喘一口气，再重新站好。', null)
    ]
  ),
  moment(
    'stand-check',
    '第 54 分钟',
    '看台入口临时复检',
    '检查员临时封住一段入口，替补席和看台同时乱了。鹤岭正在利用这几分钟继续压上。',
    [
      choice('open-built-route', '打开已经修好的分流通道', '六级以上的长期建设会让人群从另一条安全路线进入。', 'construction', { away: -1 }),
      choice('close-the-stand', '直接关闭整片看台', '最稳妥，但所有观众都要离开原来的位置。', null),
      choice('ask-for-delay', '请求比赛暂停十分钟', '把处理时间交给裁判和检查员。', null)
    ]
  ),
  moment(
    'last-decision',
    '第 82 分钟',
    '最后十分钟由谁拍板',
    '比分仍有机会改变。场边同时传来三种声音，只有赛前真正准备过的那一种能让大家立刻行动。',
    [
      choice('follow-shared-plan', '按六个人共写的计划执行', '让写在同一张纸上的分工接管最后十分钟。', 'preparation:shared-plan', { home: 1 }),
      choice('use-repair-buffer', '启动临场维修预案', '让负责工具、入口和替补的人各回到提前写好的位置。', 'preparation:repair-buffer', { home: 1 }),
      choice('call-open-gates', '让社区看台带队员一起喊节奏', '把照常进场的人变成最后十分钟的共同信号。', 'preparation:open-gates', { home: 1 })
    ]
  )
]);

export const ELITE_RESULTS = Object.freeze({
  champion: Object.freeze({
    id: 'champion',
    label: '击败精英队',
    copy: '终场哨响以后，鹤岭没有立刻离开。他们把下一次正式邀请写进了海风球场的记录。',
    effects: Object.freeze({ cash: 160, cohesion: 4, community: 8 })
  }),
  recognized: Object.freeze({
    id: 'recognized',
    label: '让精英队记住海风',
    copy: '比分没有分出高下，但鹤岭的教练在离场前问起了下一赛季的日期。',
    effects: Object.freeze({ cash: 90, cohesion: 2, community: 4 })
  }),
  attended: Object.freeze({
    id: 'attended',
    label: '第一次精英赛结束',
    copy: '海风队输掉了第一次精英赛，却把差距写成了下一赛季可以继续完成的事情。',
    effects: Object.freeze({ cash: 50, cohesion: 1, community: 2 })
  })
});

export function getElitePreparation(id) {
  const value = ELITE_PREPARATIONS[id];
  if (!value) throw new TypeError('Unknown elite preparation');
  return value;
}
