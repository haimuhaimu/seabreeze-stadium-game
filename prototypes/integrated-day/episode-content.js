export const EPISODE_ID = 'last-roster-slot';

export const PROMISES = Object.freeze({
  train: Object.freeze({
    id: 'train',
    label: '陪小满再练一次',
    owner: '小满',
    ownerId: 'xiaoman',
    worldObjectId: 'coach',
    mapId: 'training',
    activityTitle: '陪小满传三次球'
  }),
  fundraise: Object.freeze({
    id: 'fundraise',
    label: '和许姨开店筹钱',
    owner: '许姨',
    ownerId: 'aunt-xu',
    worldObjectId: 'shop',
    mapId: 'training',
    activityTitle: '开一次场边小店'
  }),
  records: Object.freeze({
    id: 'records',
    label: '和林川找旧记录',
    owner: '林川',
    ownerId: 'lin-chuan',
    worldObjectId: 'stadium-office',
    mapId: 'stadium',
    activityTitle: '查清二十年前的通知'
  })
});

const EPISODE_DAYS = Object.freeze({
  3: Object.freeze({ dayIndex: 3, sceneId: 'blank-notice', requiredAction: 'episode-notice' }),
  4: Object.freeze({ dayIndex: 4, sceneId: 'seven-bib', requiredAction: 'episode-promises' }),
  5: Object.freeze({ dayIndex: 5, sceneId: 'promise-window', requiredAction: 'episode-promise' }),
  6: Object.freeze({ dayIndex: 6, sceneId: 'promise-window', requiredAction: 'episode-promise' }),
  7: Object.freeze({ dayIndex: 7, sceneId: 'friday-funding', requiredAction: 'episode-funding' }),
  8: Object.freeze({ dayIndex: 8, sceneId: 'shen-offer', requiredAction: 'episode-offer' }),
  9: Object.freeze({ dayIndex: 9, sceneId: 'sunday-match', requiredAction: 'episode-match' })
});

export const STORY_SCENES = Object.freeze({
  'blank-notice': Object.freeze({
    id: 'blank-notice',
    speaker: '郭教练',
    portraitId: 'guo',
    propId: 'notice',
    beats: Object.freeze([
      '这周的钱不够所有人留下。',
      '名单上必须少一个人。',
      '名字还没有写。'
    ]),
    choices: Object.freeze([
      Object.freeze({ id: 'ask-everyone', label: '先听听每个人怎么想' })
    ])
  }),
  'seven-bib': Object.freeze({
    id: 'seven-bib',
    speaker: '小满',
    portraitId: 'xiaoman',
    propId: 'bib',
    beats: Object.freeze([
      '我在门外都听见了。',
      '你们在讨论谁最不可惜。',
      '这次能不能也听听我？'
    ]),
    choices: Object.freeze([])
  }),
  'promise-window': Object.freeze({
    id: 'promise-window',
    speaker: '安若童',
    portraitId: 'an',
    propId: 'bib',
    beats: Object.freeze([
      '只剩两天。',
      '答应过的两件事，至少要亲自去做。'
    ]),
    choices: Object.freeze([])
  }),
  'friday-funding': Object.freeze({
    id: 'friday-funding',
    speaker: '许姨',
    portraitId: 'aunt-xu',
    propId: 'notice',
    beats: Object.freeze([
      '电工刚来电话。',
      '灯光复检和小满下一周的工作，只够先付一份。'
    ]),
    choices: Object.freeze([])
  }),
  'shen-offer': Object.freeze({
    id: 'shen-offer',
    speaker: '沈峤',
    portraitId: 'shen',
    propId: 'player-card',
    beats: Object.freeze([
      '我给小满的是一份真工作。',
      '固定排班，当月发薪。',
      '当年没有人给过我这个选择。'
    ]),
    choices: Object.freeze([])
  }),
  'sunday-match': Object.freeze({
    id: 'sunday-match',
    speaker: '小满',
    portraitId: 'xiaoman',
    propId: 'chairs',
    beats: Object.freeze([
      '比赛以后，我会自己回答。',
      '这次别替我投票。'
    ]),
    choices: Object.freeze([])
  })
});

export function getEpisodeDay(dayIndex) {
  const day = EPISODE_DAYS[dayIndex];
  if (!day) throw new TypeError('Unknown episode day');
  return day;
}

export function getStoryScene(sceneId) {
  const scene = STORY_SCENES[sceneId];
  if (!scene) throw new TypeError('Unknown story scene');
  return scene;
}

export function getPromiseContent(promiseId) {
  const promise = PROMISES[promiseId];
  if (!promise) throw new TypeError('Unknown promise');
  return promise;
}

