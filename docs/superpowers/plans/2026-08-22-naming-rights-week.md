# Naming Rights Week Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete second management week about the stadium naming-rights dispute, plus a reusable one-action-per-day free-time loop.

**Architecture:** Extend the campaign calendar through day 16, keep story copy in a focused content module, and keep all week-two transitions in a pure state module. `game-state.js` applies those transitions to the shared economy, facilities, roster, governance, and save data; `game.js` remains the DOM orchestrator and reuses the existing story, activity, match, summary, and map layers.

**Tech Stack:** Browser-native ES modules, HTML/CSS, Node.js built-in test runner, Playwright-compatible CDP smoke runner, localStorage save records.

## Global Constraints

- Preserve every playable prologue and first-week route.
- Use daily-language choices and require no football or corporate-governance expertise.
- A failed optional activity must reduce rewards but never block the mainline.
- Do not add a third map or introduce a frontend framework.
- Keep the current warm hand-painted animation style and prioritize story props over decorative portraits.
- Upgrade saves to version 4 and migrate valid version 3 records without losing progress.
- Do not make any second-week route objectively dominant; every Friday route must reach Sunday.

---

## File Map

- Create `prototypes/integrated-day/naming-rights-content.js`: days, scene beats, free-action copy, vote routes, response copy, and ending labels.
- Create `prototypes/integrated-day/naming-rights-content.test.mjs`: completeness and copy-contract tests.
- Create `prototypes/integrated-day/free-time-state.js`: pure free-action eligibility, reward, repetition, and rest transitions.
- Create `prototypes/integrated-day/free-time-state.test.mjs`: free-action state-machine tests.
- Create `prototypes/integrated-day/naming-rights-state.js`: pure second-week story, vote, reveal, match, and settlement transitions.
- Create `prototypes/integrated-day/naming-rights-state.test.mjs`: all three route tests and invalid-transition tests.
- Create `prototypes/integrated-day/assets/naming-rights-memory-strip-v1.png`: one aligned hand-painted strip containing the contract, ballots, scratched plaque, half photo, and three sign outcomes.
- Modify `prototypes/integrated-day/campaign-content.js`: append campaign days 10 through 16 and expose a week-two predicate.
- Modify `prototypes/integrated-day/campaign-content.test.mjs`: calendar assertions for both management weeks.
- Modify `prototypes/integrated-day/game-state.js`: initialize, clone, apply, and advance week-two state while updating shared metrics.
- Modify `prototypes/integrated-day/game-state.test.mjs`: full canonical second-week state path.
- Modify `prototypes/integrated-day/save-game.js`: version 4 validation/read/write and version 3 migration routing.
- Modify `prototypes/integrated-day/save-migration.js`: add `migrateV3Record`.
- Modify `prototypes/integrated-day/save-game.test.mjs`: current-save validation and interrupted activity handling.
- Modify `prototypes/integrated-day/save-migration.test.mjs`: version 3 migration coverage.
- Modify `prototypes/integrated-day/world-content.js`: week-two action locations and stadium-sign state.
- Modify `prototypes/integrated-day/world-content.test.mjs`: action-location and sign assertions.
- Modify `prototypes/integrated-day/index.html`: free-time chooser, naming ballot, reveal summary, updated week-one continuation, and cache versions.
- Modify `prototypes/integrated-day/styles.css`: responsive free-time, ballot, sign, and memory-prop presentation.
- Modify `prototypes/integrated-day/game.js`: render and event orchestration for days 10 through 16.
- Modify `prototypes/integrated-day/smoke-test.mjs`: first-week-to-second-week happy path, alternate route state check, and mobile viewport checks.
- Modify `prototypes/integrated-day/README.md`: describe the two-week playable build and controls.

---

### Task 1: Extend the calendar and lock the second-week story contract

**Files:**
- Create: `prototypes/integrated-day/naming-rights-content.js`
- Create: `prototypes/integrated-day/naming-rights-content.test.mjs`
- Modify: `prototypes/integrated-day/campaign-content.js`
- Modify: `prototypes/integrated-day/campaign-content.test.mjs`

**Interfaces:**
- Produces: `NAMING_DAYS`, `FREE_ACTIONS`, `VOTE_ROUTES`, `REVEAL_RESPONSES`, `getNamingDay(dayIndex)`, `getFreeAction(id)`, `isNamingRightsWeekDay(dayIndex)`.
- Consumes: no game state; this task is immutable content only.

- [ ] **Step 1: Write the failing content tests**

```js
test('second week spans days 10 through 16 with a required scene every day', () => {
  assert.deepEqual(CAMPAIGN_DAYS.slice(10).map(day => day.requiredAction), [
    'naming-proposal', 'naming-chairs', 'naming-alternative',
    'naming-plaque', 'naming-vote', 'naming-response', 'naming-match'
  ]);
  assert.equal(isNamingRightsWeekDay(10), true);
  assert.equal(isNamingRightsWeekDay(17), false);
});

test('every free action and vote route has player-facing consequences', () => {
  assert.deepEqual(Object.keys(FREE_ACTIONS), ['shop', 'training', 'repair', 'community', 'rest']);
  for (const action of Object.values(FREE_ACTIONS)) assert.ok(action.resultCopy.length > 20);
  assert.deepEqual(Object.keys(VOTE_ROUTES), ['co-name', 'community-save', 'delay']);
});
```

- [ ] **Step 2: Run the focused tests and confirm the new exports are missing**

Run: `node --test prototypes/integrated-day/campaign-content.test.mjs prototypes/integrated-day/naming-rights-content.test.mjs`

Expected: FAIL because `naming-rights-content.js` and `isNamingRightsWeekDay` do not exist.

- [ ] **Step 3: Add the seven campaign days and immutable story content**

```js
export const NAMING_DAYS = Object.freeze([
  { dayIndex: 10, sceneId: 'blue-banner', title: '蓝布盖住了旧名字', requiredAction: 'naming-proposal', freeAction: false },
  { dayIndex: 11, sceneId: 'five-conditions', title: '五把椅子，五种条件', requiredAction: 'naming-chairs', freeAction: true },
  { dayIndex: 12, sceneId: 'another-way', title: '救命钱不是唯一的钱', requiredAction: 'naming-alternative', freeAction: true },
  { dayIndex: 13, sceneId: 'scratched-name', title: '被刮掉的名字', requiredAction: 'naming-plaque', freeAction: true },
  { dayIndex: 14, sceneId: 'first-vote', title: '第一次真正表决', requiredAction: 'naming-vote', freeAction: false },
  { dayIndex: 15, sceneId: 'half-photo', title: '沈峤的半张合照', requiredAction: 'naming-response', freeAction: true },
  { dayIndex: 16, sceneId: 'under-the-sign', title: '招牌下的比赛', requiredAction: 'naming-match', freeAction: false }
]);

export const FREE_ACTIONS = Object.freeze({
  shop: { label: '去场边小店', fund: 22, community: 1, cohesion: 0, facility: 0, signatures: 2 },
  training: { label: '陪球队训练', fund: 0, community: 0, cohesion: 4, facility: 0, signatures: 0 },
  repair: { label: '修一处球场', fund: 0, community: 1, cohesion: 0, facility: 5, signatures: 1 },
  community: { label: '开放社区时段', fund: 8, community: 5, cohesion: 1, facility: 0, signatures: 8 },
  rest: { label: '今天早点回去', fund: 0, community: 0, cohesion: 0, facility: 0, signatures: 0 }
});
```

Fill the same module with the exact scene beats, labels, captions, and consequences from the approved design, including explicit acknowledgement that沈峤 was erased from the founding history.

- [ ] **Step 4: Run the focused tests**

Run: `node --test prototypes/integrated-day/campaign-content.test.mjs prototypes/integrated-day/naming-rights-content.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the calendar and content contract**

```bash
git add prototypes/integrated-day/campaign-content.js prototypes/integrated-day/campaign-content.test.mjs prototypes/integrated-day/naming-rights-content.js prototypes/integrated-day/naming-rights-content.test.mjs
git commit -m "feat: add the naming rights week story"
```

---

### Task 2: Build the reusable free-time state machine

**Files:**
- Create: `prototypes/integrated-day/free-time-state.js`
- Create: `prototypes/integrated-day/free-time-state.test.mjs`

**Interfaces:**
- Consumes: `getFreeAction(id)` from `naming-rights-content.js`.
- Produces: `createFreeTimeState()`, `canTakeFreeAction(freeTime, dayIndex)`, `startFreeAction(freeTime, dayIndex, actionId)`, `finishFreeAction(freeTime, result)`, and `getFreeActionTotals(freeTime)`.
- `result` shape: `{ score: number, evidence?: boolean }`.

- [ ] **Step 1: Write failing transition tests**

```js
test('one action per eligible day produces persistent rewards', () => {
  let freeTime = createFreeTimeState();
  freeTime = startFreeAction(freeTime, 11, 'shop');
  freeTime = finishFreeAction(freeTime, { score: 1 });
  assert.equal(freeTime.records[0].fund, 22);
  assert.equal(canTakeFreeAction(freeTime, 11), false);
});

test('repeating an action on consecutive days softens the second reward', () => {
  let freeTime = finishFreeAction(startFreeAction(createFreeTimeState(), 11, 'community'), { score: 1 });
  freeTime = finishFreeAction(startFreeAction(freeTime, 12, 'community'), { score: 1 });
  assert.equal(freeTime.records[1].repeated, true);
  assert.ok(freeTime.records[1].community < freeTime.records[0].community);
});

test('rest records recovery without creating campaign resources', () => {
  const freeTime = finishFreeAction(startFreeAction(createFreeTimeState(), 13, 'rest'), { score: 1 });
  assert.deepEqual(getFreeActionTotals(freeTime), { fund: 0, community: 0, cohesion: 0, facility: 0, signatures: 0, evidence: 0 });
});
```

- [ ] **Step 2: Run the test and confirm the state module is missing**

Run: `node --test prototypes/integrated-day/free-time-state.test.mjs`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement immutable action transitions and validation**

```js
export function createFreeTimeState() {
  return { available: false, activeAction: null, records: [] };
}

export function startFreeAction(state, dayIndex, actionId) {
  if (!Number.isInteger(dayIndex) || !getFreeAction(actionId)) throw new TypeError('Invalid free action');
  if (!canTakeFreeAction(state, dayIndex) || state.activeAction) throw new Error('Free action unavailable');
  return { ...state, activeAction: { dayIndex, actionId } };
}

export function finishFreeAction(state, { score = 0, evidence = false } = {}) {
  if (!state.activeAction) throw new Error('No active free action');
  const action = getFreeAction(state.activeAction.actionId);
  const previous = state.records.at(-1);
  const repeated = previous?.actionId === state.activeAction.actionId;
  const quality = Math.max(0.5, Math.min(1, Number(score) || 0.5));
  const multiplier = repeated ? 0.75 : 1;
  const reward = key => Math.round(action[key] * quality * multiplier);
  const record = { ...state.activeAction, repeated, fund: reward('fund'), community: reward('community'), cohesion: reward('cohesion'), facility: reward('facility'), signatures: reward('signatures'), evidence: evidence ? 1 : 0 };
  return { available: false, activeAction: null, records: [...state.records, record] };
}
```

Implement `canTakeFreeAction` so only days 11, 12, 13, and 15 accept one action. Aggregate records in `getFreeActionTotals` without mutating them.

- [ ] **Step 4: Run the free-time tests**

Run: `node --test prototypes/integrated-day/free-time-state.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the reusable loop state**

```bash
git add prototypes/integrated-day/free-time-state.js prototypes/integrated-day/free-time-state.test.mjs
git commit -m "feat: add reusable free time actions"
```

---

### Task 3: Build the naming-rights episode state and route consequences

**Files:**
- Create: `prototypes/integrated-day/naming-rights-state.js`
- Create: `prototypes/integrated-day/naming-rights-state.test.mjs`

**Interfaces:**
- Consumes: `createFreeTimeState()` and `getFreeActionTotals()`.
- Produces: `createNamingRightsState()`, `completeNamingScene(state, sceneId)`, `chooseNamingVote(state, routeId)`, `chooseNamingResponse(state, responseId)`, `startNamingMatch(state)`, `resolveNamingHighlight(state, choiceId)`, and `settleNamingWeek(state)`.
- Settlement shape: `{ route, stadiumName, authority, shenPosition, score, callbacks, nextCrisis }`.

- [ ] **Step 1: Write failing route and threshold tests**

```js
test('community save unlocks only after visible local support', () => {
  let episode = createNamingRightsState();
  assert.throws(() => chooseNamingVote(episode, 'community-save'), /not unlocked/i);
  episode.freeTime.records = [
    { actionId: 'shop', fund: 22, community: 1, cohesion: 0, facility: 0, signatures: 2, evidence: 0 },
    { actionId: 'community', fund: 8, community: 5, cohesion: 1, facility: 0, signatures: 8, evidence: 0 },
    { actionId: 'shop', fund: 17, community: 1, cohesion: 0, facility: 0, signatures: 2, evidence: 0 }
  ];
  assert.equal(getAvailableVoteRoutes(episode).find(route => route.id === 'community-save').disabled, false);
});

test('each vote route creates a different public sign and authority result', () => {
  const expected = {
    'co-name': ['澜岸·海风球场', '赞助方获得一个运营否决席位'],
    'community-save': ['海风球场', '五把椅子保留最终决定权'],
    delay: ['海风球场', '临时委员会只保住了本周']
  };
  for (const [route, [stadiumName, authority]] of Object.entries(expected)) {
    const state = completedEpisodeFor(route);
    const settlement = settleNamingWeek(state);
    assert.equal(settlement.stadiumName, stadiumName);
    assert.equal(settlement.authority, authority);
  }
});
```

- [ ] **Step 2: Run the test and confirm the episode module is missing**

Run: `node --test prototypes/integrated-day/naming-rights-state.test.mjs`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement guarded story, route, response, and three-highlight transitions**

```js
export function createNamingRightsState() {
  return {
    id: 'naming-rights', sceneHistory: [], freeTime: createFreeTimeState(),
    voteRoute: null, response: null, shenPosition: 'pressing', match: null,
    settlement: null, weekComplete: false
  };
}

export function chooseNamingVote(state, routeId) {
  const route = getAvailableVoteRoutes(state).find(item => item.id === routeId);
  if (!route || route.disabled) throw new Error('Vote route not unlocked');
  return { ...cloneNamingRightsState(state), voteRoute: routeId, sceneHistory: [...state.sceneHistory, 'first-vote'] };
}
```

Implement three deterministic match highlights that expose one callback from free actions, one from the vote route, and one from the response to沈峤. Every route must reach a settlement even after low activity scores.

- [ ] **Step 4: Run the episode tests**

Run: `node --test prototypes/integrated-day/naming-rights-state.test.mjs`

Expected: PASS for community threshold, three distinct outcomes, response behavior, and match completion.

- [ ] **Step 5: Commit the second-week state machine**

```bash
git add prototypes/integrated-day/naming-rights-state.js prototypes/integrated-day/naming-rights-state.test.mjs
git commit -m "feat: model the naming rights conflict"
```

---

### Task 4: Integrate shared progression and version 4 saves

**Files:**
- Modify: `prototypes/integrated-day/game-state.js`
- Modify: `prototypes/integrated-day/game-state.test.mjs`
- Modify: `prototypes/integrated-day/save-game.js`
- Modify: `prototypes/integrated-day/save-game.test.mjs`
- Modify: `prototypes/integrated-day/save-migration.js`
- Modify: `prototypes/integrated-day/save-migration.test.mjs`

**Interfaces:**
- Consumes: all Task 2 and Task 3 transition functions.
- Produces: `beginNamingRightsWeek(state)`, `completeNamingMainline(state, actionId, choiceId)`, `startNamingFreeAction(state, actionId)`, `finishNamingFreeAction(state, result)`, `startSecondWeeklyMatch(state)`, `resolveSecondWeeklyMatchChoice(state, choiceId)`, and `advanceCampaignDay(state)` through day 16.

- [ ] **Step 1: Write failing integration and migration tests**

```js
test('first week settlement advances into the naming proposal', () => {
  const firstWeek = completedFirstWeekState();
  const secondWeek = beginNamingRightsWeek(firstWeek);
  assert.equal(secondWeek.version, 4);
  assert.equal(secondWeek.dayIndex, 10);
  assert.equal(secondWeek.campaign.week, 2);
  assert.equal(secondWeek.namingRights.id, 'naming-rights');
});

test('a version 3 completed-week record migrates without losing its settlement', () => {
  const migrated = migrateV3Record(versionThreeRecord({ weekComplete: true }));
  assert.equal(migrated.version, 4);
  assert.equal(migrated.state.management.weekComplete, true);
  assert.equal(migrated.state.namingRights.id, 'naming-rights');
});
```

- [ ] **Step 2: Run focused integration tests and confirm version 4 is unsupported**

Run: `node --test prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.test.mjs prototypes/integrated-day/save-migration.test.mjs`

Expected: FAIL on missing week-two functions and save version mismatch.

- [ ] **Step 3: Add week-two state integration and shared metric rewards**

```js
export function finishNamingFreeAction(state, result) {
  const next = copyState(state);
  const before = getFreeActionTotals(next.namingRights.freeTime);
  next.namingRights.freeTime = finishFreeAction(next.namingRights.freeTime, result);
  const after = getFreeActionTotals(next.namingRights.freeTime);
  next.economy = postLedgerEntry(next.economy, { id: `self-rescue-${next.dayIndex}`, label: '海风自救箱', amount: after.fund - before.fund });
  next.communitySupport = Math.min(100, next.communitySupport + after.community - before.community);
  next.roster.cohesion = Math.min(100, next.roster.cohesion + after.cohesion - before.cohesion);
  next.facilities.condition = Math.min(100, next.facilities.condition + after.facility - before.facility);
  next.phase = 'complete';
  return next;
}
```

Clone every nested `namingRights` array/object in `copyState`. `completeNamingMainline` must open free time on days 11, 12, 13, and 15, and finish the day directly on days 10 and 14. Apply route cash and influence only once.

- [ ] **Step 4: Upgrade validation, migration, and interrupted-action recovery**

```js
export const SAVE_KEY = 'seabreeze-club-save-v4';
export const V3_SAVE_KEY = 'seabreeze-club-save-v3';

export function migrateV3Record(record) {
  if (record?.version !== 3 || record?.state?.version !== 3) throw new TypeError('Unsupported version three save');
  const base = createGameState();
  return {
    version: 4,
    state: { ...record.state, version: 4, namingRights: base.namingRights },
    position: { ...record.position },
    mapId: record.mapId
  };
}
```

Validate `namingRights.id`, its arrays, route strings, match shape, and both world positions. On load, clear `freeTime.activeAction` without deleting completed records.

- [ ] **Step 5: Run all pure tests**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: all tests PASS, including existing prologue and first-week assertions.

- [ ] **Step 6: Commit progression and saves**

```bash
git add prototypes/integrated-day/game-state.js prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.js prototypes/integrated-day/save-game.test.mjs prototypes/integrated-day/save-migration.js prototypes/integrated-day/save-migration.test.mjs
git commit -m "feat: connect the second week to campaign saves"
```

---

### Task 5: Add the free-time locations and memory objects

**Files:**
- Create: `prototypes/integrated-day/assets/naming-rights-memory-strip-v1.png`
- Modify: `prototypes/integrated-day/world-content.js`
- Modify: `prototypes/integrated-day/world-content.test.mjs`
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/styles.css`

**Interfaces:**
- Consumes: current map definitions and `state.namingRights`.
- Produces: world objects with action IDs `free:shop`, `free:training`, `free:repair`, `free:community`, and `free:rest`; DOM hooks `[data-free-time-panel]`, `[data-naming-ballot]`, `[data-naming-summary]`, and `[data-stadium-sign]`.

- [ ] **Step 1: Write failing world-content tests**

```js
test('second-week free time exposes four places and a rest point', () => {
  const objects = getWorldObjects('stadium', { dayIndex: 12, namingRights: namingStateWithFreeTime() });
  assert.deepEqual(objects.filter(item => item.actionId?.startsWith('free:')).map(item => item.actionId).sort(), [
    'free:community', 'free:repair', 'free:rest', 'free:shop', 'free:training'
  ]);
});
```

- [ ] **Step 2: Run the focused test and confirm the locations are absent**

Run: `node --test prototypes/integrated-day/world-content.test.mjs`

Expected: FAIL because no `free:*` objects are returned.

- [ ] **Step 3: Add contextual world objects and the visible sign layer**

```html
<div class="stadium-name-layer" data-stadium-sign data-sign="covered" aria-label="旧球场招牌被蓝色冠名布盖住">
  <span class="old-name">海风球场</span>
  <span class="sponsor-cloth">澜岸体育</span>
</div>
```

Only render free-time action targets after the day's fixed scene is complete. Keep all coordinates inside existing walkable stadium areas and use the current click-to-walk behavior.

- [ ] **Step 4: Create and wire the aligned memory strip**

Generate one transparent or flat-background sprite strip in the current warm hand-painted animation style. Include the blue contract, five folded paper ballots, scratched founder plaque, half photograph, old 海风 sign, 联合冠名 sign, and covered sign as separated cells. Use `background-position` selectors for story props and the week summary.

- [ ] **Step 5: Style panels and sign at desktop and mobile sizes**

```css
.stadium-name-layer { position: absolute; left: 39%; top: 12%; z-index: 7; transform: rotate(-1deg); }
.sponsor-cloth { display: block; padding: 7px 20px; color: #eaf6f5; background: #285d72; box-shadow: 0 8px 18px rgb(20 42 48 / 24%); }
.free-time-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 700px) { .free-time-options { grid-template-columns: 1fr; } }
```

Ensure focus states, 44-pixel touch targets, readable contrast, panel scrolling, and no overlap with mobile controls.

- [ ] **Step 6: Run tests and commit the world/UI shell**

Run: `node --test prototypes/integrated-day/world-content.test.mjs`

Expected: PASS.

```bash
git add prototypes/integrated-day/assets/naming-rights-memory-strip-v1.png prototypes/integrated-day/world-content.js prototypes/integrated-day/world-content.test.mjs prototypes/integrated-day/index.html prototypes/integrated-day/styles.css
git commit -m "feat: stage the naming rights week in the stadium"
```

---

### Task 6: Wire the seven-day story and active free-time play

**Files:**
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/styles.css`

**Interfaces:**
- Consumes: Task 4 game-state facade and Task 5 DOM hooks.
- Produces: complete interactive flow from `[data-begin-naming-week]` through the Friday ballot and Saturday response.

- [ ] **Step 1: Add one continuation control and generic week summary copy**

```html
<button data-begin-naming-week type="button">进入第二个经营周</button>
```

Show it only after first-week settlement. Keep “继续在球场走走” as a secondary option. Change static “第一周结算” labels into data-bound labels so the same panel can present the second-week ending.

- [ ] **Step 2: Route campaign objectives and story content by campaign day**

```js
function isNamingWeek() {
  return isNamingRightsWeekDay(state.dayIndex);
}

function renderCurrentStory() {
  if (isNamingWeek()) return renderNamingStory(getNamingDay(state.dayIndex));
  return renderFirstWeekStory();
}
```

Render all scene beats as short speaker-attributed lines, assign the correct memory prop, and expose only the valid action for that scene. The Friday panel must explain why a disabled community route is unavailable by showing current fund and signature totals.

- [ ] **Step 3: Wire four active activities and rest**

```js
function openFreeAction(actionId) {
  state = startNamingFreeAction(state, actionId);
  if (actionId === 'rest') return finishCurrentFreeAction({ score: 1 });
  activitySession = createNamingActivitySession(actionId);
  renderNamingActivity();
}
```

Reuse the current order-button language for shop, timing taps for training, three visible hotspot repairs for facility care, and three resident-request choices for community. Each activity must call `finishNamingFreeAction` with a normalized score; close buttons leave the action unspent.

- [ ] **Step 4: Wire vote and response choices with immediate physical feedback**

```js
if (actionId.startsWith('vote:')) state = completeNamingMainline(state, 'naming-vote', actionId.slice(5));
if (actionId.startsWith('response:')) state = completeNamingMainline(state, 'naming-response', actionId.slice(9));
```

After the Friday vote, update `[data-stadium-sign]` to covered, co-name, or old-name pending. After Saturday response, update沈峤's world dialogue and presence.

- [ ] **Step 5: Run all pure tests and manually walk days 10 through 15**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: all tests PASS. In the browser, each mainline scene must end once, only one optional action can be spent per eligible day, and reloading must return to the same day.

- [ ] **Step 6: Commit the playable weekdays**

```bash
git add prototypes/integrated-day/game.js prototypes/integrated-day/index.html prototypes/integrated-day/styles.css
git commit -m "feat: make the naming rights weekdays playable"
```

---

### Task 7: Complete Sunday callbacks, sign reveal, and second-week ending

**Files:**
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/styles.css`
- Modify: `prototypes/integrated-day/game-state.test.mjs`

**Interfaces:**
- Consumes: `startSecondWeeklyMatch`, `resolveSecondWeeklyMatchChoice`, and settlement fields from Task 4.
- Produces: a three-choice match flow, a public sign reveal, and a persistent two-week completion state.

- [ ] **Step 1: Add a failing canonical end-to-end state test**

```js
test('community path reveals the old name and records who decides next', () => {
  const state = playCanonicalSecondWeek({ vote: 'community-save', response: 'restore-history' });
  assert.equal(state.namingRights.weekComplete, true);
  assert.equal(state.namingRights.settlement.stadiumName, '海风球场');
  assert.equal(state.namingRights.settlement.authority, '五把椅子保留最终决定权');
  assert.equal(state.campaign.week, 2);
});
```

- [ ] **Step 2: Run the focused test and confirm settlement is not connected**

Run: `node --test prototypes/integrated-day/game-state.test.mjs`

Expected: FAIL because the Sunday wrapper does not yet write settlement to shared state.

- [ ] **Step 3: Render the second match using earned callbacks**

Use港口工人队 and present three non-technical moments: the crowd thins when the wind rises, a substitute hesitates after a mistake, and the covered sign begins to tear loose. Each choice should display which earlier action it remembers. Finish with a score, but never use winning as the gate for the public reveal.

- [ ] **Step 4: Render the sign reveal before the scoreboard**

```html
<div class="naming-reveal" data-naming-summary>
  <span>蓝布落下以后</span>
  <strong data-final-stadium-name>海风球场</strong>
  <p data-final-authority>五把椅子保留最终决定权</p>
</div>
```

Show the chosen name, current authority,沈峤's position, one remembered free action, score, shared metrics, and the next unpaid problem. Persist `weekComplete` and keep a free-walk button available.

- [ ] **Step 5: Run all pure tests and commit the ending**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: all tests PASS.

```bash
git add prototypes/integrated-day/game.js prototypes/integrated-day/index.html prototypes/integrated-day/styles.css prototypes/integrated-day/game-state.test.mjs
git commit -m "feat: reveal the stadium name after the match"
```

---

### Task 8: Verify the full playable build and update handoff docs

**Files:**
- Modify: `prototypes/integrated-day/smoke-test.mjs`
- Modify: `prototypes/integrated-day/README.md`

**Interfaces:**
- Consumes: the complete browser build.
- Produces: repeatable proof that old and new routes are playable on desktop and mobile.

- [ ] **Step 1: Extend the smoke script through the second-week canonical path**

```js
await click('[data-begin-naming-week]');
await waitFor('window.__integratedDayDebug.getState().dayIndex === 10', 'Second week did not start');
// Complete each fixed scene, spend shop/community/repair free actions,
// choose community-save, restore history, resolve three match moments.
await waitFor('window.__integratedDayDebug.getState().namingRights.weekComplete', 'Naming week did not settle');
assert((await text('[data-final-stadium-name]')).includes('海风球场'), 'The final sign was not revealed');
```

Add a state-level alternate route that selects `co-name` and confirms `澜岸·海风球场`. Capture desktop proposal, free-time choice, plaque reveal, ballot, match, and final sign; repeat overflow checks at 390 by 844.

- [ ] **Step 2: Run the complete pure suite**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: all tests PASS with no skipped test.

- [ ] **Step 3: Run the browser smoke test**

Run: `node prototypes/integrated-day/smoke-test.mjs`

Expected: PASS for first-week progression, second-week progression, save restoration, alternate naming route, desktop containment, and mobile containment. Review captures for contrast, spacing, hierarchy, overflow, and interaction focus.

- [ ] **Step 4: Update the playable-build README**

Document the prologue, two complete weeks, keyboard/touch controls, local launch method, save version, public GitHub URL, and the four free-time actions. State that later season weeks remain future content without presenting an unfinished control in the game.

- [ ] **Step 5: Inspect the final diff and commit verification**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended tracked files and the explicitly generated memory strip are staged.

```bash
git add prototypes/integrated-day/smoke-test.mjs prototypes/integrated-day/README.md
git commit -m "test: cover the complete two week campaign"
```
