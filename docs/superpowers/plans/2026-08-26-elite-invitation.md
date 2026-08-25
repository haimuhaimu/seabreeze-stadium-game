# Elite Invitation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn elite qualification into a playable season-ending invitation match whose outcome and rewards persist into later seasons.

**Architecture:** Add isolated elite content and pure state modules, embed their normalized state under the existing season record, then expose narrow shared-game transitions for the browser UI. Reuse the existing match-panel interaction language while rendering a dedicated elite overlay so the seven-round league match remains unchanged.

**Tech Stack:** Browser ES modules, immutable JavaScript state transitions, Node test runner, existing HTML/CSS UI, Chrome DevTools Protocol smoke test.

**Spec:** `docs/superpowers/specs/2026-08-26-elite-invitation-design.md`

## Global Constraints

- Keep save version exactly `5` and normalize old version 5 records that have no `season.elite` field.
- Elite results are deterministic; do not add randomness.
- The invitation appears only after rank 1-4 and total construction level 6 or higher.
- Preparation and elite choices do not consume weekly action slots.
- Rewards settle exactly once and elite history persists across seasons.
- Do not stage or modify the user's untracked prototype and source image files.

---

### Task 1: Elite content and pure match state

**Files:**
- Create: `prototypes/integrated-day/elite-content.js`
- Create: `prototypes/integrated-day/elite-content.test.mjs`
- Create: `prototypes/integrated-day/elite-state.js`
- Create: `prototypes/integrated-day/elite-state.test.mjs`

**Interfaces:**
- Produces: `ELITE_OPPONENT`, `ELITE_PREPARATIONS`, `ELITE_MOMENTS`, `ELITE_RESULTS`, `getElitePreparation(id)`, `createEliteState()`, `cloneEliteState(state)`, `offerEliteInvitation(state, seasonNumber)`, `startEliteMatch(state, preparationId, snapshot)`, `getEliteMatchMoment(state)`, `resolveEliteMatchMoment(state, choiceId)`, and `declineEliteInvitation(state)`.
- Snapshot shape: `{ ranking: boolean, construction: boolean }`; the chosen preparation is stored separately.

- [ ] **Step 1: Write failing content tests**

Assert literal content counts: three preparations, three moments, three choices per moment, unique ids, exactly one `ranking` callback in moment one, one `construction` callback in moment two, and three preparation callbacks in moment three.

- [ ] **Step 2: Run the content tests and verify RED**

Run: `node --test prototypes/integrated-day/elite-content.test.mjs`

Expected: module-not-found failure for `elite-content.js`.

- [ ] **Step 3: Implement the content module**

Use frozen plain objects. Each choice contains `{ id, label, copy, callback, effect }`, where effect is `{ home: 1 }`, `{ away: -1 }`, or `{}`. Result ids and rewards are literal:

```js
champion: { cash: 160, cohesion: 4, community: 8 }
recognized: { cash: 90, cohesion: 2, community: 4 }
attended: { cash: 50, cohesion: 1, community: 2 }
```

- [ ] **Step 4: Run the content tests and verify GREEN**

Run: `node --test prototypes/integrated-day/elite-content.test.mjs`

Expected: all content tests pass.

- [ ] **Step 5: Write failing pure-state tests**

Cover these observable mutations:

```js
const invited = offerEliteInvitation(createEliteState(), 1);
const match = startEliteMatch(invited, 'shared-plan', { ranking: true, construction: true });
const champion = ['use-league-shape', 'open-built-route', 'follow-shared-plan']
  .reduce((state, choiceId) => resolveEliteMatchMoment(state, choiceId), match);
assert.deepEqual({ home: champion.result.homeGoals, away: champion.result.awayGoals }, { home: 2, away: 1 });
assert.equal(champion.result.id, 'champion');
assert.equal(champion.history.length, 1);
```

Add separate literal paths for a 1-1 `recognized` result and a loss. Assert duplicate offer, early resolve, unknown ids, post-completion resolve, and starting without an invitation all throw.

- [ ] **Step 6: Run pure-state tests and verify RED**

Run: `node --test prototypes/integrated-day/elite-state.test.mjs`

Expected: module-not-found failure for `elite-state.js`.

- [ ] **Step 7: Implement minimal immutable elite state**

Callbacks are ready when `ranking` or `construction` is true in the snapshot, or when the callback equals `preparation:${state.preparationId}`. Apply an effect only when its callback is ready. After the third moment, derive `champion` for home win, `recognized` for draw, and `attended` for loss; append one history entry and update `bestResultId` using attended < recognized < champion.

- [ ] **Step 8: Run focused and full pure tests**

Run: `node --test prototypes/integrated-day/elite-content.test.mjs prototypes/integrated-day/elite-state.test.mjs`

Expected: all tests pass.

- [ ] **Step 9: Commit Task 1**

```bash
git add prototypes/integrated-day/elite-content.js prototypes/integrated-day/elite-content.test.mjs prototypes/integrated-day/elite-state.js prototypes/integrated-day/elite-state.test.mjs
git commit -m "feat: model the elite invitation match"
```

### Task 2: Embed invitations in season progression

**Files:**
- Modify: `prototypes/integrated-day/season-state.js`
- Modify: `prototypes/integrated-day/season-state.test.mjs`

**Interfaces:**
- Consumes: all pure elite-state functions from Task 1.
- Produces: normalized `season.elite`; `startSeasonEliteMatch(state, preparationId)`, `getSeasonEliteMoment(state)`, `resolveSeasonEliteMoment(state, choiceId)`, and `declineSeasonEliteInvitation(state)`.

- [ ] **Step 1: Write failing season tests**

Extend the seven-round strong and weak season test so the strong route with at least six construction levels receives one `invited` elite state while the weak route remains `idle`. Add a focused test that runs all three elite moments, asserts the result and persistent history, starts the next season, and verifies the history remains while status returns to `idle`. Delete `elite` from an old state fixture and assert `cloneSeasonState` supplies a fresh state.

- [ ] **Step 2: Run season tests and verify RED**

Run: `node --test prototypes/integrated-day/season-state.test.mjs`

Expected: missing `elite` state or missing exports.

- [ ] **Step 3: Integrate and normalize elite state**

Create and clone `elite` in `createSeasonState` and `cloneSeasonState`. In final-round settlement, call `offerEliteInvitation` only when `eliteQualified` is true. Implement the four narrow wrappers. `startNextSeason` must throw during an active elite match, decline an unused invitation, retain history and best result, and reset current invitation fields.

- [ ] **Step 4: Run season tests and verify GREEN**

Run: `node --test prototypes/integrated-day/season-state.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add prototypes/integrated-day/season-state.js prototypes/integrated-day/season-state.test.mjs
git commit -m "feat: offer elite matches after qualification"
```

### Task 3: Shared game rewards and version 5 save safety

**Files:**
- Modify: `prototypes/integrated-day/game-state.js`
- Modify: `prototypes/integrated-day/game-state.test.mjs`
- Modify: `prototypes/integrated-day/save-game.js`
- Modify: `prototypes/integrated-day/save-game.test.mjs`

**Interfaces:**
- Produces: `chooseElitePreparation(state, preparationId)` and `chooseEliteMatchChoice(state, choiceId)`.
- Save loading produces a normalized `season.elite` and resets interrupted elite matches to `invited`.

- [ ] **Step 1: Write failing shared-state tests**

Build a qualified completed season fixture. Assert preparation starts a match without changing cash or weekly actions. Resolve the champion path and assert exactly 160 cash, 4 cohesion and 8 community are added once. Repeating the last choice must not add rewards again. Assert `beginNextLeagueSeason` refuses an active elite match and preserves elite history after completion.

- [ ] **Step 2: Write failing save tests**

Delete `season.elite` from a valid version 5 record and assert loading supplies `idle`. Save during an elite match and assert reload returns to `invited` with no match, result, or duplicated rewards.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.test.mjs`

Expected: missing transitions and missing normalization assertions fail.

- [ ] **Step 4: Implement shared transitions and save normalization**

The preparation wrapper starts the pure match and writes one journal entry. The choice wrapper applies pure state first, then only when status changes to `complete` posts one ledger reward with id `elite-<seasonNumber>`, clamps cohesion and community, syncs cash, and journals the final score. Normalize every loaded season through `cloneSeasonState`; if elite status is `match`, replace only current invitation fields with a fresh invited state that retains history and best result.

- [ ] **Step 5: Run focused and full rule tests**

Run: `node --test prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.test.mjs`

Then: `node --test prototypes/integrated-day/*.test.mjs`

Expected: all tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add prototypes/integrated-day/game-state.js prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.js prototypes/integrated-day/save-game.test.mjs
git commit -m "feat: settle persistent elite match rewards"
```

### Task 4: Playable elite overlay and browser route

**Files:**
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/styles.css`
- Modify: `prototypes/integrated-day/smoke-test.mjs`

**Interfaces:**
- Consumes: `ELITE_OPPONENT`, preparations, result content, `getSeasonEliteMoment`, shared game transitions.
- Produces: `[data-elite-panel]` with invitation, match, and result states.

- [ ] **Step 1: Extend the smoke route before UI implementation**

Add a direct browser debug fixture for a completed qualified season, then assert the final summary button opens the elite panel. Verify three preparation buttons on mobile with no horizontal overflow. Select `shared-plan`, resolve the three champion choices, assert 2-1, 160 cash reward, `champion` history, and the next-season button preserving `bestResultId`.

- [ ] **Step 2: Run smoke and verify RED**

Run: `node prototypes/integrated-day/smoke-test.mjs`

Expected: missing elite selectors or transitions fail.

- [ ] **Step 3: Implement semantic overlay markup**

Add one dialog with opponent heading, qualification source, preparation options, scoreline, current moment, choice container, result block, skip action, and next-season action. Bump the stylesheet and module query strings.

- [ ] **Step 4: Implement render and interaction flow**

When a qualified season ends, the summary CTA opens the invitation panel. Render one of three states from `season.elite.status`; use callback readiness to explain which prior result answers each moment. Choice handlers persist only real transitions. The skip action calls the existing next-season transition only when no elite match is active.

- [ ] **Step 5: Style desktop and mobile states**

Reuse the existing 12px panel radius, pale blue surface, coral primary button, dark teal text and physical 3px button edge. Preparation and choice lists are two-column only where space permits and collapse to one column below 720px. All primary labels stay on one line and buttons have hover, focus, active and disabled states.

- [ ] **Step 6: Run full browser verification**

Run: `node prototypes/integrated-day/smoke-test.mjs`

Expected: prologue through league smoke plus the qualified elite path pass with a clean console.

- [ ] **Step 7: Commit Task 4**

```bash
git add prototypes/integrated-day/index.html prototypes/integrated-day/game.js prototypes/integrated-day/styles.css prototypes/integrated-day/smoke-test.mjs
git commit -m "feat: make the elite invitation playable"
```

### Task 5: Documentation and final verification

**Files:**
- Modify: `prototypes/integrated-day/README.md`

**Interfaces:**
- Documents the playable elite ending and the remaining intentional boundaries.

- [ ] **Step 1: Update the README**

Describe qualification, one preparation, three recalled match decisions, deterministic outcomes, permanent elite history, rewards, skip route and version 5 compatibility.

- [ ] **Step 2: Run fresh verification**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Run: `node prototypes/integrated-day/smoke-test.mjs`

Run: `git diff --check`

Expected: zero test failures, clean browser console, and no whitespace errors.

- [ ] **Step 3: Inspect the mobile screenshot**

Open `/private/tmp/integrated-day-elite-invitation-mobile.png` and verify typography, contrast, overflow, button wrapping and modal height.

- [ ] **Step 4: Commit Task 5**

```bash
git add prototypes/integrated-day/README.md
git commit -m "docs: explain the elite invitation finale"
```
