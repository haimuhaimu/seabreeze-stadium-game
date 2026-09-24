# Integrated Day Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone playable day that combines free exploration, a field-side shop, visible venue repair, and one optional relationship event.

**Architecture:** Keep the selected comparison prototypes unchanged and create a new `prototypes/integrated-day/` vertical slice. Put deterministic game rules in an ES module with Node tests, rendering and input in a browser controller, and visuals in a focused stylesheet. Use one state machine (`morning -> shop -> evening -> complete`) so every phase can be tested independently.

**Tech Stack:** Static HTML, native CSS, browser ES modules, Node.js built-in test runner, Chrome DevTools Protocol smoke test, no runtime dependencies.

## Global Constraints

- Preserve the low-pressure loop: no failure timer, disease meter, debt, or missed-content punishment.
- The daily loop is exploration and gathering, field-side shop service, venue repair, then a visible end-of-day result.
- Relationship content is optional and must not block the main loop.
- Reuse `prototypes/day-loop/assets/community-field-concept.png`; do not add licensed third-party artwork.
- Support keyboard and pointer input, with explicit mobile controls below 920px.
- Respect `prefers-reduced-motion` and prevent horizontal overflow at 390px and 1440px widths.
- Keep existing files under `prototypes/day-loop/` functionally unchanged.

---

### Task 1: Deterministic Day State

**Files:**
- Create: `prototypes/integrated-day/game-state.js`
- Create: `prototypes/integrated-day/game-state.test.mjs`

**Interfaces:**
- Produces: `createDayState()`, `collectItem(state, itemId)`, `talkToCoach(state)`, `openShop(state)`, `serveOrder(state, recipe)`, `buyRepair(state, repairId)`, and `finishDay(state)`.
- Consumes: no browser globals; all functions accept and return plain serializable objects.

- [ ] **Step 1: Write failing state-machine tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDayState,
  collectItem,
  openShop,
  serveOrder,
  buyRepair,
  finishDay
} from './game-state.js';

test('a full day reaches completion without the optional conversation', () => {
  let state = createDayState();
  state = collectItem(state, 'tea-a');
  state = collectItem(state, 'tea-b');
  state = collectItem(state, 'fruit-a');
  state = collectItem(state, 'fruit-b');
  state = openShop(state);
  for (const recipe of ['tea', 'towel', 'fruit', 'tea']) state = serveOrder(state, recipe);
  state = buyRepair(state, 'awning');
  state = finishDay(state);
  assert.equal(state.phase, 'complete');
  assert.equal(state.relationship.coachMet, false);
  assert.equal(state.repair, 'awning');
});
```

- [ ] **Step 2: Run the tests and verify the module is missing**

Run: `node --test prototypes/integrated-day/game-state.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `game-state.js`.

- [ ] **Step 3: Implement immutable state transitions**

```js
export function createDayState() {
  return {
    phase: 'morning',
    minute: 550,
    energy: 100,
    collected: [],
    inventory: { tea: 0, fruit: 0, cloth: 2, water: 4 },
    ordersServed: 0,
    money: 0,
    repair: null,
    relationship: { coachMet: false },
    journal: []
  };
}
```

Implement every exported transition as a pure function that clones state, rejects invalid phase changes with an unchanged state plus a journal message, and records successful actions.

- [ ] **Step 4: Run state tests**

Run: `node --test prototypes/integrated-day/game-state.test.mjs`

Expected: all state transition tests PASS.

---

### Task 2: Integrated Playable Surface

**Files:**
- Create: `prototypes/integrated-day/index.html`
- Create: `prototypes/integrated-day/styles.css`
- Create: `prototypes/integrated-day/game.js`

**Interfaces:**
- Consumes: all exports from `./game-state.js` and `../day-loop/assets/community-field-concept.png`.
- Produces: a playable page with `[data-phase]`, `[data-player]`, `[data-object]`, `[data-shop]`, `[data-repairs]`, and `[data-summary]` hooks for smoke tests.

- [ ] **Step 1: Create the semantic page shell**

```html
<main class="game" data-phase="morning">
  <header class="status-bar" aria-label="今日状态"></header>
  <section class="world" aria-label="社区球场"></section>
  <aside class="journal" aria-label="今日记事"></aside>
</main>
```

Include a persistent objective panel, keyboard instructions, mobile controls, shop drawer, evening repair choices, and end-of-day summary. Use real Chinese names and copy from the approved prototype tone.

- [ ] **Step 2: Build the phase renderer and inputs**

```js
function dispatch(action) {
  state = action(state);
  render();
}

document.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'e') interactNearest();
});
```

Morning uses WASD movement and clickable hotspots. Entering the shop becomes available after collecting two tea bundles and two fruits, but talking to 郭教练 remains optional. Shop service follows the four-order sequence. The evening phase lets the player fund one affordable repair, then finish the day.

- [ ] **Step 3: Style desktop, mobile, motion, and focus states**

Use the existing moss green, slate blue-gray, and faded coral palette. Keep one 14px radius system, WCAG-readable buttons, `prefers-reduced-motion`, a 16:9 desktop field, a square mobile field, and fixed-size touch controls that do not cover the nearest-interaction prompt.

- [ ] **Step 4: Verify module syntax and visible-copy hygiene**

Run: `node --check prototypes/integrated-day/game-state.js && node --check prototypes/integrated-day/game.js`

Expected: exit code 0 with no output.

Run: `rg -n 'TODO|TBD|lorem|—|–' prototypes/integrated-day`

Expected: no matches.

---

### Task 3: Full Browser Loop and Responsive Verification

**Files:**
- Create: `prototypes/integrated-day/smoke-test.mjs`

**Interfaces:**
- Consumes: stable data hooks from Task 2.
- Produces: an exit-code-0 browser test that completes the day and validates layout and console state.

- [ ] **Step 1: Write a Chrome DevTools smoke test**

```js
await click('[data-object="tea-a"]');
await click('[data-object="tea-b"]');
await click('[data-object="fruit-a"]');
await click('[data-object="fruit-b"]');
await click('[data-open-shop]');
for (const recipe of ['tea', 'towel', 'fruit', 'tea']) {
  await click(`[data-recipe="${recipe}"]`);
}
await click('[data-repair="awning"]');
await click('[data-finish-day]');
assert.equal(await text('[data-summary-title]'), '今天留下了痕迹');
```

Also assert no horizontal overflow at 1440x900 and 390x844, mobile controls are visible at 390px, and no `Runtime.exceptionThrown` or browser error log is emitted.

- [ ] **Step 2: Run the smoke test**

Run: `node prototypes/integrated-day/smoke-test.mjs`

Expected:

```text
PASS integrated day loop
PASS optional relationship path
PASS desktop and mobile layout
PASS browser console
```

- [ ] **Step 3: Render screenshots for visual inspection**

Run Chrome headless at 1440x900 and 390x844, capture the morning, shop, and summary states, then inspect typography, contrast, scene cropping, touch control placement, and overflow.

---

### Task 4: Handoff Documentation

**Files:**
- Create: `prototypes/integrated-day/README.md`
- Modify: `prototypes/day-loop/README.md`

**Interfaces:**
- Consumes: final run and test commands.
- Produces: one clear entry point for the selected combined direction while preserving links to the original comparison set.

- [ ] **Step 1: Document how to play and test**

```markdown
# 完整一天 Demo

直接打开 `index.html`。上午使用 WASD 和 E 探索；备料完成后开店；收店后选择一处修缮并结束当天。

运行 `node prototypes/integrated-day/smoke-test.mjs` 验证完整流程。
```

- [ ] **Step 2: Link the selected direction from the comparison README**

Add a short “已选方向” section pointing to `../integrated-day/index.html` and state that the original picker remains available for comparison.

- [ ] **Step 3: Run final verification**

Run: `node --test prototypes/integrated-day/game-state.test.mjs && node prototypes/integrated-day/smoke-test.mjs`

Expected: all unit tests and all four smoke-test checks PASS.

Run: `git status --short`

Expected: only the new plan, integrated-day files, the generated concept image, the original day-loop prototype files, and the README link are untracked or modified.
