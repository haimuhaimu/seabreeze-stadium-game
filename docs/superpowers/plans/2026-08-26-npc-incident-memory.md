# NPC Incident Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recurring league NPCs remember and discuss the player's authored incident choices across rounds.

**Architecture:** Keep authored reaction copy in a dedicated content module and derive visible memory through a pure selector. Persist only which NPC follow-ups were completed this round; all conversation copy is deterministically reconstructed from event history. Thin game-state and UI adapters apply relationship/time effects and render the memory alongside existing formal responses.

**Tech Stack:** Native ES modules, Node test runner, HTML/CSS, browser smoke test through Chrome DevTools Protocol.

**Spec:** `docs/superpowers/specs/2026-08-26-npc-incident-memory-design.md`

## Global Constraints

- Do not increase save version 5.
- Incident follow-up never consumes one of the three weekly actions.
- Each of the 27 incident choices has exactly two authored NPC reactions.
- Only the current incident, or the immediately previous incident before the current one is resolved, may drive conversation memory.
- Existing formal NPC responses remain independently available once per round.
- Preserve the existing hand-painted visual system and mobile viewport fit.

---

### Task 1: Author the Reaction Deck

**Files:**
- Create: `prototypes/integrated-day/season-reactions.js`
- Create: `prototypes/integrated-day/season-reactions.test.mjs`

**Interfaces:**
- Produces: `SEASON_EVENT_REACTIONS`, `getSeasonEventReaction(eventId, choiceId, npcId)`, `getSeasonEventReactionNpcIds(eventId, choiceId)`.

- [ ] Write tests that iterate the real nine-event deck and require exactly two valid recurring NPC reactions for every choice.
- [ ] Run `node --test prototypes/integrated-day/season-reactions.test.mjs` and confirm failure because the module is missing.
- [ ] Author all 54 reactions and strict getters that reject unknown event, choice, and NPC identifiers.
- [ ] Re-run the focused tests and confirm they pass.
- [ ] Commit the reaction deck and tests.

### Task 2: Derive Visible Memory

**Files:**
- Create: `prototypes/integrated-day/season-memory.js`
- Create: `prototypes/integrated-day/season-memory.test.mjs`

**Interfaces:**
- Consumes: event history and the reaction getters from Task 1.
- Produces: `getSeasonNpcMemory(season, npcId)` returning `{ eventId, choiceId, eventTitle, choiceLabel, npcId, round, seasonNumber, timing, label, copy } | null`.

- [ ] Write literal-output tests for a current “shared pitch” reaction, the same choice remembered next round, an unrelated NPC returning `null`, and a newly resolved event replacing old context.
- [ ] Run the focused test and confirm failure because `season-memory.js` is missing.
- [ ] Implement the pure selector without mutating season state.
- [ ] Add and pass a second-season rotation case reconstructed from persisted event history.
- [ ] Commit the selector and tests.

### Task 3: Record Follow-Up Conversations

**Files:**
- Modify: `prototypes/integrated-day/season-state.js`
- Modify: `prototypes/integrated-day/season-state.test.mjs`
- Modify: `prototypes/integrated-day/game-state.js`
- Modify: `prototypes/integrated-day/game-state.test.mjs`
- Modify: `prototypes/integrated-day/save-game.test.mjs`

**Interfaces:**
- Produces: `recordSeasonMemoryTalk(season, npcId)` and `chooseSeasonNpcMemory(state, npcId)`.

- [ ] Add failing state tests for default `memoryNpcIds`, old-v5 normalization, no-action relationship gain, 0-5 clamping, unrelated NPC rejection, and same-round duplicate rejection.
- [ ] Run focused state tests and confirm the missing behavior fails.
- [ ] Implement the week field, clone normalization, and pure state transition.
- [ ] Add failing shared-state and save round-trip tests for the six-minute, journal, relationship, and persisted-memory effects.
- [ ] Implement the thin game-state wrapper and pass focused tests.
- [ ] Run all pure tests and commit the state layer.

### Task 4: Render Memory in NPC Conversations

**Files:**
- Modify: `prototypes/integrated-day/npc-schedules.js`
- Modify: `prototypes/integrated-day/world-content.test.mjs`
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/styles.css`

**Interfaces:**
- Consumes: `getSeasonNpcMemory` and `chooseSeasonNpcMemory`.
- Produces: schedule `memory` metadata, visible memory context, and `[data-season-memory-talk]` interaction.

- [ ] Write a failing schedule test proving Xiaoman's copy changes after `share-half` while Director Luo keeps his normal copy.
- [ ] Implement schedule memory metadata and pass the test.
- [ ] Add the memory strip and follow-up action to the existing conversation dialog.
- [ ] Keep formal response buttons independent and show a completed memory note after follow-up.
- [ ] Add mobile collapse rules and bump asset query versions.
- [ ] Run syntax, pure tests, and commit the UI integration.

### Task 5: Verify Across Rounds

**Files:**
- Modify: `prototypes/integrated-day/smoke-test.mjs`
- Modify: `prototypes/integrated-day/README.md`

**Interfaces:**
- Browser contract: current-event follow-up, relationship gain, no action spent, persisted previous-round copy, mobile fit, clean console.

- [ ] Extend the league smoke path to revisit Xiaoman after the first incident and complete the follow-up.
- [ ] After entering round two, walk back to Xiaoman before resolving the new incident and assert the prior choice is still named.
- [ ] Capture the desktop or mobile memory conversation and check viewport bounds.
- [ ] Update README behavior and verification coverage.
- [ ] Run `node --check prototypes/integrated-day/game.js`, all pure tests, and the full browser smoke test.
- [ ] Inspect screenshots, run `git diff --check`, and commit the verified milestone.

