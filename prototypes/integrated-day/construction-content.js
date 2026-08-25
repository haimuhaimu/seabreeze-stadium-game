const freeze = value => Object.freeze(value);

function level(label, copy, visitCopy) {
  return freeze({ label, copy, visitCopy });
}

function scene(projectId, mapId, visual, patronId, placement, levels) {
  return freeze({
    projectId,
    mapId,
    visual: freeze(visual),
    patronId,
    placement: freeze(placement),
    levels: freeze(levels)
  });
}

export const CONSTRUCTION_SCENES = freeze({
  stands: scene('stands', 'stadium', { x: 6, y: 20, width: 23, height: 49 }, 'lin-chuan', { x: 25, y: 64 }, [
    level(
      '安全护栏',
      '林川把松动处逐段摇过，孩子经过主看台时终于不用被人一路护着。',
      '你和林川沿新护栏走了一圈。他把最后一颗松动螺帽拧紧，才让第一排观众坐下。'
    ),
    level(
      '遮雨座席',
      '下雨时观众不再往出口挤，林川开始安排队员赛后轮流收起湿坐垫。',
      '你和林川把遮雨帘放下又升起。他说这不是面子工程，是让人愿意在坏天气里留下。'
    ),
    level(
      '家庭看台',
      '家庭看台有了固定照看人，林川记得哪些孩子第一次来看海风队比赛。',
      '你和林川把遗落的小围巾挂到招领处。看台已经像一个会记住来客的地方。'
    )
  ]),
  clinic: scene('clinic', 'stadium', { x: 60, y: 70, width: 11, height: 15 }, 'xiaoman', { x: 70, y: 65 }, [
    level(
      '基础急救柜',
      '小满把绷带和冰袋按日期摆好，受伤的人不必再假装自己只是有点累。',
      '你陪小满核对急救柜。他把自己的旧护踝也放进去，说下次谁需要就先拿。'
    ),
    level(
      '理疗床与冰浴',
      '小满恢复训练前会先做完理疗，他也开始提醒别人疼痛不是争位置的理由。',
      '小满示范完恢复流程，又把计时器交给你。这里让休息变成训练的一部分。'
    ),
    level(
      '社区康复室',
      '社区康复室白天向邻居开放，小满不再是唯一一个需要慢慢回到场上的人。',
      '你和小满给一位老人腾出理疗床。他说被照顾不会让一个人在球队里变得更轻。'
    )
  ]),
  academy: scene('academy', 'training', { x: 75, y: 55, width: 17, height: 21 }, 'coach-guo', { x: 63, y: 75 }, [
    level(
      '青训器材架',
      '郭教练给每只旧球写上编号，年轻人第一次有了不必等主力用完的训练器材。',
      '你和郭教练把器材按身高放回架上。他说孩子不该先学会争抢剩下的东西。'
    ),
    level(
      '半场训练区',
      '半场训练区有了固定时段，郭教练把年轻人与一线队的训练写在同一块板上。',
      '郭教练让你站在边线计时。年轻队员按自己的节奏完成整组，没有被提前赶走。'
    ),
    level(
      '社区青训班',
      '社区青训班每周开门，郭教练开始把会不会照顾新人也算进球员评价。',
      '你和郭教练收好最后一组背心。海风队已经有了比下一场比赛更长的时间表。'
    )
  ]),
  market: scene('market', 'stadium', { x: 83, y: 14, width: 15, height: 37 }, 'aunt-xu', { x: 82, y: 63 }, [
    level(
      '固定电源位',
      '许姨不用再从小店拖出长电线，摊主们也开始把每天用电写进共同账本。',
      '你和许姨逐个试过电源位。她把最后一根临时电线卷起，说今天少欠了一点运气。'
    ),
    level(
      '遮雨摊位',
      '遮雨摊位让平日的小生意也能继续，许姨开始给没有比赛的下午排值班。',
      '你陪许姨把雨棚边的水抖掉。她说能在普通日子开门，才算真正留下来了。'
    ),
    level(
      '周末海风集市',
      '周末集市有了固定摊主和清洁轮值，许姨不再一个人替所有热闹收尾。',
      '你和许姨走过收摊后的空位。地面很干净，每个摊主都签了下一次轮值。'
    )
  ]),
  lights: scene('lights', 'stadium', { x: 78, y: 57, width: 14, height: 21 }, 'director-luo', { x: 84, y: 66 }, [
    level(
      '安全夜场灯',
      '罗馆长把每组灯的检查人写进记录，夜场不再靠谁碰巧记得去拉电闸。',
      '你和罗馆长等四组灯依次亮起。他在记录上签名，也留下下一次复查日期。'
    ),
    level(
      '固定直播位',
      '固定直播位保留社区解说声，罗馆长要求每次转播都公开收入和使用时段。',
      '罗馆长让你从镜头里看了一遍看台。画面里不只有比分，也拍得到谁在维护这里。'
    ),
    level(
      '完整夜赛系统',
      '夜赛系统有了备用电源和开放规则，罗馆长终于允许外队提前预订周末档期。',
      '你和罗馆长完成断电演练。备用灯准时亮起，场边的人没有一个需要摸黑离开。'
    )
  ])
});

const MAP_IDS = freeze(['training', 'stadium']);
const NPC_IDS = freeze(['coach-guo', 'lin-chuan', 'aunt-xu', 'xiaoman', 'shen-qiao', 'director-luo']);

function assertProjects(projects) {
  if (!projects || typeof projects !== 'object') throw new TypeError('Invalid construction projects');
  for (const projectId of Object.keys(CONSTRUCTION_SCENES)) {
    const value = projects[projectId];
    if (!Number.isInteger(value) || value < 0 || value > 3) throw new TypeError('Invalid construction level');
  }
}

export function getConstructionScene(projectId) {
  const value = CONSTRUCTION_SCENES[projectId];
  if (!value) throw new TypeError('Unknown construction scene');
  return value;
}

export function getConstructionVisuals(mapId, projects) {
  if (!MAP_IDS.includes(mapId)) throw new TypeError('Unknown construction map');
  assertProjects(projects);
  return Object.values(CONSTRUCTION_SCENES)
    .filter(item => item.mapId === mapId)
    .map(item => {
      const levelValue = projects[item.projectId];
      return {
        projectId: item.projectId,
        mapId: item.mapId,
        level: levelValue,
        ...item.visual,
        stageLabel: levelValue ? item.levels[levelValue - 1].label : '待开工',
        complete: levelValue === item.levels.length
      };
    });
}

export function getConstructionNpcPlacement(season, npcId) {
  if (!NPC_IDS.includes(npcId)) throw new TypeError('Unknown construction NPC');
  assertProjects(season?.projects);
  const item = Object.values(CONSTRUCTION_SCENES).find(sceneItem => sceneItem.patronId === npcId);
  if (!item) return null;
  const levelValue = season.projects[item.projectId];
  if (!levelValue) return null;
  return {
    projectId: item.projectId,
    mapId: item.mapId,
    ...item.placement,
    copy: item.levels[levelValue - 1].copy
  };
}
