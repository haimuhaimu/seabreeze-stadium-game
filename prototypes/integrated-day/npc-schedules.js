import { getOpponent } from './opponent-content.js';

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

export function getNpcSchedule(dayIndex, phase = 'morning', context = {}) {
  if (phase !== 'morning') return [];
  return (firstWeek[dayIndex] ?? []).map(item => {
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
