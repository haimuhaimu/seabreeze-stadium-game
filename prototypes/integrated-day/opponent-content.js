export const OPPONENTS = Object.freeze({
  'harbor-workers': Object.freeze({
    id: 'harbor-workers',
    name: '港口工人队',
    shortName: '港工队',
    cost: 30,
    expectedAudience: 70,
    difficulty: 48,
    publicity: 2,
    community: 6,
    style: '身体对抗强，熟悉海风',
    captain: '周海生'
  }),
  'city-university': Object.freeze({
    id: 'city-university',
    name: '城市高校联队',
    shortName: '高校联队',
    cost: 55,
    expectedAudience: 110,
    difficulty: 62,
    publicity: 8,
    community: 3,
    style: '速度快，擅长边路推进',
    captain: '贺闻'
  })
});

export function getOpponent(id) {
  const opponent = OPPONENTS[id];
  if (!opponent) throw new TypeError('Invalid opponent');
  return opponent;
}
