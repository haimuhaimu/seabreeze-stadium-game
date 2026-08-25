const freeze = value => Object.freeze(value);

export const LEAGUE_TEAMS = freeze([
  freeze({ id: 'haifeng', name: '海风队', shortName: '海风', strength: 50, color: '#c95f4d' }),
  freeze({ id: 'harbor-workers', name: '港口工人队', shortName: '港工', strength: 48, color: '#315f72' }),
  freeze({ id: 'city-university', name: '海岬大学联队', shortName: '海岬', strength: 62, color: '#455b89' }),
  freeze({ id: 'mountain-town', name: '山城联队', shortName: '山城', strength: 55, color: '#7b5d3e' }),
  freeze({ id: 'old-factory', name: '老厂竞技', shortName: '老厂', strength: 58, color: '#5b6570' }),
  freeze({ id: 'lanshore-youth', name: '澜岸青训队', shortName: '澜岸', strength: 68, color: '#226c89' }),
  freeze({ id: 'fisherfolk', name: '渔港十一人', shortName: '渔港', strength: 51, color: '#457b62' }),
  freeze({ id: 'riverside', name: '河湾社区队', shortName: '河湾', strength: 53, color: '#8b6842' })
]);

function buildRoundRobin(teamIds) {
  const rotation = [...teamIds];
  const rounds = [];
  for (let roundIndex = 0; roundIndex < teamIds.length - 1; roundIndex += 1) {
    const fixtures = [];
    for (let pairIndex = 0; pairIndex < teamIds.length / 2; pairIndex += 1) {
      const left = rotation[pairIndex];
      const right = rotation[rotation.length - 1 - pairIndex];
      const swap = (roundIndex + pairIndex) % 2 === 1;
      fixtures.push(freeze({ homeId: swap ? right : left, awayId: swap ? left : right }));
    }
    const playerFixture = fixtures.find(fixture => fixture.homeId === 'haifeng' || fixture.awayId === 'haifeng');
    rounds.push(freeze({
      round: roundIndex + 1,
      fixtures: freeze(fixtures),
      playerOpponentId: playerFixture.homeId === 'haifeng' ? playerFixture.awayId : playerFixture.homeId,
      playerHome: playerFixture.homeId === 'haifeng'
    }));
    rotation.splice(1, 0, rotation.pop());
  }
  return freeze(rounds);
}

export const SEASON_ROUNDS = buildRoundRobin(LEAGUE_TEAMS.map(team => team.id));

export const SEASON_ACTIONS = freeze({
  'train-attack': freeze({
    id: 'train-attack', label: '练前场配合', place: '主赛场中圈', tag: 'attack',
    effects: freeze({ attack: 4, defense: 0, cohesion: 1, cash: 0, community: 0, facility: 0 }),
    resultCopy: '前场三个人把最后一脚留给位置更好的人。'
  }),
  'train-defense': freeze({
    id: 'train-defense', label: '练整体站位', place: '旧训练场', tag: 'defense',
    effects: freeze({ attack: 0, defense: 4, cohesion: 1, cash: 0, community: 0, facility: 0 }),
    resultCopy: '后场开始互相提醒身后的空位，不再只等郭教练开口。'
  }),
  'youth-session': freeze({
    id: 'youth-session', label: '让年轻人合练', place: '旧训练场边线', tag: 'youth',
    effects: freeze({ attack: 2, defense: 2, cohesion: 3, cash: 0, community: 1, facility: 0 }),
    resultCopy: '小满和替补队员完成了整堂训练，没有被提前换出主力组。'
  }),
  'shop-day': freeze({
    id: 'shop-day', label: '认真开一天小店', place: '场边小店', tag: 'market',
    effects: freeze({ attack: 0, defense: 0, cohesion: 0, cash: 34, community: 1, facility: 0 }),
    resultCopy: '许姨把当天账目贴在柜台边，所有人都看得到钱从哪里来。'
  }),
  'community-open': freeze({
    id: 'community-open', label: '开放社区时段', place: '主场入口', tag: 'community',
    effects: freeze({ attack: 0, defense: 0, cohesion: 1, cash: 10, community: 5, facility: 0 }),
    resultCopy: '孩子和邻居在天黑前把场地收拾干净，也记住了下一场日期。'
  }),
  maintenance: freeze({
    id: 'maintenance', label: '巡检整座球场', place: '灯架与看台', tag: 'maintenance',
    effects: freeze({ attack: 0, defense: 1, cohesion: 0, cash: 0, community: 1, facility: 7 }),
    resultCopy: '松动的护栏、排水口和招牌绳结都在比赛前被处理了。'
  }),
  rest: freeze({
    id: 'rest', label: '今天早点休息', place: '海边长椅', tag: 'rest',
    effects: freeze({ attack: 0, defense: 0, cohesion: 0, cash: 0, community: 0, facility: 0 }),
    resultCopy: '安若童给病后的身体留出一个晚上，明天醒来时没有那么紧绷。'
  })
});

export const SEASON_PROJECTS = freeze({
  stands: freeze({
    id: 'stands', label: '加固主看台', mapId: 'stadium', domain: 'stands',
    levels: freeze([
      freeze({ cost: 42, label: '安全护栏', audience: 8, revenue: 3 }),
      freeze({ cost: 70, label: '遮雨座席', audience: 14, revenue: 6 }),
      freeze({ cost: 110, label: '家庭看台', audience: 22, revenue: 10 })
    ])
  }),
  clinic: freeze({
    id: 'clinic', label: '建设理疗室', mapId: 'stadium', domain: 'clinic',
    levels: freeze([
      freeze({ cost: 50, label: '基础急救柜', recovery: 1 }),
      freeze({ cost: 80, label: '理疗床与冰浴', recovery: 2 }),
      freeze({ cost: 120, label: '社区康复室', recovery: 3 })
    ])
  }),
  academy: freeze({
    id: 'academy', label: '扩建青训角', mapId: 'training', domain: 'academy',
    levels: freeze([
      freeze({ cost: 55, label: '青训器材架', youth: 1 }),
      freeze({ cost: 85, label: '半场训练区', youth: 2 }),
      freeze({ cost: 125, label: '社区青训班', youth: 3 })
    ])
  }),
  market: freeze({
    id: 'market', label: '扩建海风集市', mapId: 'stadium', domain: 'market',
    levels: freeze([
      freeze({ cost: 38, label: '固定电源位', revenue: 7, community: 1 }),
      freeze({ cost: 65, label: '遮雨摊位', revenue: 12, community: 2 }),
      freeze({ cost: 95, label: '周末海风集市', revenue: 18, community: 3 })
    ])
  }),
  lights: freeze({
    id: 'lights', label: '升级灯光与直播位', mapId: 'stadium', domain: 'lights',
    levels: freeze([
      freeze({ cost: 60, label: '安全夜场灯', audience: 5, publicity: 1 }),
      freeze({ cost: 90, label: '固定直播位', audience: 10, publicity: 2 }),
      freeze({ cost: 130, label: '完整夜赛系统', audience: 18, publicity: 3 })
    ])
  })
});

function npc(id, name, spriteClass, mapId, domain, copies, responseLabels) {
  return freeze({
    id, name, spriteClass, mapId, domain, copies: freeze(copies),
    responses: freeze([
      freeze({ id: 'listen', label: responseLabels[0], bond: 1, help: domain }),
      freeze({ id: 'solve', label: responseLabels[1], bond: 1, help: domain }),
      freeze({ id: 'stand', label: responseLabels[2], bond: 0, help: 'resolve' })
    ])
  });
}

export const SEASON_NPCS = freeze({
  'coach-guo': npc('coach-guo', '郭教练', 'npc-guo', 'training', 'coach', [
    '别把排名贴在每个人背上。先看这周谁还能跑，谁需要停一下。',
    '强队会逼我们先犯错。训练里说过的话，比赛时才算数。',
    '第二个赛季不是重来。上一次留下的习惯，会跟着我们。'
  ], ['先听他说完', '一起定本周训练', '让球员先提出办法']),
  'lin-chuan': npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 'captain', [
    '大家都想要好名次，但不能每次落后就把责任推给替补。',
    '看台越来越满了。场上的人也该知道球场为什么要留下。',
    '如果要冒险压上，我会先告诉身后的人。'
  ], ['问他更衣室的近况', '让他组织场上沟通', '把最终决定留给队长']),
  'aunt-xu': npc('aunt-xu', '许姨', 'npc-sumi', 'training', 'market', [
    '小店不是比赛日才存在。平时来喝水的人，也在养这座球场。',
    '摊位多了以后，钱更好看，收摊和清洁也要有人做。',
    '别为了冲排名把每一笔钱都花在球队身上。'
  ], ['和她对一遍账', '一起安排比赛日小店', '先保住本周现金']),
  xiaoman: npc('xiaoman', '小满', 'npc-assistant', 'training', 'youth', [
    '我不想只在稳赢的时候上场。那样的信任不是真的。',
    '青训角有孩子在等。他们问我，替补算不算球队的人。',
    '如果这周要用年轻人，先告诉我们要承担什么。'
  ], ['问他最近累不累', '让他带年轻人合练', '答应给他真实上场时间']),
  'shen-qiao': npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 'sponsor', [
    '排名能让外面的人认真看你们，但不能替你们付每一张账单。',
    '我还是认为球场需要更专业的经营。至少你开始拿结果说话了。',
    '精英邀请赛的门槛不只在积分榜，我知道主办方还会看设施。'
  ], ['听他把条件说清楚', '要求他公开资源条件', '拒绝用排名换控制权']),
  'director-luo': npc('director-luo', '罗馆长', 'npc-wenshu', 'stadium', 'governance', [
    '评审看的是连续经营，不是某一个周日的热闹。',
    '每项建设都要留下谁提出、谁受益、谁维护。',
    '关系好不能代替程序，但程序也不能假装人不存在。'
  ], ['请他解释评审标准', '把本周决定写进记录', '要求五方一起确认'])
});

export const SEASON_GOALS = freeze({
  ranking: freeze({ id: 'ranking', label: '赛季进入前四', description: '七轮结束时排名第 4 或更高' }),
  construction: freeze({ id: 'construction', label: '球场完成六级建设', description: '五项工程总等级达到 6' }),
  people: freeze({ id: 'people', label: '三个人真正站在一起', description: '至少三位人物关系达到 3' }),
  finance: freeze({ id: 'finance', label: '账上留有下一周的钱', description: '赛季结束现金不少于 180 元' })
});

export const MATCH_MOMENTS = freeze([
  freeze({
    id: 'opening-plan', minute: 18, title: '对手开始试探海风队的准备',
    copy: '不需要喊复杂战术。把这一周真正练过的东西带上场。', awayPressure: 0,
    choices: freeze([
      freeze({ id: 'use-attack-work', label: '让前场按练过的路线跑一次', callback: 'attack' }),
      freeze({ id: 'hold-team-shape', label: '先让每个人守住身边的位置', callback: 'defense' }),
      freeze({ id: 'trust-young-side', label: '把第一脚交给年轻人处理', callback: 'youth' })
    ])
  }),
  freeze({
    id: 'home-ground', minute: 52, title: '海风变大，看台和场边都在回应比赛',
    copy: '球场这周留下的变化，现在会不会有人用得上。', awayPressure: 1,
    choices: freeze([
      freeze({ id: 'open-safe-stands', label: '请大家移到加固后的看台', callback: 'stands' }),
      freeze({ id: 'send-market-support', label: '让小店和集市把热水送过去', callback: 'market' }),
      freeze({ id: 'bring-community-back', label: '请社区时段的人把歌声带回来', callback: 'community' })
    ])
  }),
  freeze({
    id: 'last-decision', minute: 82, title: '最后十分钟，谁来承担下一次失误',
    copy: '比分还没有替任何人决定结局。现在要选择谁得到下一次机会。', awayPressure: 0,
    choices: freeze([
      freeze({ id: 'use-clinic-sub', label: '换上在理疗室恢复好的队员', callback: 'clinic' }),
      freeze({ id: 'follow-coach-note', label: '执行郭教练赛前留下的办法', callback: 'coach' }),
      freeze({ id: 'share-final-ball', label: '让全队一起承担最后一球', callback: 'cohesion' })
    ])
  })
]);

export function getLeagueTeam(teamId) {
  const team = LEAGUE_TEAMS.find(item => item.id === teamId);
  if (!team) throw new TypeError('Unknown league team');
  return team;
}

export function getSeasonRound(roundIndex) {
  const round = SEASON_ROUNDS[roundIndex];
  if (!round) throw new TypeError('Unknown season round');
  return round;
}

export function getSeasonNpc(npcId) {
  const npc = SEASON_NPCS[npcId];
  if (!npc) throw new TypeError('Unknown season NPC');
  return npc;
}

export function getSeasonProject(projectId) {
  const project = SEASON_PROJECTS[projectId];
  if (!project) throw new TypeError('Unknown season project');
  return project;
}
