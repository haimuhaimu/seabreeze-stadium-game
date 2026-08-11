import { getOpponent } from './opponent-content.js';

const firstWeek = Object.freeze({
  3: Object.freeze([
    Object.freeze({ id: 'shen-qiao', name: '沈峤', spriteClass: 'npc-shen', mapId: 'stadium', x: 72, y: 67, optional: false, copy: '债务不是天气。你可以接受澜岸体育的合作，也可以看着它继续变大。' }),
    Object.freeze({ id: 'lin-chuan', name: '林川', spriteClass: 'npc-linchuan', mapId: 'stadium', x: 41, y: 66, optional: true, copy: '签字当然算数。可要留下来踢球的人，不只看一张纸。' }),
    Object.freeze({ id: 'aunt-xu', name: '许姨', spriteClass: 'npc-sumi', mapId: 'training', x: 75, y: 43, optional: true, copy: '先把账看完。二十年前，大家也是从一句先撑过去开始的。' })
  ]),
  4: Object.freeze([
    Object.freeze({ id: 'xiaoman', name: '小满', spriteClass: 'npc-assistant', mapId: 'training', x: 61, y: 63, optional: false, copy: '我知道自己可能上不了。但训练名单，能不能让我自己看到？' }),
    Object.freeze({ id: 'lin-chuan', name: '林川', spriteClass: 'npc-linchuan', mapId: 'training', x: 49, y: 62, optional: true, copy: '练什么都可以。只是别让决定最后只落在最年轻的人身上。' })
  ]),
  5: Object.freeze([
    Object.freeze({ id: 'lin-chuan', name: '林川', spriteClass: 'npc-linchuan', mapId: 'stadium', x: 65, y: 67, optional: false, copy: '强队会把人带来，也会把我们的问题放大。你要先想清楚想让谁看见什么。' }),
    Object.freeze({ id: 'aunt-xu', name: '许姨', spriteClass: 'npc-sumi', mapId: 'training', x: 76, y: 44, optional: true, copy: '港口那边的人会自己带水。高校队会带来很多镜头。两种热闹不一样。' })
  ]),
  6: Object.freeze([
    Object.freeze({ id: 'aunt-xu', name: '许姨', spriteClass: 'npc-sumi', mapId: 'training', x: 74, y: 42, optional: false, copy: '摊位不是添头。有人愿意在比赛前来摆摊，说明他相信这里还有下周。' }),
    Object.freeze({ id: 'xiaoman', name: '小满', spriteClass: 'npc-assistant', mapId: 'training', x: 58, y: 64, optional: true, copy: '如果做体验课，我可以带小孩子练停球。这个我还挺会。' })
  ]),
  7: Object.freeze([
    Object.freeze({ id: 'coach-guo', name: '郭教练', spriteClass: 'npc-guo', mapId: 'stadium', x: 47, y: 68, optional: false, copy: '灯、看台、草皮都需要钱。比赛只会告诉你，哪一处没准备好。' }),
    Object.freeze({ id: 'lin-chuan', name: '林川', spriteClass: 'npc-linchuan', mapId: 'stadium', x: 56, y: 67, optional: true, copy: '草皮修好，最先知道的不是观众，是每个落地的膝盖。' })
  ]),
  8: Object.freeze([
    Object.freeze({ id: 'guest-captain', name: '客队队长', spriteClass: 'npc-qiaoqiao', mapId: 'stadium', x: 9, y: 41, optional: false, dynamicOpponent: true, copy: '一路都能看见海。你们这地方，比照片里大多了。' }),
    Object.freeze({ id: 'shen-qiao', name: '沈峤', spriteClass: 'npc-shen', mapId: 'stadium', x: 76, y: 65, optional: true, copy: '一场比赛能把问题盖住半天。经营权评审不会只看半天。' })
  ]),
  9: Object.freeze([
    Object.freeze({ id: 'lin-chuan', name: '林川', spriteClass: 'npc-linchuan', mapId: 'stadium', x: 43, y: 64, optional: true, copy: '今天听你的。终场以后，名单和账本还是要一起谈。' }),
    Object.freeze({ id: 'xiaoman', name: '小满', spriteClass: 'npc-assistant', mapId: 'stadium', x: 56, y: 64, optional: true, copy: '我紧张。但不是因为会输，是因为这次看台上真的有人。' }),
    Object.freeze({ id: 'coach-guo', name: '郭教练', spriteClass: 'npc-guo', mapId: 'stadium', x: 49, y: 65, optional: false, copy: '哨响以后先看场上。其他决定，等终场再承担。' })
  ])
});

export function getNpcSchedule(dayIndex, phase = 'morning', context = {}) {
  if (phase !== 'morning') return [];
  return (firstWeek[dayIndex] ?? []).map(npc => {
    if (!npc.dynamicOpponent || !context.opponentId) return { ...npc };
    const opponent = getOpponent(context.opponentId);
    return {
      ...npc,
      name: opponent.captain,
      copy: `我是${opponent.name}的${opponent.captain}。一路都能看见海，你们这地方比照片里大多了。`
    };
  });
}
