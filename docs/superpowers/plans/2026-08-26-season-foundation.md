# Season Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the completed two-week story build into a repeatable seven-round league with persistent NPC bonds, stadium construction, standings,经营目标, and player-dependent results.

**Architecture:** Add immutable league content and a focused pure `season-state` module, then expose shared-resource wrappers from `game-state.js`. Keep the existing world renderer and match panel, but add season-specific objects and one compact season board. Upgrade saves to version 5 and migrate version 4 records in memory.

**Tech Stack:** Browser-native ES modules, HTML/CSS, Node.js built-in test runner, localStorage, existing CDP browser smoke runner.

## Global Constraints

- Preserve the prologue and both authored story weeks without changing their routes.
- A season has exactly seven regular rounds and an eight-team table.
- Talking to NPCs never consumes one of the three weekly work actions.
- Rest and weak preparation never block a match or the next season.
- Construction and relationships persist across seasons; standings and weekly actions reset.
- Choices use everyday language and require no football-management expertise.
- Save version is 5 and valid version 4 records migrate without losing settlements.
- Keep the current warm hand-painted presentation, coral accent, responsive layout, and reduced-motion behavior.

---

### Task 1: Lock league content, schedule, projects, and NPC contracts

**Files:**
- Create: `prototypes/integrated-day/season-content.js`
- Create: `prototypes/integrated-day/season-content.test.mjs`

**Interfaces:**
- Produces: `LEAGUE_TEAMS`, `SEASON_ROUNDS`, `SEASON_ACTIONS`, `SEASON_PROJECTS`, `SEASON_NPCS`, `SEASON_GOALS`, `MATCH_MOMENTS`, `getLeagueTeam(id)`, `getSeasonRound(roundIndex)`, `getSeasonNpc(id)`, and `getSeasonProject(id)`.
- Consumes: no mutable game state.

- [ ] **Step 1: Write failing content tests**

```js
test('seven rounds give Haifeng one match against every other club', () => {
  const opponents = SEASON_ROUNDS.map(round => round.playerOpponentId);
  assert.equal(opponents.length, 7);
  assert.equal(new Set(opponents).size, 7);
  assert.equal(opponents.includes('haifeng'), false);
});

test('projects and people expose persistent progression', () => {
  assert.deepEqual(Object.keys(SEASON_PROJECTS), ['stands', 'clinic', 'academy', 'market', 'lights']);
  assert.ok(Object.values(SEASON_PROJECTS).every(project => project.levels.length === 3));
  assert.deepEqual(Object.keys(SEASON_NPCS), ['coach-guo', 'lin-chuan', 'aunt-xu', 'xiaoman', 'shen-qiao', 'director-luo']);
});
```

- [ ] **Step 2: Run the focused test and confirm the module is missing**

Run: `node --test prototypes/integrated-day/season-content.test.mjs`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement immutable content**

Define eight clubs, a deterministic round-robin schedule, seven work actions, five three-level projects, six NPC response contracts, four goals, and three match moments. Every project level must include exact `cost`, `label`, and gameplay effects. Every NPC must include response labels and a `domain` callback.

- [ ] **Step 4: Run the content tests**

Run: `node --test prototypes/integrated-day/season-content.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit content**

```bash
git add prototypes/integrated-day/season-content.js prototypes/integrated-day/season-content.test.mjs
git commit -m "feat: define the Haifeng league season"
```

### Task 2: Build pure season progression and standings

**Files:**
- Create: `prototypes/integrated-day/season-state.js`
- Create: `prototypes/integrated-day/season-state.test.mjs`

**Interfaces:**
- Consumes: exports from `season-content.js`.
- Produces: `createSeasonState()`, `cloneSeasonState(state)`, `beginSeason(state)`, `recordSeasonNpcTalk(state, npcId, responseId)`, `recordSeasonAction(state, actionId)`, `upgradeSeasonProject(state, projectId)`, `getProjectUpgrade(state, projectId)`, `canStartSeasonMatch(state)`, `startSeasonMatch(state, snapshot)`, `getSeasonMatchMoment(state)`, `resolveSeasonMatchMoment(state, choiceId)`, `settleSeasonRound(state)`, `advanceSeasonRound(state)`, `getStandings(state)`, `getSeasonGoalStatus(state, snapshot)`, and `startNextSeason(state)`.

- [ ] **Step 1: Write failing state tests**

Cover one talk per NPC per round, exactly three work actions, no action spent on failed construction, persistent project levels, seven-round standings, ranking tie breakers, strong path versus weak path, goal status, and next-season reset.

```js
test('talking is free but weekly work stops after three actions', () => {
  let season = beginSeason(createSeasonState());
  season = recordSeasonNpcTalk(season, 'coach-guo', 'solve');
  assert.equal(season.week.actions.length, 0);
  for (const id of ['train-attack', 'community-open', 'maintenance']) season = recordSeasonAction(season, id);
  assert.throws(() => recordSeasonAction(season, 'shop-day'), /three actions/i);
});
```

- [ ] **Step 2: Run the state tests and confirm missing functions**

Run: `node --test prototypes/integrated-day/season-state.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement immutable season transitions**

Use table rows shaped as `{ teamId, played, won, drawn, lost, goalsFor, goalsAgainst, points }`. Resolve other fixtures deterministically from team strength and round index. Match callbacks inspect weekly action ids, project levels, NPC help, cohesion, and the supplied team snapshot.

- [ ] **Step 4: Prove player choices alter final rank**

Run two seven-round paths in tests. The prepared path must finish in the top four. The neglected path must finish below it and have fewer points. Neither path may throw or become unable to start a new season.

- [ ] **Step 5: Run the state tests**

Run: `node --test prototypes/integrated-day/season-state.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the season engine**

```bash
git add prototypes/integrated-day/season-state.js prototypes/integrated-day/season-state.test.mjs
git commit -m "feat: add repeatable league progression"
```

### Task 3: Connect shared resources and version 5 saves

**Files:**
- Modify: `prototypes/integrated-day/game-state.js`
- Modify: `prototypes/integrated-day/game-state.test.mjs`
- Modify: `prototypes/integrated-day/save-game.js`
- Modify: `prototypes/integrated-day/save-game.test.mjs`
- Modify: `prototypes/integrated-day/save-migration.js`
- Modify: `prototypes/integrated-day/save-migration.test.mjs`

**Interfaces:**
- Produces from `game-state.js`: `beginLeagueSeason(state)`, `chooseSeasonAction(state, actionId)`, `chooseSeasonNpcResponse(state, npcId, responseId)`, `buildSeasonProject(state, projectId)`, `startLeagueMatch(state)`, `resolveLeagueMatchChoice(state, choiceId)`, `advanceLeagueRound(state)`, and `beginNextLeagueSeason(state)`.
- Produces from migration: `migrateV4Record(record)`.

- [ ] **Step 1: Write failing integration and migration tests**

```js
test('the naming-week settlement opens a persistent league', () => {
  const state = beginLeagueSeason(completedNamingWeek());
  assert.equal(state.version, 5);
  assert.equal(state.season.active, true);
  assert.equal(state.season.roundIndex, 0);
});

test('version four saves gain an inactive season without losing the sign reveal', () => {
  const migrated = migrateV4Record(versionFourRecord());
  assert.equal(migrated.version, 5);
  assert.deepEqual(migrated.state.namingRights.settlement, versionFourRecord().state.namingRights.settlement);
  assert.equal(migrated.state.season.active, false);
});
```

- [ ] **Step 2: Run focused tests and confirm version 5 is unsupported**

Run: `node --test prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.test.mjs prototypes/integrated-day/save-migration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add shared-resource wrappers**

Work actions update existing economy, roster, facilities and community values exactly once. Project construction posts one ledger entry and consumes an action only after affordability is confirmed. Completed matches post attendance income and update cohesion before the round becomes complete.

- [ ] **Step 4: Upgrade saves**

Set `SAVE_KEY` to `seabreeze-club-save-v5`, retain `V4_SAVE_KEY`, validate the entire season shape, close an interrupted season match by clearing only the active match, and route versions 1 through 4 into version 5 records.

- [ ] **Step 5: Run all pure tests**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit state and saves**

```bash
git add prototypes/integrated-day/game-state.js prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.js prototypes/integrated-day/save-game.test.mjs prototypes/integrated-day/save-migration.js prototypes/integrated-day/save-migration.test.mjs
git commit -m "feat: connect league progress to saves"
```

### Task 4: Add persistent world targets and season NPC schedules

**Files:**
- Modify: `prototypes/integrated-day/world-content.js`
- Modify: `prototypes/integrated-day/world-content.test.mjs`
- Modify: `prototypes/integrated-day/npc-schedules.js`

**Interfaces:**
- Produces: `getSeasonWorldObjects(mapId, season)` and season-aware `getNpcSchedule(dayIndex, phase, context)`.
- Consumes: project levels, weekly actions and talked NPC ids from season state.

- [ ] **Step 1: Write failing world tests**

Assert that all five project targets have walkable approaches, training and shop actions appear on the correct maps, completed actions disappear for the current round, and all six NPCs are reachable every round across the two maps.

- [ ] **Step 2: Run focused tests and confirm targets are absent**

Run: `node --test prototypes/integrated-day/world-content.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add season targets and rotating dialogue**

Map project targets to visible stadium or training locations. Return NPC copy based on round, standings tier, relationship level and maxed projects. Preserve all existing authored schedules for days 3 through 16.

- [ ] **Step 4: Run world tests and commit**

```bash
node --test prototypes/integrated-day/world-content.test.mjs
git add prototypes/integrated-day/world-content.js prototypes/integrated-day/world-content.test.mjs prototypes/integrated-day/npc-schedules.js
git commit -m "feat: populate the repeatable season world"
```

### Task 5: Make the league playable in the browser

**Files:**
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/styles.css`
- Modify: `prototypes/integrated-day/game.js`

**Interfaces:**
- Consumes: Task 3 game-state wrappers and Task 4 world objects.
- Produces: full browser flow from second-week summary through seven rounds and next-season restart.

- [ ] **Step 1: Add the continuation and compact season board**

Add `[data-begin-season]`, `[data-season-board]`, rank, round, action, opponent, standings, goals, and match controls. Keep the board compact at desktop and above touch controls on mobile.

- [ ] **Step 2: Route world rendering and NPC decisions**

When `state.season.active`, use season NPC schedules and season world objects. NPC interactions open the decision panel with three responses. Work and project targets open plain-language effects and affordability states.

- [ ] **Step 3: Reuse the match panel and summaries**

Render the three season match moments, then show the round result and full standings in the daily summary. On round seven, show final rank, all four goal outcomes, elite qualification and a “开始下一赛季” action.

- [ ] **Step 4: Add visual states**

Style project markers, the season board, eight-row standings, goal sentences, relationship levels, disabled affordability, round summary and season ending. Verify contrast, no overflow, no visible em dash, and reduced motion.

- [ ] **Step 5: Run pure tests and syntax checks**

Run: `node --check prototypes/integrated-day/game.js && node --test prototypes/integrated-day/*.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the playable league**

```bash
git add prototypes/integrated-day/index.html prototypes/integrated-day/styles.css prototypes/integrated-day/game.js
git commit -m "feat: make the Haifeng league playable"
```

### Task 6: Verify the long-term loop and update handoff docs

**Files:**
- Modify: `prototypes/integrated-day/smoke-test.mjs`
- Modify: `prototypes/integrated-day/README.md`

**Interfaces:**
- Produces repeatable browser evidence for season entry, NPC talk, construction, three actions, a match, standings, season completion, next-season restart, saves, and mobile layout.

- [ ] **Step 1: Extend browser smoke coverage**

Start from the canonical second-week ending. Enter the league, talk to an NPC, build one affordable project, complete three actions, resolve a match, verify standings, fast-forward the remaining rounds through the same public controls, finish in the top four, and begin season two.

- [ ] **Step 2: Verify mobile and console**

At 390 × 844, verify the season board, NPC decision, standings and round summary remain inside the viewport and do not overlap touch controls. Assert zero browser errors.

- [ ] **Step 3: Update README**

Document the seven-round repeatable league, three weekly actions, six persistent relationships, five construction lines, standings, goals, elite qualification, version 5 saves and remaining story-content boundary.

- [ ] **Step 4: Run final verification**

```bash
node --test prototypes/integrated-day/*.test.mjs
node prototypes/integrated-day/smoke-test.mjs
git diff --check
```

Expected: all pure tests and browser flows PASS with no skipped tests or console errors.

- [ ] **Step 5: Commit verification and docs**

```bash
git add prototypes/integrated-day/smoke-test.mjs prototypes/integrated-day/README.md
git commit -m "test: cover the repeatable league loop"
```
