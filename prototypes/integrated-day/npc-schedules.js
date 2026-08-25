import { getOpponent } from './opponent-content.js';
import { SEASON_NPCS } from './season-content.js';
import { getSeasonNpcMemory } from './season-memory.js';

function npc(id, name, spriteClass, mapId, x, y, copy, options = {}) {
  return Object.freeze({ id, name, spriteClass, mapId, x, y, copy, optional: true, ...options });
}

const firstWeek = Object.freeze({
  3: Object.freeze([
    npc('coach-guo', '郭教练', 'npc-guo', 'stadium', 58, 67, '通知我已经起草了。名字空着，不代表我们可以一直不回答。', { optional: false }),
    npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 43, 66, '第一周就决定谁离开，你凭什么？'),
    npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 74, 66, '我可以接下债务。决定权也应该写清楚。')
  ]),
  4: Object.freeze([
    npc('xiaoman', '小满', 'npc-assistant', 'training', 61, 63, '我在门外都听见了。能不能陪我再练一次？', { optional: false }),
    npc('aunt-xu', '许姨', 'npc-sumi', 'training', 82, 51, '小店还能开一天。钱不一定够，但大家会知道。'),
    npc('lin-chuan', '林川', 'npc-linchuan', 'training', 49, 62, '办公室有二十年前的旧记录，我去找钥匙。')
  ]),
  5: Object.freeze([
    npc('xiaoman', '小满', 'npc-assistant', 'training', 59, 63, '球已经放在边线了。你答应过的话，我还记得。', { promiseId: 'train' }),
    npc('aunt-xu', '许姨', 'npc-sumi', 'training', 82, 51, '小店的杯子洗好了。今天不开，明天也许就来不及。', { promiseId: 'fundraise' }),
    npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 67, 67, '办公室的旧柜子开了。那张通知应该还在里面。', { promiseId: 'records' })
  ]),
  6: Object.freeze([
    npc('xiaoman', '小满', 'npc-assistant', 'training', 59, 63, '今天结束以后，剩下的事就真的没有时间了。', { promiseId: 'train' }),
    npc('aunt-xu', '许姨', 'npc-sumi', 'training', 82, 51, '我可以自己开店，但你来和不来，大家看得出来。', { promiseId: 'fundraise' }),
    npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 67, 67, '我先把照片找到了，还差签字和日期。', { promiseId: 'records' })
  ]),
  7: Object.freeze([
    npc('coach-guo', '郭教练', 'npc-guo', 'stadium', 48, 68, '在钱确定以前，我先暂停小满下一周的安排。', { optional: false }),
    npc('aunt-xu', '许姨', 'npc-sumi', 'stadium', 57, 68, '电工刚来电话。灯和一个人的工作，只够先付一份。')
  ]),
  8: Object.freeze([
    npc('guest-captain', '客队队长', 'npc-qiaoqiao', 'stadium', 9, 41, '我们按之前的邀请来了。今晚的海风比学校操场大。', { dynamicOpponent: true }),
    npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 76, 65, '我给他的工作是真的。', { optional: false }),
    npc('xiaoman', '小满', 'npc-assistant', 'stadium', 59, 65, '这次让我自己回答。')
  ]),
  9: Object.freeze([
    npc('coach-guo', '郭教练', 'npc-guo', 'stadium', 49, 65, '先把比赛踢完。终场后所有人留下。', { optional: false }),
    npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 43, 64, '我会站在他旁边，但决定要由你说出口。'),
    npc('xiaoman', '小满', 'npc-assistant', 'stadium', 56, 64, '比赛以后，我先说我自己的选择。'),
    npc('aunt-xu', '许姨', 'npc-sumi', 'stadium', 62, 66, '五把椅子已经搬到场边了。'),
    npc('director-luo', '罗馆长', 'npc-wenshu', 'stadium', 69, 66, '今天不是只记比分。谁签字，也要留下记录。')
  ])
});

const secondWeek = Object.freeze({
  10: Object.freeze([
    npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 74, 66, '这笔钱能让工资准时到账。我要的条件都写在纸上，没有藏。', { optional: false }),
    npc('aunt-xu', '许姨', 'npc-sumi', 'stadium', 58, 67, '蓝布一挂上去，小店门口像换了一个地方。'),
    npc('coach-guo', '郭教练', 'npc-guo', 'stadium', 46, 67, '钱能救急，但训练和社区时段不能让赞助方一句话就拿走。')
  ]),
  11: Object.freeze([
    npc('director-luo', '罗馆长', 'npc-wenshu', 'stadium', 68, 66, '五把椅子不一定都有最终票，但每句话都必须写进记录。', { optional: false }),
    npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 43, 66, '如果钱决定一切，那我们上周搬椅子是在演给谁看？'),
    npc('xiaoman', '小满', 'npc-assistant', 'stadium', 56, 65, '我想知道签完以后，赞助活动会不会把训练赶到半夜。')
  ]),
  12: Object.freeze([
    npc('aunt-xu', '许姨', 'npc-sumi', 'stadium', 78, 66, '别光算一张大支票。小店一天一天挣的钱，也是真的钱。'),
    npc('xiaoman', '小满', 'npc-assistant', 'stadium', 55, 64, '今天练不练都由你选。我只想看看，谁愿意为自己的办法动手。'),
    npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 70, 66, '灯架下面有三处松动。要是周日出事，谁冠名都没用。')
  ]),
  13: Object.freeze([
    npc('coach-guo', '郭教练', 'npc-guo', 'stadium', 48, 67, '他们刮掉沈峤名字的时候，我没拦。说到底，是我欠他一句对不起。', { optional: false }),
    npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 75, 65, '我和他一起创办这里。后来你们需要一个坏人，就把我的名字刮掉了。'),
    npc('director-luo', '罗馆长', 'npc-wenshu', 'stadium', 68, 66, '旧章程还在仓库。事实可以补回来，至于权力怎么分，要另说。')
  ]),
  14: Object.freeze([
    npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 74, 66, '你们可以拒绝合同，但不能拒绝承认这座球场欠过我。', { optional: false }),
    npc('aunt-xu', '许姨', 'npc-sumi', 'stadium', 58, 67, '自救箱里的每一张零钱都有人记得从哪里来。'),
    npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 44, 66, '今天别替任何人举手。让五张票自己落下去。')
  ]),
  15: Object.freeze([
    npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 74, 65, '半张合照就在这里。你准备怎么把我的名字还回来？', { optional: false }),
    npc('director-luo', '罗馆长', 'npc-wenshu', 'stadium', 68, 66, '恢复创办人记录和交出运营权，是两份不同的文件。'),
    npc('xiaoman', '小满', 'npc-assistant', 'stadium', 55, 64, '我不喜欢他逼我们，但我也不想装作他以前没被欺负过。')
  ]),
  16: Object.freeze([
    npc('harbor-captain', '周海生', 'npc-qiaoqiao', 'stadium', 9, 41, '港口工人队来了。你们招牌叫什么，不影响我们认真踢这一场。', { optional: false }),
    npc('coach-guo', '郭教练', 'npc-guo', 'stadium', 48, 67, '终场以后先揭招牌。比分不用替任何人掩饰。'),
    npc('aunt-xu', '许姨', 'npc-sumi', 'stadium', 61, 66, '热水和毛巾都备好了。风大也别让看台先散。'),
    npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 75, 65, '我会看完。你们最好也看清楚，最后留下的是哪个名字。')
  ])
});

function promiseAwareCopy(npc, episode) {
  if (!npc.promiseId || !episode) return npc.copy;
  if (episode.promisesCompleted?.includes(npc.promiseId)) {
    return npc.promiseId === 'train'
      ? '三次传球已经做完。周日我会记得。'
      : npc.promiseId === 'fundraise'
        ? '小店的钱已经收进铁盒。大家也记住了你怎么说。'
        : '旧照片已经对上名字。这件事不能再装作没有发生。';
  }
  if (!episode.promisesChosen?.includes(npc.promiseId)) {
    return `${npc.copy}我知道这件事没有排进你答应的两件里。`;
  }
  return npc.copy;
}

const SEASON_POSITIONS = Object.freeze({
  'coach-guo': Object.freeze({ x: 55, y: 55 }),
  'lin-chuan': Object.freeze({ x: 43, y: 66 }),
  'aunt-xu': Object.freeze({ x: 82, y: 51 }),
  xiaoman: Object.freeze({ x: 59, y: 63 }),
  'shen-qiao': Object.freeze({ x: 75, y: 65 }),
  'director-luo': Object.freeze({ x: 68, y: 66 })
});

function seasonSchedule(season) {
  if (!season?.active || season.seasonComplete || season.week?.roundComplete) return [];
  return Object.values(SEASON_NPCS).map(person => {
    const position = SEASON_POSITIONS[person.id];
    const memory = getSeasonNpcMemory(season, person.id);
    return {
      id: person.id,
      name: person.name,
      spriteClass: person.spriteClass,
      mapId: person.mapId,
      x: position.x,
      y: position.y,
      copy: memory?.copy ?? person.copies[season.roundIndex % person.copies.length],
      memory,
      responses: person.responses.map(response => ({ ...response })),
      seasonNpc: true,
      optional: true
    };
  });
}

export function getNpcSchedule(dayIndex, phase = 'morning', context = {}) {
  if (phase !== 'morning') return [];
  if (dayIndex >= 17 && context.season?.active) return seasonSchedule(context.season);
  return (firstWeek[dayIndex] ?? secondWeek[dayIndex] ?? []).map(item => {
    const copy = promiseAwareCopy(item, context.episode);
    if (!item.dynamicOpponent || !context.opponentId) return { ...item, copy };
    const opponent = getOpponent(context.opponentId);
    return {
      ...item,
      name: opponent.captain,
      copy: `我是${opponent.name}的${opponent.captain}。一路都能看见海，你们这地方比照片里大多了。`
    };
  });
}
