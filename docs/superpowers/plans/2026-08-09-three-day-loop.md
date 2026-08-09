# Three-Day Life Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing single-day seaside club demo into a persistent three-day life-simulation slice with changing schedules, optional shooting practice, lasting repairs, relationship progression, and a chapter ending.

**Architecture:** Keep deterministic rules in small ES modules and leave DOM, input, camera, and rendering in `game.js`. Add one data-only daily content module, one storage adapter, and one pure training scorer so the three-day loop can be verified without a browser before the UI is changed.

**Tech Stack:** Static HTML, native CSS, browser ES modules, localStorage, Node.js built-in test runner, Chrome DevTools Protocol smoke test, no runtime dependencies.

## Global Constraints

- Keep the low-pressure loop. No failure timer, debt, hunger, disease meter, or permanently missed story.
- Preserve the existing hand-painted seaside map, character atlases, free movement, click-to-walk, keyboard controls, and mobile controls.
- Use spring days 12, 13, and 14 only. Do not add seasons, a second map, interiors, or a full football match.
- Persist money, inventory, repairs, coach relationship, events, history, date, phase, and a throttled player position.
- Reset energy, daily collection nodes, order progress, and training availability when a new day begins.
- A player may end the evening by repairing one new facility or explicitly saving the money.
- Training is optional, lasts three shots, and never blocks opening the shop or ending the day.
- All state transitions remain immutable and independent of browser globals.
- Support 1440x900 and 390x844 without horizontal overflow.
- Respect `prefers-reduced-motion` for the training pointer and existing ambient motion.
- Keep visible page copy free of placeholder text and em-dash or en-dash characters.

---

### Task 1: Daily Content Configuration

**Files:**
- Create: `prototypes/integrated-day/daily-content.js`
- Create: `prototypes/integrated-day/daily-content.test.mjs`

**Interfaces:**
- Consumes: no browser globals.
- Produces: `DAYS`, `getDayContent(dayIndex)`, `getOrders(dayIndex)`, and `requiredInventoryForDay(dayIndex)`.

- [ ] **Step 1: Write the failing daily-content tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS,
  getDayContent,
  getOrders,
  requiredInventoryForDay
} from './daily-content.js';

test('the slice contains three distinct spring days', () => {
  assert.deepEqual(DAYS.map(day => day.date), [12, 13, 14]);
  assert.equal(new Set(DAYS.map(day => day.weather)).size, 3);
  assert.deepEqual(DAYS.map(day => day.orders.length), [4, 4, 5]);
});

test('required stock is derived from each order list', () => {
  assert.deepEqual(requiredInventoryForDay(0), { tea: 2, fruit: 1, cloth: 1, water: 3 });
  assert.deepEqual(requiredInventoryForDay(1), { tea: 1, fruit: 2, cloth: 1, water: 3 });
  assert.deepEqual(requiredInventoryForDay(2), { tea: 2, fruit: 2, cloth: 1, water: 4 });
});

test('day access is clamped to the three-day chapter', () => {
  assert.equal(getDayContent(-1).date, 12);
  assert.equal(getDayContent(99).date, 14);
  assert.equal(getOrders(1)[0].recipe, 'fruit');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test prototypes/integrated-day/daily-content.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `daily-content.js`.

- [ ] **Step 3: Implement the three-day content table**

```js
export const DAYS = Object.freeze([
  {
    season: '春', date: 12, weather: '海风转晴', title: '抵达',
    trainingAvailable: false,
    orders: [
      { customer: '林川', recipe: 'tea', item: '青草茶', price: 9 },
      { customer: '许姨', recipe: 'towel', item: '干净毛巾', price: 8 },
      { customer: '乔可', recipe: 'fruit', item: '果子水', price: 12 },
      { customer: '邓叔', recipe: 'tea', item: '青草茶', price: 9 }
    ]
  },
  {
    season: '春', date: 13, weather: '风大有云', title: '一起训练',
    trainingAvailable: true,
    orders: [
      { customer: '乔可', recipe: 'fruit', item: '果子水', price: 12 },
      { customer: '林川', recipe: 'tea', item: '青草茶', price: 9 },
      { customer: '许姨', recipe: 'towel', item: '干净毛巾', price: 8 },
      { customer: '小满', recipe: 'fruit', item: '果子水', price: 12 }
    ]
  },
  {
    season: '春', date: 14, weather: '晴，午后海风', title: '友谊赛日',
    trainingAvailable: true,
    orders: [
      { customer: '林川', recipe: 'tea', item: '青草茶', price: 9 },
      { customer: '乔可', recipe: 'fruit', item: '果子水', price: 12 },
      { customer: '许姨', recipe: 'towel', item: '干净毛巾', price: 8 },
      { customer: '小满', recipe: 'fruit', item: '果子水', price: 12 },
      { customer: '郭教练', recipe: 'tea', item: '青草茶', price: 9 }
    ]
  }
]);
```

Add recipe-cost aggregation for `requiredInventoryForDay()` using the existing recipe keys `tea`, `fruit`, and `towel`.

```js
const RECIPE_COSTS = Object.freeze({
  tea: { tea: 1, water: 1 },
  fruit: { fruit: 1, water: 1 },
  towel: { cloth: 1 }
});

export function requiredInventoryForDay(dayIndex) {
  const required = { tea: 0, fruit: 0, cloth: 0, water: 0 };
  for (const order of getOrders(dayIndex)) {
    for (const [key, amount] of Object.entries(RECIPE_COSTS[order.recipe])) {
      required[key] += amount;
    }
  }
  return required;
}
```

- [ ] **Step 4: Run the daily-content tests**

Run: `node --test prototypes/integrated-day/daily-content.test.mjs`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the content module**

```bash
git add prototypes/integrated-day/daily-content.js prototypes/integrated-day/daily-content.test.mjs
git commit -m "feat: add three-day club schedule"
```

---

### Task 2: Multi-Day Domain State

**Files:**
- Modify: `prototypes/integrated-day/game-state.js`
- Modify: `prototypes/integrated-day/game-state.test.mjs`

**Interfaces:**
- Consumes: `getDayContent()`, `getOrders()`, and `requiredInventoryForDay()` from Task 1.
- Produces: `createGameState()`, `collectItem()`, `talkToCoach()`, `startTraining()`, `finishTraining()`, `openShop()`, `serveOrder()`, `buyRepair()`, `chooseSaveMoney()`, `finishDay()`, and `advanceDay()`.

- [ ] **Step 1: Replace the single-day tests with multi-day failing tests**

```js
import { getOrders } from './daily-content.js';

function gatherAll(state) {
  for (const itemId of ['tea-a', 'tea-b', 'fruit-a', 'fruit-b']) {
    state = collectItem(state, itemId);
  }
  return state;
}

function serveAllOrders(state) {
  for (const order of getOrders(state.dayIndex)) {
    state = serveOrder(state, order.recipe);
  }
  return state;
}

function reachEvening(state) {
  state = gatherAll(state);
  state = openShop(state);
  return serveAllOrders(state);
}

function completeCurrentDay(state, choice) {
  state = reachEvening(state);
  state = choice === 'save' ? chooseSaveMoney(state) : buyRepair(state, choice);
  return finishDay(state);
}

test('repairs, money, stock, and relationship survive a new day', () => {
  let state = gatherAll(createGameState());
  state = talkToCoach(state);
  state = openShop(state);
  state = serveAllOrders(state);
  state = buyRepair(state, 'awning');
  state = finishDay(state);
  state = advanceDay(state);

  assert.equal(state.dayIndex, 1);
  assert.equal(state.phase, 'morning');
  assert.deepEqual(state.repairs, ['awning']);
  assert.equal(state.money, 20);
  assert.equal(state.relationship.coachMet, true);
  assert.equal(state.energy, 100);
  assert.deepEqual(state.collectedToday, []);
  assert.equal(state.ordersServed, 0);
});

test('training can complete once per available day', () => {
  let state = { ...createGameState(), dayIndex: 1 };
  state = startTraining(state);
  state = finishTraining(state, 5);
  const completed = state;
  state = startTraining(state);

  assert.equal(completed.training.completedToday, true);
  assert.equal(completed.training.lastScore, 5);
  assert.equal(completed.relationship.coachTrust, 1);
  assert.equal(completed.energy, 92);
  assert.equal(state.training.started, false);
});

test('saving money is a valid evening choice', () => {
  let state = reachEvening(createGameState());
  state = chooseSaveMoney(state);
  state = finishDay(state);
  assert.equal(state.phase, 'complete');
  assert.equal(state.eveningChoice, 'save');
});

test('the third day ends the chapter with three history entries', () => {
  let state = createGameState();
  for (let day = 0; day < 3; day += 1) {
    state = completeCurrentDay(state, day === 0 ? 'awning' : 'save');
    if (day < 2) state = advanceDay(state);
  }
  state = advanceDay(state);
  assert.equal(state.chapterComplete, true);
  assert.equal(state.history.length, 3);
  assert.equal(state.dayIndex, 2);
});
```

Keep coverage for duplicate collection, incorrect recipes, insufficient money, and duplicate repairs.

- [ ] **Step 2: Run the state tests and verify the old API fails**

Run: `node --test prototypes/integrated-day/game-state.test.mjs`

Expected: FAIL because `createGameState`, training transitions, and `advanceDay` do not exist.

- [ ] **Step 3: Implement the versioned game state and immutable transitions**

```js
export function createGameState() {
  return {
    version: 1,
    dayIndex: 0,
    phase: 'morning',
    minute: 550,
    energy: 100,
    money: 0,
    inventory: { tea: 0, fruit: 0, cloth: 2, water: 4 },
    collectedToday: [],
    ordersServed: 0,
    repairs: [],
    eveningChoice: null,
    relationship: { coachMet: false, coachTrust: 0 },
    training: { started: false, completedToday: false, lastScore: null },
    events: [],
    journal: [{ kind: 'arrival', text: '今天没有必须完成的事。', minute: 550 }],
    history: [],
    chapterComplete: false
  };
}
```

`openShop()` must compare the inventory to `requiredInventoryForDay(state.dayIndex)`. `serveOrder()` must read the current order from `getOrders(state.dayIndex)`. `finishDay()` must require `eveningChoice`, append one compact history entry, and set `phase` to `complete`.

`advanceDay()` must return a chapter-complete state after spring 14; otherwise it increments `dayIndex`, restores energy, refills water and cloth, clears daily fields, and adds the new morning journal entry.

- [ ] **Step 4: Run all domain tests**

Run: `node --test prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/daily-content.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit the multi-day rules**

```bash
git add prototypes/integrated-day/game-state.js prototypes/integrated-day/game-state.test.mjs
git commit -m "feat: add persistent three-day state machine"
```

---

### Task 3: Save-Game Adapter

**Files:**
- Create: `prototypes/integrated-day/save-game.js`
- Create: `prototypes/integrated-day/save-game.test.mjs`

**Interfaces:**
- Consumes: a version-1 state object and `{ x, y }` player position.
- Produces: `SAVE_KEY`, `validateSaveRecord(record)`, `loadSave(storage)`, `writeSave(storage, state, position)`, and `clearSave(storage)`.

- [ ] **Step 1: Write failing storage-adapter tests**

```js
function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test('a save record round-trips without losing state', () => {
  const storage = memoryStorage();
  const state = createGameState();
  writeSave(storage, state, { x: 44, y: 82 });
  assert.deepEqual(loadSave(storage), {
    ok: true,
    record: { version: 1, state, position: { x: 44, y: 82 } }
  });
});

test('bad JSON and unsupported versions are rejected without deletion', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{broken');
  assert.equal(loadSave(storage).reason, 'invalid-json');
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 99 }));
  assert.equal(loadSave(storage).reason, 'unsupported-version');
});
```

- [ ] **Step 2: Run the tests and verify the module is missing**

Run: `node --test prototypes/integrated-day/save-game.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `save-game.js`.

- [ ] **Step 3: Implement strict project-local persistence**

```js
export const SAVE_KEY = 'seabreeze-club-save-v1';

export function writeSave(storage, state, position) {
  const record = { version: 1, state, position };
  if (!validateSaveRecord(record)) throw new TypeError('Invalid save record');
  storage.setItem(SAVE_KEY, JSON.stringify(record));
  return record;
}
```

Validate `dayIndex`, `phase`, `inventory`, `repairs`, `relationship`, `history`, and finite position coordinates. `loadSave()` returns `{ ok: false, reason }` for absent, bad JSON, wrong version, or invalid shape and never removes the stored value. When loading a valid state with `training.started === true`, return a copy with `training.started` reset to `false`.

- [ ] **Step 4: Run save tests**

Run: `node --test prototypes/integrated-day/save-game.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit persistence**

```bash
git add prototypes/integrated-day/save-game.js prototypes/integrated-day/save-game.test.mjs
git commit -m "feat: add local three-day save game"
```

---

### Task 4: Three-Shot Training Rules

**Files:**
- Create: `prototypes/integrated-day/training-game.js`
- Create: `prototypes/integrated-day/training-game.test.mjs`

**Interfaces:**
- Consumes: normalized pointer and target positions between 0 and 1.
- Produces: `TRAINING_TARGETS`, `createTrainingSession()`, `scoreShot(pointer, target)`, and `takeShot(session, pointer)`.

- [ ] **Step 1: Write failing training tests**

```js
test('shot scoring uses center, edge, and miss bands', () => {
  assert.equal(scoreShot(.50, .50), 2);
  assert.equal(scoreShot(.62, .50), 1);
  assert.equal(scoreShot(.84, .50), 0);
});

test('a session ends after exactly three shots', () => {
  let session = createTrainingSession();
  session = takeShot(session, TRAINING_TARGETS[0]);
  session = takeShot(session, TRAINING_TARGETS[1]);
  session = takeShot(session, TRAINING_TARGETS[2]);
  const finished = session;
  session = takeShot(session, .5);
  assert.equal(finished.complete, true);
  assert.equal(finished.score, 6);
  assert.deepEqual(session, finished);
});
```

- [ ] **Step 2: Run the training tests and verify failure**

Run: `node --test prototypes/integrated-day/training-game.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `training-game.js`.

- [ ] **Step 3: Implement deterministic scoring**

```js
export const TRAINING_TARGETS = Object.freeze([.28, .72, .5]);

export function scoreShot(pointer, target) {
  const distance = Math.abs(pointer - target);
  if (distance <= .08) return 2;
  if (distance <= .18) return 1;
  return 0;
}
```

`takeShot()` appends `{ pointer, target, points }`, increments `shotIndex`, sums `score`, and marks `complete` when `shotIndex === 3`.

- [ ] **Step 4: Run the training tests**

Run: `node --test prototypes/integrated-day/training-game.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit training rules**

```bash
git add prototypes/integrated-day/training-game.js prototypes/integrated-day/training-game.test.mjs
git commit -m "feat: add optional three-shot training"
```

---

### Task 5: Browser Controller and Game UI Integration

**Files:**
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/styles.css`
- Modify: `prototypes/integrated-day/game.js`

**Interfaces:**
- Consumes: all modules from Tasks 1-4.
- Produces: start/continue flow, dynamic date and weather, three-day rendering, training controls, persistent repairs, history view, save-money choice, and chapter ending.

- [ ] **Step 1: Add semantic hooks for the new states**

Add these elements to `index.html`:

```html
<span data-date>春 12</span>
<small data-weather>海风转晴</small>

<section class="start-card" data-start-card hidden aria-label="海风球场存档">
  <h1>海风球场</h1>
  <p data-save-summary></p>
  <button data-continue type="button">继续游戏</button>
  <button data-new-game type="button">重新开始</button>
</section>

<div class="training-layer" data-training hidden aria-label="射门训练">
  <div class="goal-target" data-training-target></div>
  <div class="power-track"><i data-training-zone></i><b data-training-pointer></b></div>
  <strong data-training-count>第 1 脚</strong>
  <button data-shoot type="button">射门</button>
</div>

<button data-save-money type="button">今天先存下</button>
<section data-chapter-summary hidden aria-label="三日记录"></section>
```

The new-game control must require a second click whose label is `确认重新开始` before clearing the save.

- [ ] **Step 2: Connect multi-day content and save restoration in `game.js`**

Replace `createDayState()` and static `ORDER_SEQUENCE` use with:

```js
import { getDayContent, getOrders, requiredInventoryForDay } from './daily-content.js';
import { createGameState, advanceDay, chooseSaveMoney, finishTraining } from './game-state.js';
import { loadSave, writeSave, clearSave } from './save-game.js';
import { TRAINING_TARGETS, createTrainingSession, takeShot } from './training-game.js';

const loaded = loadSave(localStorage);
let state = loaded.ok ? loaded.record.state : createGameState();
let position = loaded.ok ? loaded.record.position : { x: 50, y: 89 };

function currentDay() {
  return getDayContent(state.dayIndex);
}

function persist() {
  writeSave(localStorage, state, position);
}
```

Persist after successful state transitions. Throttle position-only saves to one write per 2 seconds. Do not write while the start card is waiting for a choice.

- [ ] **Step 3: Make rendering date-aware and preserve repairs**

```js
function renderCalendar() {
  const day = currentDay();
  document.querySelector('[data-date]').textContent = `${day.season} ${day.date}`;
  document.querySelector('[data-weather]').textContent = day.weather;
}

function renderPersistentRepairs() {
  document.querySelectorAll('[data-repair-visual]').forEach(visual => {
    visual.hidden = !state.repairs.includes(visual.dataset.repairVisual);
  });
}
```

Compute gathering guidance from `requiredInventoryForDay()`. Render the current orders from `getOrders()`. Hide repaired purchase buttons, allow `data-save-money`, and change the summary action to advance days 12 and 13 or show the chapter summary after day 14.

- [ ] **Step 4: Integrate the three-shot interaction**

Start training only when the current day enables it, the phase is morning, and training is not complete. During training, suspend world movement and update the pointer from a triangular wave:

```js
function pointerAt(timestamp) {
  const cycle = (timestamp % 1800) / 1800;
  return cycle <= .5 ? cycle * 2 : 2 - cycle * 2;
}
```

Space, E, and `data-shoot` call `takeShot()`. After the third shot, dispatch `finishTraining(state, session.score)`, show the score dialogue, restore world controls, render, and persist.

- [ ] **Step 5: Style the start card, training layer, history, and mobile controls**

Use the existing navy, faded coral, pale sea-blue, and 8-11px radius language. Keep training elements within the world, use a warm white goal target and coral scoring zone, and place the mobile shoot button above the hotbar without covering the player or E button.

Under `prefers-reduced-motion: reduce`, stop automatic ambient animation and move the training pointer in discrete keyboard/pointer steps while retaining the same scoring bands.

- [ ] **Step 6: Run syntax, copy, and unit checks**

Run:

```bash
node --check prototypes/integrated-day/game.js
node --check prototypes/integrated-day/game-state.js
node --test prototypes/integrated-day/*.test.mjs
rg -n 'TBD|TODO|lorem|—|–' prototypes/integrated-day
```

Expected: syntax exits 0, all tests PASS, and `rg` prints no matches.

- [ ] **Step 7: Commit the integrated three-day UI**

```bash
git add prototypes/integrated-day/index.html prototypes/integrated-day/styles.css prototypes/integrated-day/game.js
git commit -m "feat: integrate three-day seaside club loop"
```

---

### Task 6: Three-Day Browser Verification and Handoff

**Files:**
- Modify: `prototypes/integrated-day/smoke-test.mjs`
- Modify: `prototypes/integrated-day/README.md`

**Interfaces:**
- Consumes: stable DOM hooks and `window.__integratedDayDebug` from Task 5.
- Produces: one exit-code-0 test proving three-day progression, training, save restore, desktop/mobile layout, and clean browser logs.

- [ ] **Step 1: Extend browser debug hooks without bypassing rules**

Expose only deterministic helpers that call the same transitions as the UI:

```js
window.__integratedDayDebug = {
  getState: () => structuredClone(state),
  getPosition: () => ({ ...position }),
  walkToObject,
  interact,
  shootAt: value => resolveTrainingShot(value),
  hasSave: () => loadSave(localStorage).ok,
  clearProjectSave: () => clearSave(localStorage)
};
```

- [ ] **Step 2: Test the three-day path and refresh restoration**

The smoke test must:

1. Clear only `seabreeze-club-save-v1`.
2. Complete spring 12, buy the awning, and advance.
3. Reload the page and choose continue.
4. Assert spring 13, awning persistence, money, and relationship state.
5. Complete a 6-point training session through three debug shots.
6. Complete spring 13 and choose save money.
7. Complete spring 14, buy another repair, and open the chapter summary.
8. Assert three history entries and `chapterComplete === true`.

- [ ] **Step 3: Verify responsive layout and browser health**

At 1440x900 and 390x844 assert:

- no horizontal overflow;
- start, training, shop, repair, day summary, and chapter summary controls remain inside the viewport;
- mobile movement, E, and shoot controls are reachable;
- the current map, unified An Ruotong atlas, and complete coach atlas are loaded;
- no `Runtime.exceptionThrown` or error-level console log occurs.

- [ ] **Step 4: Update the README**

Document the three dates, save behavior, training controls, new-game confirmation, test commands, and current chapter boundary. Remove statements that say refresh resets the day or that only one fixed order sequence exists.

- [ ] **Step 5: Run the final verification suite**

Run:

```bash
node --test prototypes/integrated-day/*.test.mjs
node prototypes/integrated-day/smoke-test.mjs
```

Expected:

```text
PASS three-day life loop
PASS training and relationship path
PASS save and reload restoration
PASS desktop and mobile layout
PASS browser console
```

Inspect `/private/tmp/integrated-day-morning.png`, `/private/tmp/integrated-day-training.png`, `/private/tmp/integrated-day-shop.png`, `/private/tmp/integrated-day-summary.png`, `/private/tmp/integrated-day-chapter.png`, and `/private/tmp/integrated-day-mobile.png`.

- [ ] **Step 6: Commit verification and documentation**

```bash
git add prototypes/integrated-day/smoke-test.mjs prototypes/integrated-day/README.md
git commit -m "test: verify persistent three-day club loop"
```
