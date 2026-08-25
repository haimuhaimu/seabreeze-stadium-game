const freezeMap = map => Object.freeze({
  ...map,
  start: Object.freeze({ ...map.start }),
  exits: Object.freeze(map.exits.map(exit => Object.freeze({
    ...exit,
    approach: Object.freeze({ ...exit.approach }),
    targetPosition: Object.freeze({ ...exit.targetPosition }),
    route: Object.freeze((exit.route ?? []).map(point => Object.freeze({ ...point })))
  }))),
  blockedAreas: Object.freeze(map.blockedAreas.map(area => Object.freeze({ ...area }))),
  objects: Object.freeze(map.objects.map(object => Object.freeze({
    ...object,
    approach: Object.freeze({ ...object.approach }),
    route: Object.freeze((object.route ?? []).map(point => Object.freeze({ ...point })))
  })))
});

export const MAPS = Object.freeze({
  training: freezeMap({
    id: 'training',
    label: '旧训练场与场边小店',
    image: './assets/seaside-club-handpainted-v4.png',
    alt: '手绘海边训练场、俱乐部和场边小店',
    width: 1672,
    height: 941,
    start: { x: 50, y: 89 },
    exits: [{
      id: 'to-stadium',
      x: 94,
      y: 89,
      approach: { x: 91, y: 87 },
      label: '沿海滨路去主赛场',
      targetMap: 'stadium',
      targetPosition: { x: 10, y: 90 }
    }],
    blockedAreas: [
      { x1: 0, y1: 0, x2: 100, y2: 23.5 },
      { x1: 29, y1: 18, x2: 59, y2: 40 },
      { x1: 59, y1: 19, x2: 84, y2: 40 },
      { x1: 0, y1: 35, x2: 23.5, y2: 76 },
      { x1: 87, y1: 42, x2: 100, y2: 79 }
    ],
    objects: [
      { id: 'tea-a', x: 28, y: 85, approach: { x: 31, y: 82 }, kind: 'gather', label: '收起入口花槽里的茶草' },
      { id: 'tea-b', x: 62, y: 78, approach: { x: 60, y: 82 }, kind: 'gather', label: '收起围网边的茶草' },
      { id: 'fruit-a', x: 82, y: 32, approach: { x: 84, y: 42 }, kind: 'gather', label: '收起小店旁的果子' },
      { id: 'fruit-b', x: 16, y: 85, approach: { x: 20, y: 83 }, kind: 'gather', label: '捡起自行车架旁的果子' },
      { id: 'coach', x: 55, y: 55, approach: { x: 55, y: 64 }, kind: 'coach', label: '和郭教练说话' },
      { id: 'shop', x: 73, y: 31, approach: { x: 73, y: 42 }, kind: 'shop', label: '打开场边小店' }
    ]
  }),
  stadium: freezeMap({
    id: 'stadium',
    label: '海风主赛场',
    image: './assets/seabreeze-main-stadium-v1.png',
    alt: '手绘现代海边十一人足球主赛场、双侧看台、办公室与周末集市',
    width: 1672,
    height: 941,
    start: { x: 10, y: 90 },
    exits: [{
      id: 'to-training',
      x: 4,
      y: 91,
      approach: { x: 8, y: 90 },
      route: [{ x: 84, y: 68 }, { x: 84, y: 88 }],
      label: '沿海滨路回旧训练场',
      targetMap: 'training',
      targetPosition: { x: 91, y: 87 }
    }],
    blockedAreas: [
      { x1: 0, y1: 0, x2: 100, y2: 16 },
      { x1: 6, y1: 24, x2: 27, y2: 67 },
      { x1: 65, y1: 18, x2: 91, y2: 64 },
      { x1: 90, y1: 18, x2: 100, y2: 63 },
      { x1: 0, y1: 70, x2: 80, y2: 84 }
    ],
    objects: [
      {
        id: 'stadium-office',
        x: 70,
        y: 66,
        approach: { x: 67, y: 67 },
        route: [{ x: 84, y: 88 }, { x: 84, y: 68 }],
        kind: 'mainline',
        label: '进入经营办公室'
      },
      { id: 'pitch-prep', x: 52, y: 68, approach: { x: 52, y: 66 }, kind: 'mainline', label: '检查比赛草场' },
      {
        id: 'guest-gate',
        x: 7,
        y: 30,
        approach: { x: 4, y: 40 },
        route: [{ x: 30, y: 68 }, { x: 4, y: 68 }],
        kind: 'mainline',
        label: '去客队通道'
      },
      {
        id: 'match-center',
        x: 52,
        y: 48,
        approach: { x: 52, y: 59 },
        route: [{ x: 4, y: 68 }, { x: 62, y: 68 }],
        kind: 'mainline',
        label: '准备主场比赛'
      }
    ]
  })
});

export function getMap(mapId) {
  const map = MAPS[mapId];
  if (!map) throw new TypeError('Unknown map');
  return map;
}

export function getMapObjects(mapId) {
  return getMap(mapId).objects;
}

const NAMING_ACTION_OBJECTS = Object.freeze([
  Object.freeze({
    id: 'free-shop', actionId: 'free:shop', x: 83, y: 64, approach: Object.freeze({ x: 84, y: 68 }),
    route: Object.freeze([Object.freeze({ x: 84, y: 88 }), Object.freeze({ x: 84, y: 68 })]),
    kind: 'free-action', label: '去场边小店帮许姨'
  }),
  Object.freeze({
    id: 'free-training', actionId: 'free:training', x: 52, y: 48, approach: Object.freeze({ x: 52, y: 68 }),
    route: Object.freeze([Object.freeze({ x: 84, y: 88 }), Object.freeze({ x: 84, y: 68 })]),
    kind: 'free-action', label: '去中圈陪球队训练'
  }),
  Object.freeze({
    id: 'free-repair', actionId: 'free:repair', x: 72, y: 64, approach: Object.freeze({ x: 84, y: 68 }),
    route: Object.freeze([Object.freeze({ x: 84, y: 88 }), Object.freeze({ x: 84, y: 68 })]),
    kind: 'free-action', label: '和林川检查球场隐患'
  }),
  Object.freeze({
    id: 'free-community', actionId: 'free:community', x: 7, y: 30, approach: Object.freeze({ x: 4, y: 40 }),
    route: Object.freeze([Object.freeze({ x: 30, y: 68 }), Object.freeze({ x: 4, y: 68 })]),
    kind: 'free-action', label: '到入口开放社区时段'
  }),
  Object.freeze({
    id: 'free-archive', actionId: 'free:archive', x: 70, y: 65, approach: Object.freeze({ x: 84, y: 68 }),
    route: Object.freeze([Object.freeze({ x: 84, y: 88 }), Object.freeze({ x: 84, y: 68 })]),
    kind: 'free-action', label: '进旧仓库整理创办资料'
  }),
  Object.freeze({
    id: 'free-rest', actionId: 'free:rest', x: 86, y: 87, approach: Object.freeze({ x: 84, y: 88 }),
    route: Object.freeze([]), kind: 'free-action', label: '坐在海边长椅上休息'
  })
]);

const SEASON_ACTION_OBJECTS = Object.freeze([
  Object.freeze({
    id: 'season-action-attack', actionId: 'train-attack', mapId: 'stadium', x: 52, y: 48,
    approach: Object.freeze({ x: 52, y: 59 }),
    route: Object.freeze([Object.freeze({ x: 84, y: 88 }), Object.freeze({ x: 84, y: 68 }), Object.freeze({ x: 62, y: 68 })]),
    kind: 'season-action', label: '去主赛场练前场配合'
  }),
  Object.freeze({
    id: 'season-action-defense', actionId: 'train-defense', mapId: 'training', x: 55, y: 55,
    approach: Object.freeze({ x: 55, y: 64 }), route: Object.freeze([]),
    kind: 'season-action', label: '在旧训练场练整体站位'
  }),
  Object.freeze({
    id: 'season-action-youth', actionId: 'youth-session', mapId: 'training', x: 61, y: 63,
    approach: Object.freeze({ x: 61, y: 71 }), route: Object.freeze([]),
    kind: 'season-action', label: '让年轻人加入合练'
  }),
  Object.freeze({
    id: 'season-action-shop', actionId: 'shop-day', mapId: 'training', x: 82, y: 32,
    approach: Object.freeze({ x: 82, y: 42 }), route: Object.freeze([]),
    kind: 'season-action', label: '认真开一天场边小店'
  }),
  Object.freeze({
    id: 'season-action-community', actionId: 'community-open', mapId: 'stadium', x: 7, y: 30,
    approach: Object.freeze({ x: 4, y: 40 }),
    route: Object.freeze([Object.freeze({ x: 30, y: 68 }), Object.freeze({ x: 4, y: 68 })]),
    kind: 'season-action', label: '在主场入口开放社区时段'
  }),
  Object.freeze({
    id: 'season-action-maintenance', actionId: 'maintenance', mapId: 'stadium', x: 72, y: 64,
    approach: Object.freeze({ x: 76, y: 68 }),
    route: Object.freeze([Object.freeze({ x: 84, y: 88 }), Object.freeze({ x: 84, y: 68 })]),
    kind: 'season-action', label: '巡检灯架、看台和排水口'
  }),
  Object.freeze({
    id: 'season-action-rest', actionId: 'rest', mapId: 'stadium', x: 86, y: 87,
    approach: Object.freeze({ x: 84, y: 88 }), route: Object.freeze([]),
    kind: 'season-action', label: '在海边长椅上早点休息'
  })
]);

const SEASON_PROJECT_OBJECTS = Object.freeze([
  Object.freeze({
    id: 'season-project-stands', projectId: 'stands', mapId: 'stadium', x: 25, y: 64,
    approach: Object.freeze({ x: 28, y: 68 }), route: Object.freeze([Object.freeze({ x: 4, y: 68 })]),
    kind: 'season-project', label: '查看主看台加固工程'
  }),
  Object.freeze({
    id: 'season-project-clinic', projectId: 'clinic', mapId: 'stadium', x: 70, y: 65,
    approach: Object.freeze({ x: 67, y: 68 }), route: Object.freeze([Object.freeze({ x: 84, y: 68 })]),
    kind: 'season-project', label: '查看理疗室建设'
  }),
  Object.freeze({
    id: 'season-project-academy', projectId: 'academy', mapId: 'training', x: 62, y: 78,
    approach: Object.freeze({ x: 60, y: 82 }), route: Object.freeze([]),
    kind: 'season-project', label: '查看青训角扩建'
  }),
  Object.freeze({
    id: 'season-project-market', projectId: 'market', mapId: 'stadium', x: 83, y: 64,
    approach: Object.freeze({ x: 84, y: 68 }),
    route: Object.freeze([Object.freeze({ x: 84, y: 88 }), Object.freeze({ x: 84, y: 68 })]),
    kind: 'season-project', label: '查看海风集市扩建'
  }),
  Object.freeze({
    id: 'season-project-lights', projectId: 'lights', mapId: 'stadium', x: 92, y: 64,
    approach: Object.freeze({ x: 89, y: 68 }),
    route: Object.freeze([Object.freeze({ x: 84, y: 88 }), Object.freeze({ x: 84, y: 68 })]),
    kind: 'season-project', label: '查看灯光与直播位升级'
  })
]);

const SEASON_MATCH_OBJECT = Object.freeze({
  id: 'season-match-center', mapId: 'stadium', x: 52, y: 48,
  approach: Object.freeze({ x: 52, y: 59 }),
  route: Object.freeze([Object.freeze({ x: 84, y: 88 }), Object.freeze({ x: 84, y: 68 }), Object.freeze({ x: 62, y: 68 })]),
  kind: 'season-match', label: '进入本轮联赛'
});

function cloneWorldObject(object) {
  return {
    ...object,
    approach: { ...object.approach },
    route: object.route.map(point => ({ ...point }))
  };
}

export function getSeasonWorldObjects(mapId, season) {
  getMap(mapId);
  if (!season?.active || season.seasonComplete || season.week?.roundComplete || season.match) return [];
  if (season.week.actions.length === 3) {
    return mapId === 'stadium' ? [cloneWorldObject(SEASON_MATCH_OBJECT)] : [];
  }
  const completed = new Set(season.week.actions);
  const actions = SEASON_ACTION_OBJECTS.filter(object => object.mapId === mapId && !completed.has(object.actionId));
  const projects = SEASON_PROJECT_OBJECTS.filter(object => (
    object.mapId === mapId
    && season.projects[object.projectId] < 3
    && !completed.has(`build:${object.projectId}`)
  ));
  return [...actions, ...projects].map(cloneWorldObject);
}

export function getNamingActionObjects(mapId, dayIndex, namingRights) {
  if (mapId !== 'stadium' || !namingRights?.freeTime?.available || namingRights.freeTime.activeAction) return [];
  if (namingRights.freeTime.records.some(record => record.dayIndex === dayIndex)) return [];
  return NAMING_ACTION_OBJECTS
    .filter(object => object.actionId !== 'free:archive' || dayIndex >= 13)
    .map(object => ({
      ...object,
      approach: { ...object.approach },
      route: object.route.map(point => ({ ...point }))
    }));
}

export function canStandOnMap(mapId, x, y) {
  const map = getMap(mapId);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 1.5 || x > 98 || y < 16 || y > 96) return false;
  return !map.blockedAreas.some(area => x > area.x1 && x < area.x2 && y > area.y1 && y < area.y2);
}
