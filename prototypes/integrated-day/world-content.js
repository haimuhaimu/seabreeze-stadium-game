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

export function canStandOnMap(mapId, x, y) {
  const map = getMap(mapId);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 1.5 || x > 98 || y < 16 || y > 96) return false;
  return !map.blockedAreas.some(area => x > area.x1 && x < area.x2 && y > area.y1 && y < area.y2);
}
