export const NAMING_EPISODE_ID = 'naming-rights';

export const NAMING_DAYS = Object.freeze([
  Object.freeze({ dayIndex: 10, sceneId: 'blue-banner', requiredAction: 'naming-proposal', freeAction: false }),
  Object.freeze({ dayIndex: 11, sceneId: 'five-conditions', requiredAction: 'naming-chairs', freeAction: true }),
  Object.freeze({ dayIndex: 12, sceneId: 'another-way', requiredAction: 'naming-alternative', freeAction: true }),
  Object.freeze({ dayIndex: 13, sceneId: 'scratched-name', requiredAction: 'naming-plaque', freeAction: true }),
  Object.freeze({ dayIndex: 14, sceneId: 'first-vote', requiredAction: 'naming-vote', freeAction: false }),
  Object.freeze({ dayIndex: 15, sceneId: 'half-photo', requiredAction: 'naming-response', freeAction: true }),
  Object.freeze({ dayIndex: 16, sceneId: 'under-the-sign', requiredAction: 'naming-match', freeAction: false })
]);

export const NAMING_SCENES = Object.freeze({
  'blue-banner': Object.freeze({
    id: 'blue-banner',
    speaker: '许姨',
    portraitId: 'aunt-xu',
    propId: 'covered-sign',
    kicker: '春 22 日，球场门口',
    beats: Object.freeze([
      '一块比旧招牌大得多的蓝布挂了上去。',
      '海风球场只剩最后一个“风”字露在外面。',
      '沈峤说，这笔钱能让所有人的工资准时到账。'
    ]),
    choices: Object.freeze([
      Object.freeze({ id: 'hold-public-vote', label: '周五以前，谁都不能签字', detail: '先让五把椅子听完这份协议' })
    ])
  }),
  'five-conditions': Object.freeze({
    id: 'five-conditions',
    speaker: '罗馆长',
    portraitId: 'luo',
    propId: 'ballots',
    kicker: '春 23 日，五把椅子',
    beats: Object.freeze([
      '教练要工资，队员要训练，小店要生计。',
      '社区要留下名字，你要让账面活过这个月。',
      '今天不急着表态，先把每个人的条件写下来。'
    ]),
    choices: Object.freeze([
      Object.freeze({ id: 'write-conditions', label: '把五种条件贴在墙上', detail: '从今天起，每天还能认真做一件事' })
    ])
  }),
  'another-way': Object.freeze({
    id: 'another-way',
    speaker: '安若童',
    portraitId: 'an',
    propId: 'rescue-box',
    kicker: '春 24 日，场边小店',
    beats: Object.freeze([
      '救命钱不一定只来自一张支票。',
      '但小店、训练、修缮和社区开放，都要有人亲手去做。',
      '今天只能选一件。'
    ]),
    choices: Object.freeze([
      Object.freeze({ id: 'open-free-time', label: '看看今天能做什么', detail: '结果会成为周五表决的筹码' })
    ])
  }),
  'scratched-name': Object.freeze({
    id: 'scratched-name',
    speaker: '郭教练',
    portraitId: 'guo',
    propId: 'plaque',
    kicker: '春 25 日，旧仓库',
    beats: Object.freeze([
      '铭牌上原本有两个创办人的名字。',
      '沈峤那一行被刮掉了，当年我没有拦。',
      '他确实被不公平地赶出了这段历史。'
    ]),
    choices: Object.freeze([
      Object.freeze({ id: 'acknowledge-history', label: '先承认这件事是错的', detail: '承认过去，不等于交出现在' })
    ])
  }),
  'first-vote': Object.freeze({
    id: 'first-vote',
    speaker: '沈峤',
    portraitId: 'shen',
    propId: 'contract',
    kicker: '春 26 日，公开表决',
    beats: Object.freeze([
      '我带来的钱是真的，合同里的条件也是真的。',
      '你们可以拒绝，但别再假装这个球场从来不欠我。',
      '现在，请把你们的办法放到桌上。'
    ]),
    choices: Object.freeze([])
  }),
  'half-photo': Object.freeze({
    id: 'half-photo',
    speaker: '沈峤',
    portraitId: 'shen',
    propId: 'half-photo',
    kicker: '春 27 日，记者到场以后',
    beats: Object.freeze([
      '这张合照被裁掉了一半，剩下的人后来都成了英雄。',
      '如果你们承认当年伤害过我，就别只在需要钱时才想起我。',
      '安若童，你准备怎么把我的名字还回来？'
    ]),
    choices: Object.freeze([])
  }),
  'under-the-sign': Object.freeze({
    id: 'under-the-sign',
    speaker: '许小满',
    portraitId: 'xiaoman',
    propId: 'covered-sign',
    kicker: '春 28 日，开场前',
    beats: Object.freeze([
      '港口工人队已经到了，蓝布还盖在招牌上。',
      '今天不管谁赢，终场以后都得把它揭开。',
      '至少让所有人看清楚，我们替什么名字踢球。'
    ]),
    choices: Object.freeze([
      Object.freeze({ id: 'start-naming-match', label: '走到招牌下', detail: '海风正从看台一侧吹过来' })
    ])
  })
});

export const FREE_ACTIONS = Object.freeze({
  shop: Object.freeze({
    id: 'shop', label: '去场边小店', place: '小店', owner: '许姨',
    fund: 22, community: 1, cohesion: 0, facility: 0, signatures: 2, evidence: 0,
    resultCopy: '最后一杯果子水卖完，许姨把今天的零钱倒进写着“海风自救”的铁盒。',
    repeatCopy: '又忙了一天以后，熟客还是来了，只是能多筹到的钱已经少了一些。',
    steps: Object.freeze(['给跑完步的孩子递水', '把两份热食送到看台', '把找零放进自救箱'])
  }),
  training: Object.freeze({
    id: 'training', label: '陪球队训练', place: '中圈', owner: '郭教练',
    fund: 0, community: 0, cohesion: 4, facility: 0, signatures: 0, evidence: 0,
    resultCopy: '最后一次传球没有人抢着表现。先接到球的人回头等了一下身后的队友。',
    repeatCopy: '第二次做同样的练习，队员已经熟悉节奏，新的变化没有第一次明显。',
    steps: Object.freeze(['把球传给空位的人', '失误以后再要一次球', '让替补完成最后一脚'])
  }),
  repair: Object.freeze({
    id: 'repair', label: '修一处球场', place: '灯架', owner: '林川',
    fund: 0, community: 1, cohesion: 0, facility: 5, signatures: 1, evidence: 0,
    resultCopy: '松动的灯架、看台木板和招牌绳结都被重新固定，风再大也不会突然掉下来。',
    repeatCopy: '能看见的隐患少了，剩下的修补更费时间，今天只处理完最急的一处。',
    steps: Object.freeze(['拧紧灯架底座', '换掉开裂的木板', '重新系好招牌绳结'])
  }),
  community: Object.freeze({
    id: 'community', label: '开放社区时段', place: '入口', owner: '巧巧',
    fund: 8, community: 5, cohesion: 1, facility: 0, signatures: 8, evidence: 0,
    resultCopy: '孩子、摊主和邻居把名字写满一张纸。他们说，球场属于每天真正走进来的人。',
    repeatCopy: '第二次开放时来的大多是熟面孔，签名增长慢了，但留下的人更愿意帮忙。',
    steps: Object.freeze(['给孩子留半块场地', '让摊主使用入口电源', '请邻居写下为什么来这里'])
  }),
  archive: Object.freeze({
    id: 'archive', label: '整理旧照片', place: '旧仓库', owner: '罗馆长',
    fund: 0, community: 2, cohesion: 0, facility: 0, signatures: 0, evidence: 1,
    resultCopy: '照片、章程和旧报纸排在一起，沈峤作为共同创办人的名字终于有了完整证据。',
    repeatCopy: '剩下的资料大多重复，但一封旧信补上了当年没有人愿意说清楚的细节。',
    steps: Object.freeze(['按年份排好旧照片', '对照第一份章程', '把被裁掉的合照拼回去'])
  }),
  rest: Object.freeze({
    id: 'rest', label: '今天早点回去', place: '宿舍', owner: '安若童',
    fund: 0, community: 0, cohesion: 0, facility: 0, signatures: 0, evidence: 0,
    resultCopy: '安若童在海声里睡了一觉。病后的身体没有立刻变好，但她不再把休息当成亏欠。',
    repeatCopy: '她又留出一个晚上休息。第二天醒来时，胸口那阵熟悉的紧绷轻了一点。',
    steps: Object.freeze([])
  })
});

export const VOTE_ROUTES = Object.freeze({
  'co-name': Object.freeze({
    id: 'co-name',
    label: '接受联合冠名',
    detail: '补上工资和灯光费用，赞助方获得一个否决席位',
    stadiumName: '澜岸·海风球场',
    authority: '赞助方获得一个运营否决席位',
    cash: 120,
    shenInfluence: 2
  }),
  'community-save': Object.freeze({
    id: 'community-save',
    label: '用社区自救保住名字',
    detail: '需要至少 45 元自救金和 10 个签名',
    stadiumName: '海风球场',
    authority: '五把椅子保留最终决定权',
    cash: 0,
    shenInfluence: -1,
    requires: Object.freeze({ fund: 45, signatures: 10 })
  }),
  delay: Object.freeze({
    id: 'delay',
    label: '延期签约，比赛改到白天',
    detail: '保住名字，但少一场夜场收入，也没有解决下个月',
    stadiumName: '海风球场',
    authority: '临时委员会只保住了本周',
    cash: -18,
    shenInfluence: 0
  })
});

export const REVEAL_RESPONSES = Object.freeze({
  'restore-history': Object.freeze({
    id: 'restore-history',
    label: '恢复他的创办人身份',
    detail: '把名字刻回铭牌，但不把历史补偿写成今天的控制权',
    shenPosition: 'stays-outside',
    requiresEvidence: false
  }),
  'name-as-repair': Object.freeze({
    id: 'name-as-repair',
    label: '把联合冠名当作补偿',
    detail: '承认过去的伤害，也接受他今天提出的权力条件',
    shenPosition: 'takes-seat',
    requiresEvidence: false
  }),
  'after-match': Object.freeze({
    id: 'after-match',
    label: '把争议留到赛后',
    detail: '先避免球队在开场前继续分裂',
    shenPosition: 'withdraws-banner',
    requiresEvidence: false
  })
});

export function getNamingDay(dayIndex) {
  const day = NAMING_DAYS.find(entry => entry.dayIndex === dayIndex);
  if (!day) throw new TypeError('Unknown naming day');
  return day;
}

export function getNamingScene(sceneId) {
  const scene = NAMING_SCENES[sceneId];
  if (!scene) throw new TypeError('Unknown naming scene');
  return scene;
}

export function getFreeAction(actionId) {
  const action = FREE_ACTIONS[actionId];
  if (!action) throw new TypeError('Unknown free action');
  return action;
}
