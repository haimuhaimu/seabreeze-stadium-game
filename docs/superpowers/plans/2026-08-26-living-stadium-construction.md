# Living Stadium Construction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every persistent stadium project visibly transform the world, relocate its everyday NPC, and support one free relationship-building facility visit per round.

**Architecture:** Add a focused construction content module for visual regions, level copy, patrons, and NPC placements. Keep visit rules in season state, shared economy/time effects in game state, physical targets in world content, and DOM rendering in the existing game shell. Preserve save version 5 by normalizing the new weekly array.

**Tech Stack:** Browser-native ES modules, HTML, CSS, Node test runner, existing Playwright-compatible smoke harness.

## Global Constraints

- Preserve the existing hand-painted seaside maps and coral action accent.
- A facility visit takes 12 minutes, consumes no weekly work action, adds exactly 1 patron relationship, and can happen once per project per round.
- Project levels, relationships, and elite history persist across seasons; weekly visits reset each round.
- Keep save version 5 and normalize missing `visitedProjectIds` to `[]`.
- Do not stage or modify the user's untracked source images or `prototypes/day-loop/`.

---

### Task 1: Construction scene content

**Files:**
- Create: `prototypes/integrated-day/construction-content.js`
- Create: `prototypes/integrated-day/construction-content.test.mjs`

**Interfaces:**
- Produces: `CONSTRUCTION_SCENES`, `getConstructionScene(projectId)`, `getConstructionVisuals(mapId, projects)`, `getConstructionNpcPlacement(season, npcId)`.

- [ ] **Step 1: Write failing content tests**

Assert five projects, literal map coordinates, three authored level copies per project, and the patron placement that appears only after level 1.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test prototypes/integrated-day/construction-content.test.mjs`

Expected: module or named exports are missing.

- [ ] **Step 3: Implement the immutable content getters**

Define one scene per existing project with map rectangle, interaction point, patron, three level descriptions, and stage labels. Reject unknown IDs, maps, malformed project levels, and NPC IDs without a placement.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test prototypes/integrated-day/construction-content.test.mjs`

Expected: all construction content tests pass.

- [ ] **Step 5: Commit**

Commit: `feat: describe the stadium construction scenes`

### Task 2: Free facility visits and save compatibility

**Files:**
- Modify: `prototypes/integrated-day/season-state.js`
- Modify: `prototypes/integrated-day/season-state.test.mjs`
- Modify: `prototypes/integrated-day/save-game.js`
- Modify: `prototypes/integrated-day/save-game.test.mjs`

**Interfaces:**
- Produces: `recordSeasonProjectVisit(state, projectId)`.
- State: `season.week.visitedProjectIds: string[]`.

- [ ] **Step 1: Write failing visit and migration tests**

Cover level-zero rejection, one free visit, patron bond cap, duplicate rejection, reset next round, and old version 5 normalization.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test prototypes/integrated-day/season-state.test.mjs prototypes/integrated-day/save-game.test.mjs`

Expected: the visit export and normalized field are missing.

- [ ] **Step 3: Implement minimal state behavior**

Add the weekly array to constructors/cloners/normalizers and implement a visit that adds only the project ID and one patron relationship.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same focused command. Expected: all pass.

- [ ] **Step 5: Commit**

Commit: `feat: let players revisit built facilities`

### Task 3: Shared game effects, NPC migration, and world targets

**Files:**
- Modify: `prototypes/integrated-day/game-state.js`
- Modify: `prototypes/integrated-day/game-state.test.mjs`
- Modify: `prototypes/integrated-day/npc-schedules.js`
- Modify: `prototypes/integrated-day/npc-schedules.test.mjs`
- Modify: `prototypes/integrated-day/world-content.js`
- Modify: `prototypes/integrated-day/world-content.test.mjs`

**Interfaces:**
- Produces: `visitSeasonProject(state, projectId)`.
- Consumes: construction scene getters and `recordSeasonProjectVisit`.

- [ ] **Step 1: Write failing integration tests**

Assert that a visit takes 12 minutes, writes one journal entry, changes no cash or work actions, moves the patron to the built facility, changes ordinary dialogue, and keeps a max-level target available.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/npc-schedules.test.mjs prototypes/integrated-day/world-content.test.mjs`

Expected: visit function, placement, or persistent world object assertions fail.

- [ ] **Step 3: Implement the three integrations**

Wrap the season transition in game state, apply placement only when no incident memory overrides copy, and keep construction objects in the world after completion.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same focused command. Expected: all pass.

- [ ] **Step 5: Commit**

Commit: `feat: bring built facilities into daily life`

### Task 4: Map layers and construction interaction

**Files:**
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/styles.css`
- Modify: `prototypes/integrated-day/smoke-test.mjs`

**Interfaces:**
- Renders: `[data-construction-visuals]` and project elements with `data-project` and `data-level`.
- Adds decision choices `visit:<projectId>` and `<projectId>`.

- [ ] **Step 1: Add failing browser assertions**

Load a league fixture with mixed project levels and assert five mapped states, a relocated patron, free visit effects, immediate layer update after building, a stable max-level target, no overflow at 390x844, and no console errors.

- [ ] **Step 2: Run smoke test and verify RED**

Run: `node prototypes/integrated-day/smoke-test.mjs`

Expected: construction layer selectors are absent.

- [ ] **Step 3: Add map rendering and interaction UI**

Render construction layers from content data, provide visit and upgrade choices in the existing decision sheet, pulse only the changed region after building, and add explicit mobile layout rules and reduced-motion fallback.

- [ ] **Step 4: Run smoke test and inspect screenshots**

Run the smoke test. Inspect desktop and mobile screenshots for overlap, text contrast, construction readability, and consistent map style.

- [ ] **Step 5: Commit**

Commit: `feat: show stadium projects on the map`

### Task 5: Final verification and documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the playable feature description**

Document visual project stages, facility visits, NPC relocation, persistence, and their link to league and elite results.

- [ ] **Step 2: Run the full pure suite**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run the full browser smoke suite**

Run: `node prototypes/integrated-day/smoke-test.mjs`

Expected: every campaign, league, construction, elite, layout, and console check passes.

- [ ] **Step 4: Check repository boundaries**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only the known user-owned untracked files remain.

- [ ] **Step 5: Commit**

Commit: `docs: explain the living stadium loop`
