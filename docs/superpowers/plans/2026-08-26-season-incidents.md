# Season Incidents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one authored, consequential incident to every league round so NPC relationships, stadium operation, match callbacks, and later-season memory form a coherent story instead of a repeated menu loop.

**Architecture:** Add immutable incident content in `season-events.js`, store only the chosen event id, choice id, callback tag, and history in `season-state.js`, then apply shared economy and team effects through a `game-state.js` wrapper. Surface the current incident as a physical world target and a focused story panel while keeping save version 5 backward compatible through default normalization.

**Tech Stack:** Browser-native ES modules, HTML/CSS, Node.js built-in test runner, localStorage, existing CDP browser smoke runner.

**Spec:** `docs/superpowers/specs/2026-08-26-season-incidents-design.md`

## Global Constraints

- Every active league round has exactly one incident with three choices.
- Incidents do not consume any of the three weekly work actions.
- A match cannot begin before the current incident is answered.
- Every choice can continue the season and must have an explicit result.
- Choices use everyday language and no professional football terminology.
- Incident relationships clamp to 0 through 5 and shared resources clamp to their existing bounds.
- First-season incidents follow the authored seven-event arc; later seasons rotate deterministically.
- Version 5 saves without incident fields remain readable and keep all existing progress.
- Preserve the current hand-painted maps, paper panels, coral emphasis, responsive layout, and reduced-motion behavior.

---

### Task 1: Define the recurring incident deck

**Files:**
- Create: `prototypes/integrated-day/season-events.js`
- Create: `prototypes/integrated-day/season-events.test.mjs`

**Interfaces:**
- Produces: `SEASON_EVENTS`, `getSeasonEvent(roundIndex, seasonNumber)`, and `getSeasonEventChoice(eventId, choiceId)`.
- Consumes: NPC ids and existing callback tag vocabulary from `season-content.js` only by contract, without mutable state.

- [ ] **Step 1: Write failing content tests**

```js
test('the first season follows seven authored incidents and season two rotates them', () => {
  const first = Array.from({ length: 7 }, (_, index) => getSeasonEvent(index, 1).id);
  const second = Array.from({ length: 7 }, (_, index) => getSeasonEvent(index, 2).id);
  assert.equal(new Set(first).size, 7);
  assert.notDeepEqual(second, first);
  assert.deepEqual(first.slice(0, 3), ['shared-pitch', 'storm-drain', 'sore-knee']);
});

test('every incident has three complete consequential choices', () => {
  for (const event of SEASON_EVENTS) {
    assert.equal(event.choices.length, 3);
    assert.ok(event.choices.every(choice => choice.resultCopy && choice.tag && choice.effects));
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test prototypes/integrated-day/season-events.test.mjs`

Expected: FAIL because `season-events.js` does not exist.

- [ ] **Step 3: Implement nine immutable incidents**

Use the seven authored first-season incidents plus `market-cleanup` and `captain-vote`. Every event contains `id`, `title`, `speakerId`, `mapId`, `locationId`, `kicker`, `beats`, and three choices. Every choice contains `id`, `label`, `detail`, `resultCopy`, `tag`, `effects`, and `relationships`.

- [ ] **Step 4: Run tests and commit**

Run: `node --test prototypes/integrated-day/season-events.test.mjs`

Expected: PASS.

```bash
git add prototypes/integrated-day/season-events.js prototypes/integrated-day/season-events.test.mjs
git commit -m "feat: author the league incident deck"
```

### Task 2: Record incidents in pure season state

**Files:**
- Modify: `prototypes/integrated-day/season-state.js`
- Modify: `prototypes/integrated-day/season-state.test.mjs`

**Interfaces:**
- Consumes: `getSeasonEvent` and `getSeasonEventChoice` from Task 1.
- Produces: `resolveSeasonEvent(state, eventId, choiceId)` and incident-aware `canStartSeasonMatch(state)`.
- Normalized state fields: `week.eventId`, `week.eventChoiceId`, `week.eventTag`, and `eventHistory`.

- [ ] **Step 1: Write failing state tests**

Cover default incident fields, one resolution per round, relationship gain and loss with clamping, help-tag callbacks, match gating, history across round advancement, history across next season, and normalization of an old version 5 state with missing fields.

```js
test('an incident is required for the match but does not spend a work action', () => {
  let season = beginSeason(createSeasonState());
  for (const id of ['train-attack', 'community-open', 'maintenance']) season = recordSeasonAction(season, id);
  assert.equal(canStartSeasonMatch(season), false);
  const event = getSeasonEvent(0, 1);
  season = resolveSeasonEvent(season, event.id, event.choices[0].id);
  assert.equal(season.week.actions.length, 3);
  assert.equal(canStartSeasonMatch(season), true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test prototypes/integrated-day/season-state.test.mjs`

Expected: FAIL because incident fields and `resolveSeasonEvent` are absent.

- [ ] **Step 3: Implement normalization and transition**

Extend `emptyWeek`, `createSeasonState`, and `cloneSeasonState`. Validate that the requested event equals `getSeasonEvent(roundIndex, seasonNumber)`, apply relationship deltas with the existing `clamp`, append the tag to `helpTags`, append a durable history entry, and require `eventChoiceId` in `canStartSeasonMatch`.

- [ ] **Step 4: Update existing prepared-match tests**

Resolve a valid event in every helper that expects to start a match. Do not weaken the match gate or insert test-only production defaults.

- [ ] **Step 5: Run state tests and commit**

Run: `node --test prototypes/integrated-day/season-state.test.mjs`

Expected: PASS.

```bash
git add prototypes/integrated-day/season-state.js prototypes/integrated-day/season-state.test.mjs
git commit -m "feat: persist league incident choices"
```

### Task 3: Apply incident consequences to the shared game

**Files:**
- Modify: `prototypes/integrated-day/game-state.js`
- Modify: `prototypes/integrated-day/game-state.test.mjs`
- Modify: `prototypes/integrated-day/save-game.test.mjs`

**Interfaces:**
- Consumes: `resolveSeasonEvent` and `getSeasonEventChoice`.
- Produces: `chooseSeasonEventDecision(state, eventId, choiceId)`.

- [ ] **Step 1: Write failing integration tests**

```js
test('a league incident changes shared resources and relationships without spending work', () => {
  const before = beginLeagueSeason(completedNamingWeek());
  const after = chooseSeasonEventDecision(before, 'shared-pitch', 'share-half');
  assert.equal(after.season.week.actions.length, 0);
  assert.equal(after.season.week.eventChoiceId, 'share-half');
  assert.notEqual(after.communitySupport, before.communitySupport);
  assert.notEqual(after.season.relationships.xiaoman, before.season.relationships.xiaoman);
});
```

Also prove a version 5 state whose season lacks `eventHistory` can be written, loaded, normalized by the next incident transition, and retain all existing projects and standings.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.test.mjs`

Expected: FAIL because the wrapper is missing and matches now require incident resolution.

- [ ] **Step 3: Implement exact shared effects**

Clone game state, call the pure transition, post cash changes as one ledger entry, clamp roster and world metrics, apply governance deltas through `applyGovernanceEffect`, sync legacy `money`, advance time by 20 minutes, and append the choice result to the management journal.

- [ ] **Step 4: Run all pure tests and commit**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: PASS.

```bash
git add prototypes/integrated-day/game-state.js prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.test.mjs
git commit -m "feat: connect incidents to club progress"
```

### Task 4: Put incidents in the physical world and season UI

**Files:**
- Modify: `prototypes/integrated-day/world-content.js`
- Modify: `prototypes/integrated-day/world-content.test.mjs`
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/styles.css`
- Modify: `prototypes/integrated-day/game.js`

**Interfaces:**
- `getSeasonWorldObjects(mapId, season)` adds one `season-event` object until resolved.
- Browser state adds `activeSeasonEventId` and uses `chooseSeasonEventDecision`.
- UI adds `[data-season-event]`, event title, speaker, beats, three options, pending status, and recent history.

- [ ] **Step 1: Write failing world tests**

Assert each of the nine event locations is on the requested map, has a walkable approach, stops within 112 rendered pixels of its marker, appears before resolution, and disappears afterward. With three actions and no event answer, assert the match target is absent; after resolution, assert it appears.

- [ ] **Step 2: Run world tests and verify RED**

Run: `node --test prototypes/integrated-day/world-content.test.mjs`

Expected: FAIL because no `season-event` object exists.

- [ ] **Step 3: Add event target and dialog**

Reuse office, entrance, training sideline, and shop paths. Render the speaker with the existing NPC sprite. Show beats as short paragraphs and choices as large stacked buttons with human-readable details. Close is allowed before choosing; after choosing, the panel becomes a readable result and can close normally.

- [ ] **Step 4: Add docket, handbook, and summary memory**

Show `本轮事件待回应` in the docket before resolution, the selected event result after resolution, the latest three history records in the league handbook, and the event title plus chosen label in round summary.

- [ ] **Step 5: Run syntax and pure tests**

Run: `node --check prototypes/integrated-day/game.js`

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit world and UI**

```bash
git add prototypes/integrated-day/world-content.js prototypes/integrated-day/world-content.test.mjs prototypes/integrated-day/index.html prototypes/integrated-day/styles.css prototypes/integrated-day/game.js
git commit -m "feat: bring league incidents onto the field"
```

### Task 5: Verify the authored incident loop and document it

**Files:**
- Modify: `prototypes/integrated-day/smoke-test.mjs`
- Modify: `prototypes/integrated-day/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces browser evidence that a physical incident changes state, blocks the early match, survives the match, appears in history next round, and fits desktop and mobile layouts.

- [ ] **Step 1: Extend browser smoke flow**

After entering the first league round, assert the incident marker and pending docket copy. Open `shared-pitch`, choose `share-half`, verify Xiaoman relationship and community support change, then complete three actions and the match. In round two, open the handbook and verify the first incident result in history.

- [ ] **Step 2: Verify mobile event dialog**

At 390 × 844, assert the event panel stays inside the viewport, its three choices remain reachable by scrolling, no horizontal overflow appears, and reduced-motion mode does not hide controls.

- [ ] **Step 3: Update handoff docs**

Document the seven-event first-season arc, deterministic later-season rotation, persistent event history, match callbacks, version 5 compatibility, and remaining limits.

- [ ] **Step 4: Run final verification**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Run: `node prototypes/integrated-day/smoke-test.mjs`

Run: `git diff --check`

Expected: all pure tests and the complete browser journey PASS with zero console errors.

- [ ] **Step 5: Commit verification and docs**

```bash
git add prototypes/integrated-day/smoke-test.mjs prototypes/integrated-day/README.md README.md
git commit -m "test: cover recurring league incidents"
```
