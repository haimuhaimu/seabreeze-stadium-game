# 《最后一个名额》首周重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有春 15 日至春 21 日的七道经营选择题，重构成可完整游玩的首周人物事件《最后一个名额》，让平日行动、周六反转、周日比赛与五把椅子会议形成连续回响。

**Architecture:** 保留序章、两张可行走地图和原生 DOM 游戏框架；新增独立 `episode-content.js`、`episode-state.js` 与 `episode-activities.js`，让剧情文案、人物后果和小游戏规则不继续堆入 `game-state.js`。`game-state.js` 只负责把剧集结果映射到现金、社区、治理和比赛等长期状态，`game.js` 负责地图交互和场景渲染。存档升级为版本 3，并对版本 1、2 做内存迁移。

**Tech Stack:** 原生 HTML/CSS、浏览器 ES Modules、localStorage、Node.js `node:test`、Chrome DevTools Protocol 冒烟测试、本地 PNG 手绘资产，无新增运行时依赖。

## Global Constraints

- 面向喜欢生活模拟和人物故事的泛玩家，不要求理解足球专业术语。
- 首周对手固定为 `city-university`，界面名称改为“海岬大学联队”。
- 玩家在春 16 日选择两个请求；春 17 日、18 日分别完成一个，第三个请求于春 19 日记为“没有来得及”。
- 小满必须自己决定去留；玩家只能影响信任，不能在五把椅子会议中推翻他的决定。
- 四个记忆物件必须实际显示：空白离开通知、七号背心、沈峤旧球员证、五把椅子。
- 主线界面首先显示人物后果，现金、球场、信任、社区和自主权退到二级账本。
- 不增加新地图、阵型、转会、球员属性面板或新的第三方依赖。
- 1440 x 900 与 390 x 844 必须可完整操作；所有自动动效尊重 `prefers-reduced-motion`。
- 可见中文文案不使用长破折号字符 `—` 或 `–`。

## Existing Visual Audit

- **保留：** 深海青世界界面、珊瑚红单一强调色、10-12px 软圆角、手绘地图、安若童四向行走、现有球队和沈峤素材。
- **保留：** 启动页、序章三日、小店经营、地图点击寻路、键盘与触屏控制、记录册。
- **退场：** 首周顶部五指标驾驶舱、每天一个通用经营弹窗、数值先于人物的日结和周结。
- **新增：** 不对称人物剧情场景、物件特写、两格承诺纸条、三种主动玩法、五把椅子公开场景。
- **设计参数：** `DESIGN_VARIANCE 6 / MOTION_INTENSITY 4 / VISUAL_DENSITY 5`。动效只表达场景进入、选择落定和人物后果，不做持续炫技。

---

### Task 1: 锁定剧集日历、人物请求与场景文案

**Files:**
- Create: `prototypes/integrated-day/episode-content.js`
- Create: `prototypes/integrated-day/episode-content.test.mjs`
- Modify: `prototypes/integrated-day/campaign-content.js`
- Modify: `prototypes/integrated-day/campaign-content.test.mjs`

**Interfaces:**
- Produces: `EPISODE_ID`, `PROMISES`, `STORY_SCENES`, `getEpisodeDay(dayIndex)`, `getStoryScene(sceneId)`, `getPromiseContent(promiseId)`.
- Produces: campaign actions `episode-notice`, `episode-promises`, `episode-promise`, `episode-funding`, `episode-offer`, `episode-match`.

- [ ] **Step 1: Write failing content tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EPISODE_ID,
  PROMISES,
  getEpisodeDay,
  getStoryScene
} from './episode-content.js';

test('last roster slot exposes three plain-language requests', () => {
  assert.equal(EPISODE_ID, 'last-roster-slot');
  assert.deepEqual(Object.keys(PROMISES), ['train', 'fundraise', 'records']);
  assert.equal(PROMISES.train.worldObjectId, 'coach');
  assert.equal(PROMISES.fundraise.worldObjectId, 'shop');
  assert.equal(PROMISES.records.worldObjectId, 'stadium-office');
});

test('the management week follows the approved episode rhythm', () => {
  assert.equal(getEpisodeDay(3).sceneId, 'blank-notice');
  assert.equal(getEpisodeDay(4).sceneId, 'seven-bib');
  assert.equal(getEpisodeDay(7).sceneId, 'friday-funding');
  assert.equal(getEpisodeDay(8).sceneId, 'shen-offer');
  assert.equal(getEpisodeDay(9).sceneId, 'sunday-match');
});

test('story scenes stay short and use physical props', () => {
  const notice = getStoryScene('blank-notice');
  assert.equal(notice.propId, 'notice');
  assert.ok(notice.beats.length <= 3);
  assert.ok(notice.choices.length <= 3);
});
```

- [ ] **Step 2: Run the tests and confirm the module is missing**

Run: `node --test prototypes/integrated-day/episode-content.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `episode-content.js`.

- [ ] **Step 3: Add frozen episode content**

```js
export const EPISODE_ID = 'last-roster-slot';

export const PROMISES = Object.freeze({
  train: Object.freeze({ id: 'train', label: '陪小满再练一次', owner: '小满', worldObjectId: 'coach', mapId: 'training' }),
  fundraise: Object.freeze({ id: 'fundraise', label: '和许姨开店筹钱', owner: '许姨', worldObjectId: 'shop', mapId: 'training' }),
  records: Object.freeze({ id: 'records', label: '和林川找旧记录', owner: '林川', worldObjectId: 'stadium-office', mapId: 'stadium' })
});

const days = Object.freeze({
  3: Object.freeze({ dayIndex: 3, sceneId: 'blank-notice', requiredAction: 'episode-notice' }),
  4: Object.freeze({ dayIndex: 4, sceneId: 'seven-bib', requiredAction: 'episode-promises' }),
  5: Object.freeze({ dayIndex: 5, sceneId: 'promise-window', requiredAction: 'episode-promise' }),
  6: Object.freeze({ dayIndex: 6, sceneId: 'promise-window', requiredAction: 'episode-promise' }),
  7: Object.freeze({ dayIndex: 7, sceneId: 'friday-funding', requiredAction: 'episode-funding' }),
  8: Object.freeze({ dayIndex: 8, sceneId: 'shen-offer', requiredAction: 'episode-offer' }),
  9: Object.freeze({ dayIndex: 9, sceneId: 'sunday-match', requiredAction: 'episode-match' })
});

const scenes = Object.freeze({
  'blank-notice': Object.freeze({
    id: 'blank-notice', speaker: '郭教练', portraitId: 'guo', propId: 'notice',
    beats: Object.freeze(['这周的钱不够所有人留下。', '名单上必须少一个人。', '名字还没有写。']),
    choices: Object.freeze([{ id: 'ask-everyone', label: '先听听每个人怎么想' }])
  }),
  'seven-bib': Object.freeze({
    id: 'seven-bib', speaker: '小满', portraitId: 'xiaoman', propId: 'bib',
    beats: Object.freeze(['我在门外都听见了。', '你们在讨论谁最不可惜。']), choices: Object.freeze([])
  }),
  'friday-funding': Object.freeze({ id: 'friday-funding', speaker: '许姨', portraitId: 'aunt-xu', propId: 'notice', beats: Object.freeze(['灯光复检和小满下一周的工作，只够先付一份。']), choices: Object.freeze([]) }),
  'shen-offer': Object.freeze({ id: 'shen-offer', speaker: '沈峤', portraitId: 'shen', propId: 'player-card', beats: Object.freeze(['我给小满的是一份真工作。', '当年没有人给过我这个选择。']), choices: Object.freeze([]) }),
  'sunday-match': Object.freeze({ id: 'sunday-match', speaker: '小满', portraitId: 'xiaoman', propId: 'chairs', beats: Object.freeze(['比赛以后，我会自己回答。']), choices: Object.freeze([]) })
});

export function getEpisodeDay(dayIndex) {
  const day = days[dayIndex];
  if (!day) throw new TypeError('Unknown episode day');
  return day;
}

export function getStoryScene(sceneId) {
  const scene = scenes[sceneId];
  if (!scene) throw new TypeError('Unknown story scene');
  return scene;
}

export function getPromiseContent(promiseId) {
  const promise = PROMISES[promiseId];
  if (!promise) throw new TypeError('Unknown promise');
  return promise;
}
```

Update the campaign entries to:

```js
['周一', 15, '空白通知', 'episode-notice', 'stadium'],
['周二', 16, '门外的七号', 'episode-promises', 'training'],
['周三', 17, '只来得及两件事', 'episode-promise', 'training'],
['周四', 18, '第二个承诺', 'episode-promise', 'training'],
['周五', 19, '灯亮以前', 'episode-funding', 'stadium'],
['周六', 20, '沈峤的旧球员证', 'episode-offer', 'stadium'],
['周日', 21, '比赛与五把椅子', 'episode-match', 'stadium']
```

- [ ] **Step 4: Run content tests**

Run: `node --test prototypes/integrated-day/episode-content.test.mjs prototypes/integrated-day/campaign-content.test.mjs`

Expected: all content tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/integrated-day/episode-content.js prototypes/integrated-day/episode-content.test.mjs prototypes/integrated-day/campaign-content.js prototypes/integrated-day/campaign-content.test.mjs
git commit -m "feat: define the last roster slot episode"
```

### Task 2: 实现不可变的剧集状态与人物后果

**Files:**
- Create: `prototypes/integrated-day/episode-state.js`
- Create: `prototypes/integrated-day/episode-state.test.mjs`

**Interfaces:**
- Consumes: promise ids from `episode-content.js`.
- Produces: `createEpisodeState()`, `acknowledgeNotice()`, `choosePromises()`, `completePromise()`, `resolveFridayFunding()`, `recordEpisodeMatchChoice()`, `resolveXiaomanDecision()`, `chooseHearing()`, `buildEpisodeConsequence()`.

- [ ] **Step 1: Write failing state tests for promises and agency**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEpisodeState,
  choosePromises,
  completePromise,
  lockMissedRequest,
  resolveFridayFunding,
  recordEpisodeMatchChoice,
  resolveXiaomanDecision,
  chooseHearing,
  buildEpisodeConsequence
} from './episode-state.js';

test('exactly two different promises can be chosen', () => {
  const start = createEpisodeState();
  assert.throws(() => choosePromises(start, ['train']), /two promises/i);
  const chosen = choosePromises(start, ['train', 'records']);
  assert.deepEqual(chosen.promisesChosen, ['train', 'records']);
  assert.deepEqual(start.promisesChosen, []);
});

test('the unchosen request becomes a visible missed request', () => {
  let episode = choosePromises(createEpisodeState(), ['train', 'records']);
  episode = completePromise(episode, 'train');
  episode = completePromise(episode, 'records');
  episode = lockMissedRequest(episode);
  assert.equal(episode.missedRequest, 'fundraise');
  assert.equal(episode.xiaomanTrust, 2);
  assert.equal(episode.truthKnown, true);
});

test('public fundraising earns more but costs trust', () => {
  let episode = choosePromises(createEpisodeState(), ['train', 'fundraise']);
  episode = completePromise(episode, 'fundraise', { fundraisingMode: 'public' });
  assert.equal(episode.fundraisingTotal, 48);
  assert.equal(episode.xiaomanTrust, -1);
});

test('xiaoman makes his own decision before the hearing', () => {
  let episode = choosePromises(createEpisodeState(), ['train', 'records']);
  episode = completePromise(episode, 'train');
  episode = recordEpisodeMatchChoice(episode, 'middle', 'ask-xiaoman');
  episode = resolveXiaomanDecision(episode);
  assert.equal(episode.xiaomanDecision, 'stay-trial');
  episode = chooseHearing(episode, 'manager-signs');
  assert.equal(episode.xiaomanDecision, 'stay-trial');
});

test('funding and hearing choices create a human-readable consequence', () => {
  let episode = choosePromises(createEpisodeState(), ['fundraise', 'records']);
  episode = completePromise(episode, 'fundraise', { fundraisingMode: 'private' });
  episode = completePromise(episode, 'records');
  episode = lockMissedRequest(episode);
  episode = resolveFridayFunding(episode, 'shen-advance');
  episode = resolveXiaomanDecision(episode);
  episode = chooseHearing(episode, 'five-party-week');
  const result = buildEpisodeConsequence(episode, { outcome: 'draw', score: { home: 1, away: 1 } });
  assert.equal(result.shenAdvantage, '取得书面干预权');
  assert.match(result.missedCopy, /陪小满/);
});
```

- [ ] **Step 2: Run the state tests and confirm failure**

Run: `node --test prototypes/integrated-day/episode-state.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure episode reducer functions**

Use this state shape exactly:

```js
export function createEpisodeState() {
  return {
    id: 'last-roster-slot',
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
```

Apply these hidden rules without displaying the arithmetic:

```js
const TRUST_EFFECTS = Object.freeze({
  'complete-train': 2,
  'fundraise-public': -1,
  'fundraise-private': 0,
  'ask-xiaoman': 1,
  'replace-xiaoman': -2
});

const FUNDRAISING_TOTAL = Object.freeze({ public: 48, private: 30 });
const FUNDING_CHOICES = new Set(['pay-lights', 'protect-work', 'shen-advance', 'pay-both']);
const HEARING_CHOICES = new Set(['manager-signs', 'coach-decides', 'five-party-week']);
```

`resolveXiaomanDecision()` returns `stay-trial` for trust `>= 1`, otherwise `accept-shen`. `chooseHearing()` must throw if `xiaomanDecision` is still null and must never overwrite it. `pay-both` is valid only when `fundraisingTotal >= 48`.

- [ ] **Step 4: Run state tests**

Run: `node --test prototypes/integrated-day/episode-state.test.mjs`

Expected: all episode state tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/integrated-day/episode-state.js prototypes/integrated-day/episode-state.test.mjs
git commit -m "feat: model first week character consequences"
```

### Task 3: 实现三段主动玩法的纯规则

**Files:**
- Create: `prototypes/integrated-day/episode-activities.js`
- Create: `prototypes/integrated-day/episode-activities.test.mjs`

**Interfaces:**
- Produces: `createEpisodeActivity(promiseId)`, `takePass(session, pointer)`, `serveFundraiser(session, itemId)`, `inspectArchiveClue(session, clueId)`.
- The browser renderer will persist only the completed result, never a half-finished timing pointer.

- [ ] **Step 1: Write failing activity tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEpisodeActivity,
  takePass,
  serveFundraiser,
  inspectArchiveClue
} from './episode-activities.js';

test('three passes complete even when timing is imperfect', () => {
  let session = createEpisodeActivity('train');
  session = takePass(session, 0.1);
  session = takePass(session, 0.68);
  session = takePass(session, 0.9);
  assert.equal(session.complete, true);
  assert.equal(session.attempts.length, 3);
});

test('the fundraiser queue only advances on the requested item', () => {
  let session = createEpisodeActivity('fundraise');
  const unchanged = serveFundraiser(session, 'towel');
  assert.equal(unchanged.step, 0);
  for (const order of session.orders) session = serveFundraiser(session, order.itemId);
  assert.equal(session.complete, true);
  assert.equal(session.customersServed, 3);
});

test('archive clues can be inspected in any order without duplicates', () => {
  let session = createEpisodeActivity('records');
  session = inspectArchiveClue(session, 'photo');
  session = inspectArchiveClue(session, 'signature');
  session = inspectArchiveClue(session, 'photo');
  session = inspectArchiveClue(session, 'date');
  assert.deepEqual(session.cluesFound, ['photo', 'signature', 'date']);
  assert.equal(session.complete, true);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test prototypes/integrated-day/episode-activities.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement deterministic activity sessions**

```js
export const PASS_TARGETS = Object.freeze([0.28, 0.72, 0.5]);
export const FUNDRAISER_ORDERS = Object.freeze([
  Object.freeze({ customer: '乔乔', itemId: 'fruit', label: '果子水' }),
  Object.freeze({ customer: '闻书', itemId: 'tea', label: '青草茶' }),
  Object.freeze({ customer: '苏米', itemId: 'towel', label: '干净毛巾' })
]);
export const ARCHIVE_CLUES = Object.freeze(['signature', 'date', 'photo']);

export function createEpisodeActivity(promiseId) {
  if (promiseId === 'train') return { type: 'train', step: 0, attempts: [], complete: false };
  if (promiseId === 'fundraise') return { type: 'fundraise', step: 0, orders: FUNDRAISER_ORDERS, customersServed: 0, complete: false };
  if (promiseId === 'records') return { type: 'records', cluesFound: [], complete: false };
  throw new TypeError('Unknown episode activity');
}
```

`takePass()` clamps pointer to `0..1`, records `{ pointer, target, quality }`, and completes after three attempts. `serveFundraiser()` does not mutate or advance on a wrong item. `inspectArchiveClue()` accepts only the three declared clue ids and ignores duplicates.

- [ ] **Step 4: Run activity tests**

Run: `node --test prototypes/integrated-day/episode-activities.test.mjs`

Expected: all activity tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/integrated-day/episode-activities.js prototypes/integrated-day/episode-activities.test.mjs
git commit -m "feat: add first week active story games"
```

### Task 4: 升级版本 3 存档并迁移旧经营周

**Files:**
- Modify: `prototypes/integrated-day/save-game.js`
- Modify: `prototypes/integrated-day/save-migration.js`
- Modify: `prototypes/integrated-day/save-game.test.mjs`
- Modify: `prototypes/integrated-day/save-migration.test.mjs`

**Interfaces:**
- Consumes: `createEpisodeState()`.
- Produces: `SAVE_KEY = 'seabreeze-club-save-v3'`, `V2_SAVE_KEY`, `migrateV2Record(record)`.

- [ ] **Step 1: Add failing version 3 and migration tests**

```js
test('a version three episode save round-trips', () => {
  const storage = memoryStorage();
  const state = createGameState();
  writeSave(storage, state, { x: 44, y: 82 });
  const loaded = loadSave(storage);
  assert.equal(loaded.record.version, 3);
  assert.equal(loaded.record.state.version, 3);
  assert.equal(loaded.record.state.episode.id, 'last-roster-slot');
});

test('an unfinished version two management week restarts spring 15', () => {
  const v2 = createVersionTwoRecord({ dayIndex: 6, weekComplete: false });
  const migrated = migrateV2Record(v2);
  assert.equal(migrated.state.dayIndex, 3);
  assert.equal(migrated.state.phase, 'morning');
  assert.equal(migrated.state.episode.sceneId, 'blank-notice');
  assert.equal(migrated.state.money, v2.state.money);
  assert.deepEqual(migrated.state.repairs, v2.state.repairs);
});

test('a completed version two week is retained as a memory', () => {
  const migrated = migrateV2Record(createVersionTwoRecord({ dayIndex: 9, weekComplete: true }));
  assert.equal(migrated.state.dayIndex, 3);
  assert.equal(migrated.state.campaign.legacyWeekComplete, true);
});
```

- [ ] **Step 2: Run save tests and confirm failure**

Run: `node --test prototypes/integrated-day/save-game.test.mjs prototypes/integrated-day/save-migration.test.mjs`

Expected: FAIL because version 3 and `migrateV2Record` do not exist.

- [ ] **Step 3: Add version 3 validation and migration**

Set keys exactly:

```js
export const SAVE_KEY = 'seabreeze-club-save-v3';
export const V2_SAVE_KEY = 'seabreeze-club-save-v2';
export const LEGACY_SAVE_KEY = 'seabreeze-club-save-v1';
```

Validate these episode fields:

```js
function validEpisode(episode) {
  return Boolean(
    episode?.id === 'last-roster-slot'
    && Array.isArray(episode.sceneHistory)
    && Array.isArray(episode.promisesChosen)
    && Array.isArray(episode.promisesCompleted)
    && Array.isArray(episode.matchChoices)
    && Number.isFinite(episode.xiaomanTrust)
  );
}
```

Load priority is v3, then v2, then v1. Migration is in memory only. `clearSave()` removes only the three project keys. `writeSave()` writes `{ version: 3, state, position, mapId }`. If a page refresh happens during an activity, reset `episode.activePromise` and let the player restart that activity.

- [ ] **Step 4: Run save tests**

Run: `node --test prototypes/integrated-day/save-game.test.mjs prototypes/integrated-day/save-migration.test.mjs`

Expected: all save and migration tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/integrated-day/save-game.js prototypes/integrated-day/save-migration.js prototypes/integrated-day/save-game.test.mjs prototypes/integrated-day/save-migration.test.mjs
git commit -m "feat: migrate saves into the story episode"
```

### Task 5: 将剧集状态接入游戏主状态、固定对手和动态比赛选项

**Files:**
- Modify: `prototypes/integrated-day/game-state.js`
- Modify: `prototypes/integrated-day/game-state.test.mjs`
- Modify: `prototypes/integrated-day/match-engine.js`
- Modify: `prototypes/integrated-day/match-engine.test.mjs`
- Modify: `prototypes/integrated-day/opponent-content.js`

**Interfaces:**
- Consumes: all pure episode functions and activity completion payloads.
- Produces: `acknowledgeEpisodeNotice(state)`, `chooseEpisodePromises(state, ids)`, `completeEpisodePromise(state, id, payload)`, `resolveEpisodeFunding(state, choiceId)`, `acknowledgeShenOffer(state)`, `completeEpisodeHearing(state, choiceId)`.
- Changes: `chooseMatchHighlight(state, choiceId)` also records the choice in `state.episode`.
- Produces from `match-engine.js`: `getAvailableHighlights(match, episode)`.

- [ ] **Step 1: Replace the old seven-action tests with failing episode flow tests**

```js
test('the first week starts with a fixed opponent and blank notice', () => {
  const state = beginManagementWeek(completedPrologue());
  assert.equal(state.version, 3);
  assert.equal(state.management.opponentId, 'city-university');
  assert.equal(state.episode.sceneId, 'blank-notice');
});

test('two promise days can be completed in either order', () => {
  let state = beginManagementWeek(completedPrologue());
  state = acknowledgeEpisodeNotice(state);
  state = finishManagementDay(state);
  state = advanceCampaignDay(state);
  state = chooseEpisodePromises(state, ['records', 'train']);
  state = finishManagementDay(state);
  state = advanceCampaignDay(state);
  state = completeEpisodePromise(state, 'records');
  state = finishManagementDay(state);
  state = advanceCampaignDay(state);
  state = completeEpisodePromise(state, 'train');
  assert.deepEqual(state.episode.promisesCompleted, ['records', 'train']);
});

test('friday locks the missed request and maps funding into long-term state', () => {
  let state = reachFridayWithPromises(['train', 'fundraise'], { fundraisingMode: 'public' });
  state = resolveEpisodeFunding(state, 'pay-both');
  assert.equal(state.episode.missedRequest, 'records');
  assert.equal(state.management.shortfallPending, false);
  assert.ok(state.communitySupport > 52);
});

test('sunday requires hearing after three highlights', () => {
  let state = reachSundayReadyState();
  state = startWeeklyMatch(state);
  for (const choice of ['repeat-practice', 'ask-xiaoman', 'share-responsibility']) {
    state = chooseMatchHighlight(state, choice);
  }
  assert.equal(state.management.weekComplete, false);
  assert.ok(state.episode.xiaomanDecision);
  state = completeEpisodeHearing(state, 'five-party-week');
  assert.equal(state.management.weekComplete, true);
  assert.equal(state.management.settlement.character.xiaomanDecision, state.episode.xiaomanDecision);
});
```

- [ ] **Step 2: Run game-state and match tests and confirm failure**

Run: `node --test prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/match-engine.test.mjs`

Expected: FAIL for missing episode transitions and old highlight ids.

- [ ] **Step 3: Wire episode transitions into `game-state.js`**

Add `episode: createEpisodeState()` to `createGameState()`, deep-copy its arrays in `copyState()`, and set version `3`. `beginManagementWeek()` must set `opponentId: 'city-university'` and initialize the episode without asking the player to choose an opponent.

Use day completion gates:

```js
function episodeDayComplete(state) {
  if (state.dayIndex === 3) return state.episode.sceneHistory.includes('blank-notice');
  if (state.dayIndex === 4) return state.episode.promisesChosen.length === 2;
  if (state.dayIndex === 5) return state.episode.promisesCompleted.length >= 1;
  if (state.dayIndex === 6) return state.episode.promisesCompleted.length >= 2;
  if (state.dayIndex === 7) return Boolean(state.episode.fridayFundingChoice);
  if (state.dayIndex === 8) return state.episode.shenOffer !== 'undecided';
  if (state.dayIndex === 9) return Boolean(state.episode.hearingChoice);
  return false;
}
```

Map episode effects to long-term state only in wrapper functions:

- `fundraise/public`: add 48 cash and 5 community.
- `fundraise/private`: add 30 cash and 1 community.
- `records`: decrease `governance.shenInfluence` by 1, clamped by its existing reducer.
- `pay-lights`: run `prepareFacility(..., 'floodlights')` and do not guarantee the temporary job.
- `protect-work`: keep facilities unchanged and add 1 to trust.
- `shen-advance`: prepare floodlights, protect work, add 1 Shen influence.
- `pay-both`: available only through the pure episode validator; prepare floodlights with no Shen influence.

- [ ] **Step 4: Replace match copy with everyday-language choices**

Set three highlights to these ids and labels:

```js
[
  { id: 'opening', choices: [
    { id: 'repeat-practice', label: '做我们练过的事', requires: 'train' },
    { id: 'steady-everyone', label: '先让大家站稳' }
  ]},
  { id: 'middle', choices: [
    { id: 'lin-protects', label: '请林川站到他身边' },
    { id: 'replace-xiaoman', label: '现在把他换下来' },
    { id: 'ask-xiaoman', label: '先问小满要不要继续' }
  ]},
  { id: 'closing', choices: [
    { id: 'trust-once-more', label: '再相信他一次' },
    { id: 'share-responsibility', label: '让大家一起承担' },
    { id: 'keep-result', label: '先守住现在的结果' }
  ]}
]
```

`getAvailableHighlights(match, episode)` filters only `repeat-practice` when `train` is incomplete; all other choices remain available. Preserve deterministic score resolution and return `choiceId` effects without exposing attack or defense values.

`completeEpisodeHearing()` must call the week settlement exactly once and store the character payload beside numeric metrics:

```js
next.management.settlement = {
  ...numericSettlement,
  character: buildEpisodeConsequence(next.episode, next.management.matchResult)
};
next.episode.consequence = { ...next.management.settlement.character };
next.management.weekComplete = true;
```

- [ ] **Step 5: Run state and match tests**

Run: `node --test prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/match-engine.test.mjs prototypes/integrated-day/management-state.test.mjs`

Expected: all tests PASS; no existing economy/facility/governance tests regress.

- [ ] **Step 6: Commit**

```bash
git add prototypes/integrated-day/game-state.js prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/match-engine.js prototypes/integrated-day/match-engine.test.mjs prototypes/integrated-day/opponent-content.js
git commit -m "feat: connect the character episode to the weekly loop"
```

### Task 6: 更新地图目标和人物主动行动

**Files:**
- Modify: `prototypes/integrated-day/npc-schedules.js`
- Modify: `prototypes/integrated-day/world-content.js`
- Modify: `prototypes/integrated-day/world-content.test.mjs`

**Interfaces:**
- Produces: story-aware NPC schedules and existing-map targets for all promises.
- Does not create a new map.

- [ ] **Step 1: Add failing schedule and target tests**

```js
test('xiaoman is outside the meeting on spring 16', () => {
  const xiaoman = getNpcSchedule(4).find(npc => npc.id === 'xiaoman');
  assert.equal(xiaoman.mapId, 'training');
  assert.match(xiaoman.copy, /门外|听见/);
});

test('spring 17 can expose all three promise locations on existing maps', () => {
  assert.equal(getMapObjects('training').some(item => item.id === 'shop'), true);
  assert.equal(getMapObjects('training').some(item => item.id === 'coach'), true);
  assert.equal(getMapObjects('stadium').some(item => item.id === 'stadium-office'), true);
});

test('each core character takes one initiative in the episode', () => {
  const ids = new Set([3, 4, 5, 6, 7, 8, 9].flatMap(day => getNpcSchedule(day).map(npc => npc.id)));
  for (const id of ['coach-guo', 'lin-chuan', 'aunt-xu', 'xiaoman', 'shen-qiao']) assert.ok(ids.has(id));
});
```

- [ ] **Step 2: Run world tests and confirm copy failures**

Run: `node --test prototypes/integrated-day/world-content.test.mjs`

Expected: FAIL because the old schedules still discuss opponent and facility choices.

- [ ] **Step 3: Replace first-week schedules**

Use one active beat per character:

- Spring 15: 郭教练起草空白通知；林川公开质疑资格；沈峤提出承接债务。
- Spring 16: 小满在门外听见会议；许姨和林川分别提出请求。
- Spring 17-18: 未被玩家选择的人自行行动；选中的人物站在对应玩法入口。
- Spring 19: 电工电话由许姨带来，郭教练先暂停小满下一周安排。
- Spring 20: 沈峤主动给出真实工作，小满拒绝让玩家替他回答。
- Spring 21: 郭教练、林川、小满在场边；罗馆长和许姨在终场后进入会议。

Keep existing sprite classes and walking routes. In `game.js`, dynamic promise targets will reuse `coach`, `shop`, and `stadium-office`; `world-content.js` only gains optional prop markers near the office, bench and center circle.

The replacement schedule keeps the existing frozen shape:

```js
const firstWeek = Object.freeze({
  3: Object.freeze([
    npc('coach-guo', '郭教练', 'npc-guo', 'stadium', 58, 67, '通知我已经起草了。名字空着，不代表我们可以一直不回答。'),
    npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 43, 66, '第一周就决定谁离开，你凭什么？'),
    npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 74, 66, '我可以接下债务。决定权也应该写清楚。')
  ]),
  4: Object.freeze([
    npc('xiaoman', '小满', 'npc-assistant', 'training', 61, 63, '我在门外都听见了。能不能陪我再练一次？'),
    npc('aunt-xu', '许姨', 'npc-sumi', 'training', 75, 43, '小店还能开一天。钱不一定够，但大家会知道。'),
    npc('lin-chuan', '林川', 'npc-linchuan', 'training', 49, 62, '办公室有二十年前的旧记录，我去找钥匙。')
  ]),
  7: Object.freeze([
    npc('coach-guo', '郭教练', 'npc-guo', 'stadium', 48, 68, '在钱确定以前，我先暂停小满下一周的安排。'),
    npc('aunt-xu', '许姨', 'npc-sumi', 'stadium', 57, 68, '电工刚来电话。灯和一个人的工作，只够先付一份。')
  ]),
  8: Object.freeze([
    npc('shen-qiao', '沈峤', 'npc-shen', 'stadium', 76, 65, '我给他的工作是真的。'),
    npc('xiaoman', '小满', 'npc-assistant', 'stadium', 59, 65, '这次让我自己回答。')
  ]),
  9: Object.freeze([
    npc('coach-guo', '郭教练', 'npc-guo', 'stadium', 49, 65, '先把比赛踢完。终场后所有人留下。'),
    npc('lin-chuan', '林川', 'npc-linchuan', 'stadium', 43, 64, '我会站在他旁边，但决定要由你说出口。'),
    npc('xiaoman', '小满', 'npc-assistant', 'stadium', 56, 64, '比赛以后，我先说我自己的选择。')
  ])
});
```

- [ ] **Step 4: Run world tests**

Run: `node --test prototypes/integrated-day/world-content.test.mjs`

Expected: all world and schedule tests PASS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/integrated-day/npc-schedules.js prototypes/integrated-day/world-content.js prototypes/integrated-day/world-content.test.mjs
git commit -m "feat: stage character initiative across the stadium"
```

### Task 7: 制作四个记忆物件资产和非模板化剧情界面

**Files:**
- Create: `prototypes/integrated-day/assets/episode-memory-strip-v1.png`
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/styles.css`

**Interfaces:**
- Produces DOM hooks: `[data-weekly-care]`, `[data-ledger-toggle]`, `[data-story-scene]`, `[data-story-portrait]`, `[data-story-prop]`, `[data-story-beats]`, `[data-story-options]`, `[data-promise-picker]`, `[data-episode-activity]`, `[data-hearing]`.

- [ ] **Step 1: Generate the memory-object strip using the image generation skill**

Use this exact art direction, then inspect the result before copying it into the asset path:

```text
A horizontal four-panel storytelling prop strip for a hand-painted seaside community football game. Consistent early-1990s Japanese children’s TV cel-animation language: clean dark ink outlines, simple expressive shapes, flat muted coastal colors, subtle watercolor paper texture, no photorealism, no 3D, no glossy AI lighting, no text except a clear numeral 7. Panel 1: an unsigned dismissal notice lying on a modern stadium office desk, the name line visibly blank. Panel 2: a faded coral-red number 7 training bib hanging alone outside a locker-room door. Panel 3: a worn old youth-player identification card with a younger male athlete portrait and number 7, no readable words. Panel 4: five mismatched metal folding chairs placed on the center circle of a seaside football pitch at dusk, empty stands and ocean beyond. Equal-width panels, consistent camera and line weight, no characters outside the small ID portrait, no cropping of key objects.
```

The final asset must be local, at least 1600px wide, and must not contain generated prose. If the four panels are not evenly separated, crop them into a clean strip before integration.

- [ ] **Step 2: Add semantic story and activity markup**

Add one stable story component, not separate HTML for every scene:

```html
<aside class="weekly-care" data-weekly-care hidden aria-label="本周牵挂">
  <button data-care-open type="button">
    <span>本周牵挂</span><strong data-care-title>小满的七号背心</strong>
    <small data-care-progress>周日前决定去留</small>
  </button>
  <button data-ledger-toggle type="button">查看账本</button>
</aside>

<section class="story-scene" data-story-scene hidden role="dialog" aria-modal="true" aria-label="剧情场景">
  <div class="story-portrait" data-story-portrait aria-hidden="true"></div>
  <div class="story-copy">
    <strong data-story-speaker></strong>
    <div data-story-beats></div>
    <div class="story-options" data-story-options></div>
  </div>
  <div class="story-prop" data-story-prop aria-hidden="true"></div>
</section>

<section class="episode-activity" data-episode-activity hidden role="dialog" aria-modal="true" aria-label="本周行动">
  <header><strong data-activity-title></strong><small data-activity-progress></small></header>
  <div data-activity-stage></div>
</section>
```

Remove the duplicate fourth touch direction button while editing `index.html`. Keep the old decision panel in DOM for the prologue/legacy debug path but hide it during the new episode.

- [ ] **Step 3: Implement the visual system in native CSS**

Required rules:

- Story scene uses a 3-column asymmetric grid: portrait `minmax(150px, .8fr)`, copy `minmax(260px, 1.3fr)`, prop `minmax(170px, .9fr)`.
- Existing full-body character atlases supply portraits; use classes `portrait-an`, `portrait-guo`, `portrait-lin`, `portrait-xiaoman`, `portrait-aunt-xu`, `portrait-shen`.
- `episode-memory-strip-v1.png` uses one declared sprite-strip rule and four background positions; no CSS-drawn substitute objects.
- Buttons keep one coral accent, readable contrast, one-line desktop labels and `translateY(1px)` active feedback.
- At widths below 760px, story scene becomes a two-row grid: portrait and prop share the top row, copy and choices use the full second row.
- At heights below 610px, scene scrolls internally and never covers the only close/continue action.
- Motion is limited to opacity and transform, and the existing reduced-motion block disables it.
- The five numeric metrics are hidden behind the ledger toggle; the visible weekly-care panel shows the bib, deadline and `已完成 n/2`.

Start from these layout declarations, then extend only with component states:

```css
.story-scene {
  position: fixed;
  left: 50%;
  top: 50%;
  display: grid;
  grid-template-columns: minmax(150px, .8fr) minmax(260px, 1.3fr) minmax(170px, .9fr);
  width: min(920px, calc(100vw - 36px));
  max-height: calc(100dvh - 36px);
  overflow: auto;
  transform: translate(-50%, -50%);
}

.story-prop {
  min-height: 260px;
  background-image: url('./assets/episode-memory-strip-v1.png');
  background-repeat: no-repeat;
  background-size: 400% 100%;
}

.story-prop[data-prop='notice'] { background-position: 0 0; }
.story-prop[data-prop='bib'] { background-position: 33.333% 0; }
.story-prop[data-prop='player-card'] { background-position: 66.667% 0; }
.story-prop[data-prop='chairs'] { background-position: 100% 0; }

@media (max-width: 760px) {
  .story-scene { grid-template-columns: 1fr 1fr; width: calc(100vw - 18px); }
  .story-copy { grid-column: 1 / 3; }
}
```

- [ ] **Step 4: Perform static visual preflight**

Run:

```bash
rg -n '—|–' prototypes/integrated-day/index.html prototypes/integrated-day/game.js
rg -n 'data-story-scene|data-episode-activity|data-weekly-care' prototypes/integrated-day/index.html
git diff --check
```

Expected: no dash characters in visible copy, all required hooks present, no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add prototypes/integrated-day/assets/episode-memory-strip-v1.png prototypes/integrated-day/index.html prototypes/integrated-day/styles.css
git commit -m "feat: add hand-painted episode story scenes"
```

### Task 8: 在浏览器中接通承诺、小游戏和周五危机

**Files:**
- Modify: `prototypes/integrated-day/game.js`

**Interfaces:**
- Consumes: episode content, game-state episode transitions and activity engines.
- Produces debug helpers: `openEpisodeAction`, `completeEpisodeActivity`, `getActiveEpisodeActivity` under `window.__integratedDayDebug`.

- [ ] **Step 1: Import the new episode modules and declare transient UI state**

```js
import { PROMISES, getEpisodeDay, getStoryScene } from './episode-content.js';
import { createEpisodeActivity, PASS_TARGETS, takePass, serveFundraiser, inspectArchiveClue } from './episode-activities.js';

let activeStoryScene = null;
let activeEpisodeActivity = null;
let storyBeatIndex = 0;
let promiseDraft = [];
```

Do not write `activeEpisodeActivity` into the save. Persist only after a completed activity is converted into `completeEpisodePromise()`.

- [ ] **Step 2: Replace the fixed mainline object lookup with episode objectives**

Use this resolver:

```js
function episodeObjectives() {
  if (!isManagementWeekDay(state.dayIndex)) return [];
  if (state.dayIndex === 3) return [{ objectId: 'stadium-office', actionId: 'episode-notice' }];
  if (state.dayIndex === 4) return [{ objectId: 'coach', actionId: 'episode-promises' }];
  if (state.dayIndex === 5 || state.dayIndex === 6) {
    return state.episode.promisesChosen
      .filter(id => !state.episode.promisesCompleted.includes(id))
      .map(id => ({ objectId: PROMISES[id].worldObjectId, actionId: `promise:${id}` }));
  }
  if (state.dayIndex === 7) return [{ objectId: 'pitch-prep', actionId: 'episode-funding' }];
  if (state.dayIndex === 8) return [{ objectId: 'guest-gate', actionId: 'episode-offer' }];
  if (state.dayIndex === 9) return [{ objectId: 'match-center', actionId: 'episode-match' }];
  return [];
}
```

`rebuildWorldObjects()` may expose more than one mainline target on promise days. An object label must name the person/action, not “处理主线”。

- [ ] **Step 3: Render story scenes and the two-slot promise picker**

`renderStoryScene()` must:

- show at most the current three short beats;
- assign portrait and prop classes from scene data;
- render plain-language buttons from the scene;
- for `seven-bib`, render three request buttons with two physical slot markers;
- disable “把这两件事答应下来” until exactly two distinct promises are selected;
- display the unselected owner’s immediate response after confirmation.

Use event delegation on `[data-story-options]` and `[data-promise-picker]`; never attach new listeners on every render.

The renderer starts from this single data path:

```js
function renderStoryScene() {
  storyScene.hidden = !activeStoryScene;
  if (!activeStoryScene) return;
  const scene = getStoryScene(activeStoryScene);
  storyScene.dataset.scene = scene.id;
  storyPortrait.className = `story-portrait portrait-${scene.portraitId}`;
  storyProp.dataset.prop = scene.propId;
  storySpeaker.textContent = scene.speaker;
  storyBeats.innerHTML = scene.beats.map(beat => `<p>${beat}</p>`).join('');
  storyOptions.innerHTML = scene.choices.map(choice => (
    `<button type="button" data-story-choice="${choice.id}">${choice.label}</button>`
  )).join('');
}
```

- [ ] **Step 4: Render and complete all three active activities**

- Training: reuse the existing timing track, change its copy from shooting to three passes, and call `takePass()` for each click or `E` press.
- Fundraiser: render the current customer request and the three existing item buttons; wrong items show an inline response but do not advance.
- Records: show the desk prop with three accessible buttons named “查看签字”“核对日期”“翻看旧照片”; found clues remain visibly marked.
- On completion, show one character sentence, call `completeEpisodePromise(state, promiseId, payload)`, clear transient state, persist, and return to the map.
- At the fundraiser end, ask “说明这笔钱是为了小满” or “只说为了球场周赛”; map to `public` and `private`.

All activity clicks use one delegated handler:

```js
activityStage.addEventListener('click', event => {
  const pass = event.target.closest('[data-activity-pass]');
  const item = event.target.closest('[data-fundraiser-item]');
  const clue = event.target.closest('[data-archive-clue]');
  if (pass) activeEpisodeActivity = takePass(activeEpisodeActivity, activityPointer);
  if (item) activeEpisodeActivity = serveFundraiser(activeEpisodeActivity, item.dataset.fundraiserItem);
  if (clue) activeEpisodeActivity = inspectArchiveClue(activeEpisodeActivity, clue.dataset.archiveClue);
  finishEpisodeActivityIfReady();
  render();
});
```

- [ ] **Step 5: Render Friday funding and secondary ledger**

The funding options are:

```js
[
  { id: 'pay-lights', label: '先把灯修好', detail: '亲口告诉小满，下一周暂时付不起' },
  { id: 'protect-work', label: '先让他留下', detail: '比赛必须在天黑前结束' },
  { id: 'shen-advance', label: '接受沈峤垫款', detail: '两件事都办，他取得书面干预权' },
  ...(state.episode.fundraisingTotal >= 48
    ? [{ id: 'pay-both', label: '把两笔钱都付清', detail: '社区已经筹够这次缺口' }]
    : [])
]
```

The ledger toggle opens the old five metrics plus cash entries in the notes panel; it is never the first content on screen.

- [ ] **Step 6: Run pure tests and manual module load**

Run:

```bash
node --test prototypes/integrated-day/*.test.mjs
node -e "import('./prototypes/integrated-day/game.js').catch(error => { if (!/document is not defined/.test(error.message)) throw error })"
```

Expected: all pure tests PASS; Node import reaches the expected browser-only `document` boundary with no syntax error.

- [ ] **Step 7: Commit**

```bash
git add prototypes/integrated-day/game.js
git commit -m "feat: make first week promises playable"
```

### Task 9: 完成周六反转、比赛回响和五把椅子会议

**Files:**
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/styles.css`

**Interfaces:**
- Consumes: `getAvailableHighlights()`, `acknowledgeShenOffer()`, `completeEpisodeHearing()`.
- Produces a character-first `week-summary` containing `xiaomanDecision`, `missedCopy`, `shenAdvantage`, `nextCrisis`.

- [ ] **Step 1: Render the Saturday offer as a non-fake dilemma**

The scene must show:

- 沈峤的真实岗位：澜岸运动中心青年活动助理，固定排班、当月发薪。
- 旧球员证 if `truthKnown`; otherwise Shen reveals it himself.
- 小满’s line: “你们商量了一周谁要我，有没有人问过我想去哪里？”
- One continue action only. The player cannot accept or reject for him.

Calling `acknowledgeShenOffer()` changes `shenOffer` from `undecided` to `considering` and completes Spring 20.

- [ ] **Step 2: Render match choices from weekday history**

`renderMatchPanel()` uses `getAvailableHighlights(match, state.episode)`. Each option detail explains the human consequence:

- `repeat-practice`: “提醒小满，你们已经一起做过这件事”。
- `ask-xiaoman`: “把是否继续的决定交还给他”。
- `replace-xiaoman`: “立刻停止压力，也可能让他觉得自己再次被放弃”。
- closing choices explain shared risk, not attack/defense effects.

After highlight three, keep the scoreboard visible for one beat, resolve `xiaomanDecision`, then open the hearing instead of completing the week immediately.

- [ ] **Step 3: Add the five-chair hearing**

Use the generated chair panel as the scene prop. Show Xiaoman’s decision first, then render exactly three governance choices:

```js
[
  { id: 'manager-signs', label: '以后由经营人签字', detail: '责任清楚，但安若童独自承担决定' },
  { id: 'coach-decides', label: '人员安排交给教练', detail: '专业边界明确，经营方不能临时改名单' },
  { id: 'five-party-week', label: '试行一周共同讨论', detail: '五方都能发言，也可能把争吵拖得更长' }
]
```

Do not style the third option as recommended. After selection, call `completeEpisodeHearing()` and only then settle the week.

- [ ] **Step 4: Replace numeric-first week settlement**

Render in this order:

1. `小满：` his own decision sentence.
2. `没有来得及：` the missed request and owner response.
3. `沈峤：` advantage gained or lost.
4. `下周：` one concrete continuation crisis.
5. Score and the five numeric metrics in a collapsible secondary section.

Use these exact Xiaoman result sentences:

```js
const xiaomanCopy = {
  'stay-trial': '我想按自己的条件再留一周。下一次讨论我时，我要在场。',
  'accept-shen': '那份工作我会去。我不是因为你们说我不够好才走。'
};
```

- [ ] **Step 5: Run all unit tests**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: every pure test PASS.

- [ ] **Step 6: Commit**

```bash
git add prototypes/integrated-day/game.js prototypes/integrated-day/index.html prototypes/integrated-day/styles.css
git commit -m "feat: close the week with the five chair hearing"
```

### Task 10: 重写浏览器冒烟测试并完成双路线视觉验收

**Files:**
- Modify: `prototypes/integrated-day/smoke-test.mjs`
- Modify: `prototypes/integrated-day/README.md`

**Interfaces:**
- Verifies two materially different episode paths without depending on hidden implementation details beyond `window.__integratedDayDebug.getState()`.

- [ ] **Step 1: Replace old seven-decision smoke helpers**

Add helpers:

```js
async function choosePromises(ids) {
  for (const id of ids) await click(`[data-promise-id="${id}"]`);
  await click('[data-confirm-promises]');
}

async function finishPassActivity() {
  for (let index = 0; index < 3; index += 1) await click('[data-activity-pass]');
}

async function finishArchiveActivity() {
  for (const clue of ['signature', 'date', 'photo']) await click(`[data-archive-clue="${clue}"]`);
}

async function finishFundraiser(mode) {
  for (const item of ['fruit', 'tea', 'towel']) await click(`[data-fundraiser-item="${item}"]`);
  await click(`[data-fundraising-mode="${mode}"]`);
}
```

- [ ] **Step 2: Add the “stay trial” route**

Flow:

- Directly enter management week.
- Acknowledge blank notice.
- Choose `train + records`.
- Complete pass and archive activities.
- Choose `protect-work` Friday.
- Continue through Shen offer.
- Choose `repeat-practice`, `ask-xiaoman`, `share-responsibility`.
- Choose `five-party-week`.
- Assert `xiaomanDecision === 'stay-trial'`, `missedRequest === 'fundraise'`, truth known, four props seen, and week summary visible.

- [ ] **Step 3: Add the “accept offer” route after a fresh save**

Flow:

- Choose `fundraise + records`.
- Fundraise publicly, complete archive.
- Choose `shen-advance` Friday.
- Choose `steady-everyone`, `replace-xiaoman`, `keep-result`.
- Choose `manager-signs`.
- Assert `xiaomanDecision === 'accept-shen'`, `missedRequest === 'train'`, Shen influence increased, and the summary does not call it a game-over or failure.

- [ ] **Step 4: Add viewport, accessibility and console checks**

At 1440 x 900 and 390 x 844, call `assertInsideViewport()` for:

- `[data-weekly-care]`
- `[data-story-scene]`
- `[data-promise-picker]`
- `[data-episode-activity]`
- `[data-match-panel]`
- `[data-hearing]`
- `[data-week-summary]`

Also assert every visible choice has non-empty text, focus can reach the first dialog action, all four memory props have a non-zero rendered background image, and `pageErrors.length === 0`.

- [ ] **Step 5: Run complete verification**

Run:

```bash
node --test prototypes/integrated-day/*.test.mjs
node prototypes/integrated-day/smoke-test.mjs
git diff --check
```

Expected: all unit tests PASS; both browser routes PASS at desktop and mobile; no console errors or whitespace failures.

- [ ] **Step 6: Inspect captured images**

Open and visually inspect:

- `/private/tmp/integrated-day-notice-desktop.png`
- `/private/tmp/integrated-day-promise-mobile.png`
- `/private/tmp/integrated-day-activity-desktop.png`
- `/private/tmp/integrated-day-hearing-desktop.png`
- `/private/tmp/integrated-day-week-summary-mobile.png`

Check character art completeness, prop crop, text contrast, button wrapping, mobile overflow, and whether the scene reads as a story moment instead of a management dashboard.

- [ ] **Step 7: Update README and commit**

README must describe the fixed weekly ritual, the two-of-three promise system, three active activities, Saturday reversal, Sunday hearing, controls and validation commands.

```bash
git add prototypes/integrated-day/smoke-test.mjs prototypes/integrated-day/README.md
git commit -m "test: verify both last roster slot outcomes"
```

## Final Acceptance

- [ ] Fresh launch clearly starts the new `last-roster-slot` week, not the old ledger week.
- [ ] A non-football player can understand every main choice from visible copy alone.
- [ ] At least two non-dialogue activities are completed in every route.
- [ ] The unchosen request visibly returns on Friday or Sunday.
- [ ] Shen’s job offer is genuinely useful and his old victimhood is visible.
- [ ] Xiaoman speaks his own decision before governance is chosen.
- [ ] All four memory props are rendered from real local art.
- [ ] Character consequences appear before score and metrics.
- [ ] Version 1 and 2 saves migrate without losing prologue money, repairs or relationships.
- [ ] Unit tests, two browser routes, desktop/mobile layout and console checks all pass.
