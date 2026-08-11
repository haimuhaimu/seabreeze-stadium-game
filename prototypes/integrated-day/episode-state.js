import { EPISODE_ID, PROMISES } from './episode-content.js';

const PROMISE_IDS = Object.freeze(Object.keys(PROMISES));
const FUNDRAISING_TOTAL = Object.freeze({ public: 48, private: 30 });
const FUNDING_CHOICES = new Set(['pay-lights', 'protect-work', 'shen-advance', 'pay-both']);
const HEARING_CHOICES = new Set(['manager-signs', 'coach-decides', 'five-party-week']);
const MATCH_TRUST = Object.freeze({
  'ask-xiaoman': 1,
  'replace-xiaoman': -2
});

function copyEpisode(episode) {
  return {
    ...episode,
    sceneHistory: [...episode.sceneHistory],
    promisesChosen: [...episode.promisesChosen],
    promisesCompleted: [...episode.promisesCompleted],
    matchChoices: episode.matchChoices.map(choice => ({ ...choice })),
    consequence: episode.consequence ? { ...episode.consequence } : null
  };
}

function requirePromise(promiseId) {
  if (!PROMISE_IDS.includes(promiseId)) throw new TypeError('Unknown promise');
}

function addSceneHistory(next, sceneId) {
  if (!next.sceneHistory.includes(sceneId)) next.sceneHistory.push(sceneId);
}

export function createEpisodeState() {
  return {
    id: EPISODE_ID,
    sceneId: 'blank-notice',
    sceneHistory: [],
    promiseSlots: 2,
    promisesChosen: [],
    promisesCompleted: [],
    missedRequest: null,
    activePromise: null,
    xiaomanTrust: 0,
    truthKnown: false,
    fundraisingMode: null,
    fundraisingTotal: 0,
    fridayFundingChoice: null,
    shenOffer: 'undecided',
    matchChoices: [],
    xiaomanDecision: null,
    hearingChoice: null,
    consequence: null
  };
}

export function acknowledgeNotice(episode) {
  const next = copyEpisode(episode);
  addSceneHistory(next, 'blank-notice');
  next.sceneId = 'seven-bib';
  return next;
}

export function choosePromises(episode, promiseIds) {
  const unique = [...new Set(promiseIds ?? [])];
  if (unique.length !== 2 || promiseIds.length !== 2) {
    throw new TypeError('Choose exactly two promises');
  }
  unique.forEach(requirePromise);
  if (episode.promisesChosen.length) throw new Error('Promises already chosen');
  const next = copyEpisode(episode);
  next.promisesChosen = unique;
  next.sceneId = 'promise-window';
  addSceneHistory(next, 'seven-bib');
  return next;
}

export function completePromise(episode, promiseId, payload = {}) {
  requirePromise(promiseId);
  if (!episode.promisesChosen.includes(promiseId)) throw new Error('Promise was not chosen');
  if (episode.promisesCompleted.includes(promiseId)) return episode;
  const next = copyEpisode(episode);
  next.promisesCompleted.push(promiseId);
  next.activePromise = null;

  if (promiseId === 'train') next.xiaomanTrust += 2;
  if (promiseId === 'records') next.truthKnown = true;
  if (promiseId === 'fundraise') {
    const mode = payload.fundraisingMode;
    if (!Object.hasOwn(FUNDRAISING_TOTAL, mode)) throw new TypeError('Invalid fundraising mode');
    next.fundraisingMode = mode;
    next.fundraisingTotal = FUNDRAISING_TOTAL[mode];
    if (mode === 'public') next.xiaomanTrust -= 1;
  }
  return next;
}

export function lockMissedRequest(episode) {
  if (episode.promisesChosen.length !== 2) throw new Error('Promises must be chosen first');
  const next = copyEpisode(episode);
  next.missedRequest = PROMISE_IDS.find(id => !next.promisesChosen.includes(id)) ?? null;
  next.sceneId = 'friday-funding';
  return next;
}

export function resolveFridayFunding(episode, choiceId) {
  if (!FUNDING_CHOICES.has(choiceId)) throw new TypeError('Invalid Friday funding choice');
  if (choiceId === 'pay-both' && episode.fundraisingTotal < 48) {
    throw new Error('Fundraising target was not reached');
  }
  const next = episode.missedRequest ? copyEpisode(episode) : lockMissedRequest(episode);
  next.fridayFundingChoice = choiceId;
  next.sceneId = 'shen-offer';
  if (choiceId === 'protect-work' || choiceId === 'pay-both' || choiceId === 'shen-advance') {
    next.xiaomanTrust += 1;
  }
  return next;
}

export function recordEpisodeMatchChoice(episode, highlightId, choiceId) {
  if (!highlightId || !choiceId) throw new TypeError('Match choice needs a highlight and choice id');
  if (episode.matchChoices.some(choice => choice.highlightId === highlightId)) return episode;
  const next = copyEpisode(episode);
  next.matchChoices.push({ highlightId, choiceId });
  next.xiaomanTrust += MATCH_TRUST[choiceId] ?? 0;
  return next;
}

export function acknowledgeShenOffer(episode) {
  const next = copyEpisode(episode);
  next.shenOffer = 'considering';
  next.sceneId = 'sunday-match';
  addSceneHistory(next, 'shen-offer');
  return next;
}

export function resolveXiaomanDecision(episode) {
  if (episode.xiaomanDecision) return episode;
  const next = copyEpisode(episode);
  next.xiaomanDecision = next.xiaomanTrust >= 1 ? 'stay-trial' : 'accept-shen';
  next.shenOffer = next.xiaomanDecision === 'stay-trial' ? 'declined' : 'accepted';
  return next;
}

export function chooseHearing(episode, choiceId) {
  if (!HEARING_CHOICES.has(choiceId)) throw new TypeError('Invalid hearing choice');
  if (!episode.xiaomanDecision) throw new Error('Xiaoman must decide before the hearing');
  const next = copyEpisode(episode);
  next.hearingChoice = choiceId;
  addSceneHistory(next, 'five-chairs');
  return next;
}

function missedRequestCopy(episode) {
  if (!episode.missedRequest) return '没有留下未回应的请求。';
  const request = PROMISES[episode.missedRequest];
  return `${request.label}没有来得及。${request.owner}会记得这次没有被放在前两位。`;
}

function shenAdvantage(episode) {
  if (episode.fridayFundingChoice === 'shen-advance') return '取得书面干预权';
  if (episode.truthKnown) return '旧球员证被公开，旧事不能再只由他说';
  return '仍然握着工作机会和旧债的解释权';
}

export function buildEpisodeConsequence(episode, matchResult) {
  if (!episode.xiaomanDecision || !episode.hearingChoice) {
    throw new Error('Episode consequence needs Xiaoman decision and hearing choice');
  }
  if (!matchResult?.score || !matchResult?.outcome) throw new TypeError('Invalid match result');
  return {
    xiaomanDecision: episode.xiaomanDecision,
    xiaomanCopy: episode.xiaomanDecision === 'stay-trial'
      ? '我想按自己的条件再留一周。下一次讨论我时，我要在场。'
      : '那份工作我会去。我不是因为你们说我不够好才走。',
    missedRequest: episode.missedRequest,
    missedCopy: missedRequestCopy(episode),
    shenAdvantage: shenAdvantage(episode),
    hearingChoice: episode.hearingChoice,
    nextCrisis: episode.hearingChoice === 'five-party-week'
      ? '五方会议将在下周第一次正式表决。'
      : '没有被选中的人要求下周重新讨论决策资格。',
    outcome: matchResult.outcome,
    score: { ...matchResult.score }
  };
}

