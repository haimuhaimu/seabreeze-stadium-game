# 海风球场首个经营周 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有春12日至14日序章之后，加入春15日至21日的第一个完整经营周，玩家能在两张地图间活动、面对沈峤、选择外队并完成周日比赛和结算。

**Architecture:** 保留当前原生 HTML、CSS 与 ES Modules，不引入构建工具或第三方依赖。把经营规则、外队数据、人物作息、比赛模拟和存档迁移放入独立纯模块，`game.js` 仅协调输入、场景与界面；旧序章状态通过版本迁移进入新结构。

**Tech Stack:** 原生 HTML/CSS、Canvas 外的 DOM 场景、ES Modules、Node.js `node:test`、Chrome DevTools Protocol 浏览器冒烟测试、本地图片资产。

## Global Constraints

- 现有春12日至14日流程、移动、开店、修缮和三脚训练必须继续可玩。
- 第一轮只实现春15日至21日，不实现完整十二周、完整足球操控、恋爱、钓鱼、种植和多结局。
- 新主赛场与旧训练场必须都可自由行走，并在桌面和手机上保持完整控制。
- 春15日至21日必须依次完成账本、训练、外队、集市、设施、接待与比赛七个主线节点。
- 未完成可选人物事件不得阻塞日期推进。
- 现金不足必须触发可恢复的周转方案，不得形成死档。
- 旧存档迁移成功前不得覆盖原记录。
- 比赛必须确定性可测试，三次高光选择可改变比分与周结算。
- 画面沿用统一的手绘儿童动画语言，主色为海蓝、草绿与珊瑚红；不用 AI 紫渐变、玻璃拟态或网站式卡片墙。
- 界面可见文案不使用破折号字符，动效尊重 `prefers-reduced-motion`。

---

### Task 1: 建立春15日至21日主线日历

**Files:**
- Create: `prototypes/integrated-day/campaign-content.js`
- Create: `prototypes/integrated-day/campaign-content.test.mjs`
- Modify: `prototypes/integrated-day/daily-content.js`

**Interfaces:**
- Produces: `CAMPAIGN_DAYS`, `getCampaignDay(dayIndex)`, `getRequiredAction(dayIndex)`, `isPrologueDay(dayIndex)`, `isManagementWeekDay(dayIndex)`。
- Consumes: 旧 `DAYS` 仍负责序章订单；全局 `dayIndex` 范围扩为 `0..9`，对应春12日至21日。

- [ ] **Step 1: 写失败测试，锁定十天日历与七个主线节点**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_DAYS,
  getCampaignDay,
  getRequiredAction,
  isPrologueDay,
  isManagementWeekDay
} from './campaign-content.js';

test('campaign calendar joins the three-day prologue to one management week', () => {
  assert.deepEqual(CAMPAIGN_DAYS.map(day => day.date), [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  assert.equal(isPrologueDay(2), true);
  assert.equal(isManagementWeekDay(3), true);
  assert.equal(getCampaignDay(9).weekday, '周日');
});

test('the first week has one required mainline action per day', () => {
  assert.deepEqual(CAMPAIGN_DAYS.slice(3).map(day => getRequiredAction(day.dayIndex)), [
    'review-ledger',
    'choose-training',
    'choose-opponent',
    'choose-market',
    'prepare-facility',
    'welcome-opponent',
    'play-match'
  ]);
});
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run: `node --test prototypes/integrated-day/campaign-content.test.mjs`

Expected: FAIL，错误包含 `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现冻结的日历内容**

```js
const entries = [
  ['周五', 12, '抵达', null, 'training'],
  ['周六', 13, '一起训练', null, 'training'],
  ['周日', 14, '友谊赛日', null, 'training'],
  ['周一', 15, '账本上的缺口', 'review-ledger', 'stadium'],
  ['周二', 16, '谁能上场', 'choose-training', 'training'],
  ['周三', 17, '邀请谁来', 'choose-opponent', 'stadium'],
  ['周四', 18, '看台之外', 'choose-market', 'training'],
  ['周五', 19, '比赛前夜', 'prepare-facility', 'stadium'],
  ['周六', 20, '客队抵达', 'welcome-opponent', 'stadium'],
  ['周日', 21, '第一场主场周赛', 'play-match', 'stadium']
];

export const CAMPAIGN_DAYS = Object.freeze(entries.map((entry, dayIndex) => Object.freeze({
  dayIndex,
  season: '春',
  weekday: entry[0],
  date: entry[1],
  title: entry[2],
  requiredAction: entry[3],
  defaultMap: entry[4],
  weather: dayIndex === 9 ? '晴，傍晚有海风' : '海风转晴'
})));

export function getCampaignDay(dayIndex) {
  const index = Math.max(0, Math.min(CAMPAIGN_DAYS.length - 1, Math.trunc(Number(dayIndex) || 0)));
  return CAMPAIGN_DAYS[index];
}

export const getRequiredAction = dayIndex => getCampaignDay(dayIndex).requiredAction;
export const isPrologueDay = dayIndex => dayIndex >= 0 && dayIndex <= 2;
export const isManagementWeekDay = dayIndex => dayIndex >= 3 && dayIndex <= 9;
```

在 `daily-content.js` 中保留 `DAYS` 和订单 API，只把越界访问从“钳制到第3天”改为明确只服务 `0..2`。管理周不再调用序章订单。

- [ ] **Step 4: 运行日历与旧订单测试**

Run: `node --test prototypes/integrated-day/campaign-content.test.mjs prototypes/integrated-day/daily-content.test.mjs`

Expected: 5 tests PASS。

- [ ] **Step 5: 提交日历模块**

```bash
git add prototypes/integrated-day/campaign-content.js prototypes/integrated-day/campaign-content.test.mjs prototypes/integrated-day/daily-content.js
git commit -m "feat: add first management week calendar"
```

### Task 2: 建立经营、设施、治理与外队规则

**Files:**
- Create: `prototypes/integrated-day/economy-state.js`
- Create: `prototypes/integrated-day/facility-state.js`
- Create: `prototypes/integrated-day/governance-state.js`
- Create: `prototypes/integrated-day/opponent-content.js`
- Create: `prototypes/integrated-day/management-state.test.mjs`

**Interfaces:**
- Produces: `createEconomy()`, `postLedgerEntry()`, `resolveShortfall()`；`createFacilities()`, `prepareFacility()`；`createGovernance()`, `applyGovernanceEffect()`；`OPPONENTS`, `getOpponent()`。
- All transitions return fresh objects and never mutate the caller.

- [ ] **Step 1: 写经营规则失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEconomy, postLedgerEntry, resolveShortfall } from './economy-state.js';
import { createFacilities, prepareFacility } from './facility-state.js';
import { createGovernance, applyGovernanceEffect } from './governance-state.js';
import { OPPONENTS, getOpponent } from './opponent-content.js';

test('ledger records signed income and expense entries', () => {
  let economy = createEconomy(40);
  economy = postLedgerEntry(economy, { id: 'deposit', label: '社区预约金', amount: 120 });
  economy = postLedgerEntry(economy, { id: 'wages', label: '本周工资', amount: -70 });
  assert.equal(economy.cash, 90);
  assert.deepEqual(economy.entries.map(entry => entry.id), ['deposit', 'wages']);
});

test('negative cash offers three recoverable shortfall routes', () => {
  const economy = postLedgerEntry(createEconomy(10), { id: 'bill', label: '维护', amount: -40 });
  assert.equal(resolveShortfall(economy, 'delay').cash, 0);
  assert.equal(resolveShortfall(economy, 'community').communityDelta, -6);
  assert.equal(resolveShortfall(economy, 'shen').shenInfluenceDelta, 1);
});

test('opponents create different cost audience and difficulty profiles', () => {
  assert.deepEqual(Object.keys(OPPONENTS), ['harbor-workers', 'city-university']);
  assert.ok(getOpponent('harbor-workers').cost < getOpponent('city-university').cost);
  assert.ok(getOpponent('harbor-workers').difficulty < getOpponent('city-university').difficulty);
  assert.ok(getOpponent('city-university').expectedAudience > getOpponent('harbor-workers').expectedAudience);
});

test('facility and governance effects are clamped', () => {
  assert.equal(prepareFacility(createFacilities(), 'floodlights').condition, 56);
  assert.equal(applyGovernanceEffect(createGovernance(), { support: 9, shenInfluence: 2 }).support, 5);
});
```

- [ ] **Step 2: 运行并确认四个模块缺失**

Run: `node --test prototypes/integrated-day/management-state.test.mjs`

Expected: FAIL，错误包含 `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现经营与周转**

```js
export function createEconomy(cash = 0) {
  return { cash, entries: [], shortfall: null };
}

export function postLedgerEntry(economy, entry) {
  if (!entry?.id || !entry?.label || !Number.isFinite(entry.amount)) throw new TypeError('Invalid ledger entry');
  if (economy.entries.some(item => item.id === entry.id)) return economy;
  return { ...economy, cash: economy.cash + entry.amount, entries: [...economy.entries, { ...entry }] };
}

export function resolveShortfall(economy, route) {
  if (economy.cash >= 0) return { ...economy, communityDelta: 0, trustDelta: 0, shenInfluenceDelta: 0 };
  const debt = Math.abs(economy.cash);
  const effects = {
    delay: { communityDelta: 0, trustDelta: -1, shenInfluenceDelta: 0 },
    community: { communityDelta: -6, trustDelta: 0, shenInfluenceDelta: 0 },
    shen: { communityDelta: 0, trustDelta: 0, shenInfluenceDelta: 1 }
  };
  if (!effects[route]) throw new TypeError('Invalid shortfall route');
  return { ...economy, cash: 0, shortfall: { route, amount: debt }, ...effects[route] };
}
```

- [ ] **Step 4: 实现设施、治理和外队内容**

```js
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createFacilities() {
  return { condition: 48, prepared: null, audienceBonus: 0, performanceBonus: 0 };
}

export const FACILITY_PLANS = Object.freeze({
  floodlights: { label: '检修灯光', cost: 30, condition: 8, audience: 18, performance: 0 },
  stands: { label: '加固看台', cost: 18, condition: 5, audience: 10, performance: 0 },
  grass: { label: '补平草皮', cost: 24, condition: 7, audience: 0, performance: 4 }
});

export function prepareFacility(facilities, planId) {
  const plan = FACILITY_PLANS[planId];
  if (!plan) throw new TypeError('Invalid facility plan');
  return {
    ...facilities,
    prepared: planId,
    condition: clamp(facilities.condition + plan.condition, 0, 100),
    audienceBonus: facilities.audienceBonus + plan.audience,
    performanceBonus: facilities.performanceBonus + plan.performance
  };
}

export function createGovernance() { return { support: 1, shenInfluence: 1 }; }
export function applyGovernanceEffect(state, effect) {
  return {
    support: clamp(state.support + (effect.support || 0), 0, 5),
    shenInfluence: clamp(state.shenInfluence + (effect.shenInfluence || 0), 0, 5)
  };
}

export const OPPONENTS = Object.freeze({
  'harbor-workers': Object.freeze({ id: 'harbor-workers', name: '港口工人队', cost: 30, expectedAudience: 70, difficulty: 48, publicity: 2, community: 6 }),
  'city-university': Object.freeze({ id: 'city-university', name: '城市高校联队', cost: 55, expectedAudience: 110, difficulty: 62, publicity: 8, community: 3 })
});
export function getOpponent(id) {
  const opponent = OPPONENTS[id];
  if (!opponent) throw new TypeError('Invalid opponent');
  return opponent;
}
```

- [ ] **Step 5: 运行规则测试并提交**

Run: `node --test prototypes/integrated-day/management-state.test.mjs`

Expected: 4 tests PASS。

```bash
git add prototypes/integrated-day/economy-state.js prototypes/integrated-day/facility-state.js prototypes/integrated-day/governance-state.js prototypes/integrated-day/opponent-content.js prototypes/integrated-day/management-state.test.mjs
git commit -m "feat: add management week rules"
```

### Task 3: 建立球队养成与确定性比赛

**Files:**
- Create: `prototypes/integrated-day/roster-state.js`
- Create: `prototypes/integrated-day/match-engine.js`
- Create: `prototypes/integrated-day/match-engine.test.mjs`

**Interfaces:**
- Produces: `createRoster()`, `chooseTrainingFocus()`；`createMatch()`, `resolveHighlight()`, `finishMatch()`。
- `match-engine` consumes opponent difficulty, facility performance bonus, cohesion and training modifier; no random number generator.

- [ ] **Step 1: 写三次高光与训练选择失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoster, chooseTrainingFocus } from './roster-state.js';
import { createMatch, resolveHighlight, finishMatch } from './match-engine.js';

test('training focus changes roster without mutating its input', () => {
  const roster = createRoster();
  const trained = chooseTrainingFocus(roster, 'shape');
  assert.equal(roster.trainingFocus, null);
  assert.equal(trained.defense, 53);
  assert.equal(trained.cohesion, 48);
});

test('three highlight choices produce a deterministic match result', () => {
  let match = createMatch({ opponentDifficulty: 48, attack: 48, defense: 53, cohesion: 48, facilityBonus: 4 });
  match = resolveHighlight(match, 'patient-build');
  match = resolveHighlight(match, 'protect-youngster');
  match = resolveHighlight(match, 'press-late');
  const result = finishMatch(match);
  assert.equal(match.highlightIndex, 3);
  assert.deepEqual(result.score, { home: 2, away: 1 });
  assert.equal(result.complete, true);
});

test('an unfinished match cannot be settled', () => {
  const match = createMatch({ opponentDifficulty: 62, attack: 48, defense: 48, cohesion: 46, facilityBonus: 0 });
  assert.throws(() => finishMatch(match), /three highlights/i);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test prototypes/integrated-day/match-engine.test.mjs`

Expected: FAIL，错误包含 `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现球队训练选择**

```js
export function createRoster() {
  return { attack: 48, defense: 48, cohesion: 46, trainingFocus: null, injuryRisk: 0, youthTrust: 0 };
}

export const TRAINING_FOCUS = Object.freeze({
  pressing: { attack: 6, defense: 0, cohesion: 0, injuryRisk: 2, youthTrust: 0 },
  shape: { attack: 0, defense: 5, cohesion: 2, injuryRisk: 0, youthTrust: 0 },
  youth: { attack: 2, defense: 1, cohesion: 3, injuryRisk: 0, youthTrust: 2 }
});

export function chooseTrainingFocus(roster, focusId) {
  const focus = TRAINING_FOCUS[focusId];
  if (!focus || roster.trainingFocus) throw new TypeError('Invalid training focus');
  return {
    ...roster,
    trainingFocus: focusId,
    attack: roster.attack + focus.attack,
    defense: roster.defense + focus.defense,
    cohesion: roster.cohesion + focus.cohesion,
    injuryRisk: roster.injuryRisk + focus.injuryRisk,
    youthTrust: roster.youthTrust + focus.youthTrust
  };
}
```

- [ ] **Step 4: 实现三段确定性比赛**

`createMatch` 保存双方实力与 `highlightIndex: 0`、`homeGoals: 0`、`awayGoals: 0`、`momentum: 0`。三个节点只接受下列选择：

```js
export const HIGHLIGHTS = Object.freeze([
  Object.freeze({ id: 'opening', title: '第18分钟，对方压上', choices: ['patient-build', 'direct-ball'] }),
  Object.freeze({ id: 'middle', title: '第56分钟，小满被针对', choices: ['protect-youngster', 'replace-youngster'] }),
  Object.freeze({ id: 'closing', title: '第82分钟，比分仍很近', choices: ['press-late', 'hold-shape'] })
]);

const EFFECTS = Object.freeze({
  'patient-build': { home: 1, away: 0, momentum: 1 },
  'direct-ball': { home: 0, away: 0, momentum: 0 },
  'protect-youngster': { home: 0, away: 0, momentum: 1 },
  'replace-youngster': { home: 0, away: 0, momentum: -1 },
  'press-late': { home: 1, away: 1, momentum: 0 },
  'hold-shape': { home: 0, away: 0, momentum: 0 }
});
```

对手基础难度比主队综合值高出10点以上时，在第二节点增加一个客队进球；主队综合值高出10点以上时，在第一节点增加一个主队进球。`finishMatch` 必须在三节点完成后返回比分、胜平负、凝聚变化和观众情绪。

- [ ] **Step 5: 运行比赛测试并提交**

Run: `node --test prototypes/integrated-day/match-engine.test.mjs`

Expected: 3 tests PASS。

```bash
git add prototypes/integrated-day/roster-state.js prototypes/integrated-day/match-engine.js prototypes/integrated-day/match-engine.test.mjs
git commit -m "feat: add deterministic weekly match"
```

### Task 4: 将总状态升级到版本2并迁移旧存档

**Files:**
- Create: `prototypes/integrated-day/save-migration.js`
- Create: `prototypes/integrated-day/save-migration.test.mjs`
- Modify: `prototypes/integrated-day/game-state.js`
- Modify: `prototypes/integrated-day/game-state.test.mjs`
- Modify: `prototypes/integrated-day/save-game.js`
- Modify: `prototypes/integrated-day/save-game.test.mjs`

**Interfaces:**
- Produces: `migrateV1Record(record)`, `beginManagementWeek(state)`, `completeRequiredAction(state, actionId, choiceId)`, `resolveManagementShortfall(state, route)`, `startWeeklyMatch(state)`, `chooseMatchHighlight(state, choiceId)`, `finishManagementDay(state)`, `advanceCampaignDay(state)`。
- Version 2 state adds `campaign`, `economy`, `facilities`, `roster`, `governance`, `management`, and `world` while retaining all prologue fields.

- [ ] **Step 1: 写迁移与完整七日状态测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState,
  beginManagementWeek,
  completeRequiredAction,
  startWeeklyMatch,
  chooseMatchHighlight,
  finishManagementDay,
  advanceCampaignDay
} from './game-state.js';
import { migrateV1Record } from './save-migration.js';

test('a completed version one prologue migrates without losing repairs relationships or money', () => {
  const legacy = { ...createGameState(), version: 1, dayIndex: 2, phase: 'complete', chapterComplete: true, money: 37, repairs: ['awning'], relationship: { coachMet: true, coachTrust: 2 } };
  delete legacy.campaign;
  delete legacy.economy;
  delete legacy.facilities;
  delete legacy.roster;
  delete legacy.governance;
  delete legacy.management;
  delete legacy.world;
  const v1 = { version: 1, state: legacy, position: { x: 50, y: 89 } };
  const migrated = migrateV1Record(v1);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.state.money, 37);
  assert.deepEqual(migrated.state.repairs, ['awning']);
  assert.equal(migrated.state.relationship.coachTrust, 2);
  assert.equal(migrated.state.world.mapId, 'training');
});

test('the management week advances only after each required action', () => {
  const prologue = { ...createGameState(), dayIndex: 2, phase: 'complete', chapterComplete: true };
  let state = beginManagementWeek(prologue);
  assert.equal(state.dayIndex, 3);
  const blocked = finishManagementDay(state);
  assert.equal(blocked.phase, 'morning');
  state = completeRequiredAction(state, 'review-ledger', 'acknowledge');
  state = finishManagementDay(state);
  state = advanceCampaignDay(state);
  assert.equal(state.dayIndex, 4);
});

test('seven management actions produce a weekly settlement', () => {
  const prologue = { ...createGameState(), dayIndex: 2, phase: 'complete', chapterComplete: true };
  let state = beginManagementWeek(prologue);
  const choices = [
    ['review-ledger', 'acknowledge'],
    ['choose-training', 'shape'],
    ['choose-opponent', 'harbor-workers'],
    ['choose-market', 'youth-clinic'],
    ['prepare-facility', 'grass'],
    ['welcome-opponent', 'community-welcome']
  ];
  for (const [action, choice] of choices) {
    state = completeRequiredAction(state, action, choice);
    state = finishManagementDay(state);
    state = advanceCampaignDay(state);
  }
  state = startWeeklyMatch(state);
  state = chooseMatchHighlight(state, 'patient-build');
  state = chooseMatchHighlight(state, 'protect-youngster');
  state = chooseMatchHighlight(state, 'press-late');
  state = finishManagementDay(state);
  assert.equal(state.management.weekComplete, true);
  assert.ok(state.management.settlement);
});
```

- [ ] **Step 2: 实现版本2初始结构与纯状态协调**

`createGameState()` 返回 `version: 2`，并新增：

```js
campaign: { prologueComplete: false, week: 0 },
economy: createEconomy(0),
facilities: createFacilities(),
roster: createRoster(),
governance: createGovernance(),
management: {
  completedActions: [],
  opponentId: null,
  trainingFocus: null,
  marketPlan: null,
  facilityPlan: null,
  welcomePlan: null,
  match: null,
  settlement: null,
  shortfallPending: false,
  weekComplete: false
},
world: { mapId: 'training', positions: { training: { x: 50, y: 89 }, stadium: { x: 12, y: 78 } } }
```

`beginManagementWeek` 只接受已完成的序章，把状态推进到 `dayIndex: 3`，以序章 `money` 初始化经营现金，注入120元社区预约金，并扣除70元工资和30元基础维护。`completeRequiredAction` 根据日期校验春15日至20日的 action；重复 action 无效。周日由 `startWeeklyMatch` 创建比赛，`chooseMatchHighlight` 连续处理三次高光并在第三次后自动记录 `play-match`。若账本低于0，设置 `shortfallPending`，必须先调用 `resolveManagementShortfall` 解决周转才能结束当天。管理周所有界面使用 `economy.cash`；旧的顶层 `money` 只保留给序章兼容代码，并在保存时同步为同一个数值。

- [ ] **Step 3: 实现安全迁移与双版本读取**

```js
export function migrateV1Record(record) {
  if (record?.version !== 1 || record?.state?.version !== 1) throw new TypeError('Unsupported legacy save');
  const base = createGameState();
  return {
    version: 2,
    state: {
      ...base,
      ...record.state,
      version: 2,
      campaign: { ...base.campaign, prologueComplete: record.state.chapterComplete },
      economy: createEconomy(record.state.money),
      world: { ...base.world, positions: { ...base.world.positions, training: { ...record.position } } }
    },
    position: { ...record.position },
    mapId: 'training'
  };
}
```

`loadSave` 先尝试版本2；遇到有效版本1时返回迁移后的记录以及 `migrated: true`，但不写入 storage。只有下一次有效玩家行动调用 `writeSave` 时，才写入版本2键 `seabreeze-club-save-v2`。`clearSave` 只清除 v1 与 v2 两个项目键。

- [ ] **Step 4: 运行全部纯规则测试**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: 所有旧测试更新为版本2后 PASS，新增迁移和七日测试 PASS。

- [ ] **Step 5: 提交状态与迁移**

```bash
git add prototypes/integrated-day/game-state.js prototypes/integrated-day/game-state.test.mjs prototypes/integrated-day/save-game.js prototypes/integrated-day/save-game.test.mjs prototypes/integrated-day/save-migration.js prototypes/integrated-day/save-migration.test.mjs
git commit -m "feat: extend save state into management week"
```

### Task 5: 生成人物一致的新主赛场视觉资产

**Files:**
- Create: `prototypes/integrated-day/assets/seabreeze-main-stadium-v1.png`
- Create: `prototypes/integrated-day/assets/shen-qiao-handpainted-v1.png`
- Reference: `prototypes/integrated-day/assets/seaside-club-handpainted-v4.png`
- Reference: `prototypes/integrated-day/assets/team-roster-handpainted-v2-aligned.png`

**Interfaces:**
- Main stadium image is a wide top-down playable map with clear walking routes and no baked text or characters.
- Shen Qiao asset provides a complete uncropped full-body pose on transparent or removable flat background.

- [ ] **Step 1: 检查两张现有参考资产的完整人物比例、线条、光影和地图机位**

Run: use the local image viewer on both reference paths.

Expected: map and character references are legible at original resolution; no file is replaced.

- [ ] **Step 2: 生成主赛场图**

Use the existing map as image reference with this exact direction:

```text
Create a new playable main-stadium background that belongs to the same fictional seaside club as the reference image. Wide 16:9 orthographic three-quarter top-down composition. A full eleven-a-side natural grass football pitch occupies the center. Add two modest modern covered stands, four floodlight masts, a real scoreboard without readable text, concrete and glass club offices, home and away changing-room entrances, a physiotherapy room entrance, a small archive office, a seaside market strip, a compact performance stage, guest-team bus access, volunteer point and live-stream platform. Keep the sea and coastal promenade clearly visible beyond the stadium. Modern community venue, maintained but financially strained. 1990s Japanese children's TV comedy animation background language, clean dark linework, flat cel shading, controlled watercolor texture, bright natural daylight. No characters, no logos, no readable words, no photorealism, no dramatic fantasy lighting, no painterly AI blur. Preserve generous connected walking paths around the lower and side edges for gameplay.
```

- [ ] **Step 3: 生成沈峤完整人物图**

Use the aligned team roster as image reference with this exact direction:

```text
Create one complete full-body Chinese male character matching the exact proportions, line weight, facial simplification and cel shading of the reference roster. Shen Qiao is in his late forties, composed and physically fit, with neatly combed short black hair with subtle grey at the temples. He wears a modern slate-blue sports-business windbreaker, charcoal trousers and clean dark trainers. He should look credible and controlled, not like a cartoon villain. Neutral standing pose facing slightly forward, both feet and the top of the hair fully visible, no cropping. Plain transparent background if possible, otherwise one uniform chroma background. No text, no props, no extra characters.
```

- [ ] **Step 4: 检查最终资产**

Expected:

- 主赛场不是旧训练场的简单放大，十一人草场、看台、灯光、办公室、集市和海岸层次均可辨认。
- 主要行走区域没有被建筑或贴图细节遮断。
- 沈峤头顶、双脚和外套轮廓完整，人物画风与现有六人表一致。
- 两张资产没有可读文字、水印、额外肢体或明显风格漂移。

- [ ] **Step 5: 提交视觉资产**

```bash
git add prototypes/integrated-day/assets/seabreeze-main-stadium-v1.png prototypes/integrated-day/assets/shen-qiao-handpainted-v1.png
git commit -m "feat: add main stadium and Shen Qiao art"
```

### Task 6: 加入两张地图、出口与人物作息

**Files:**
- Create: `prototypes/integrated-day/world-content.js`
- Create: `prototypes/integrated-day/npc-schedules.js`
- Create: `prototypes/integrated-day/world-content.test.mjs`
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/styles.css`

**Interfaces:**
- Produces: `MAPS`, `getMap()`, `getMapObjects()`, `canStandOnMap()`；`getNpcSchedule(dayIndex, phase)`。
- `game.js` owns `activeMapId`, saves per-map positions, swaps map image and blocked areas, and renders scheduled NPC buttons.

- [ ] **Step 1: 写地图与作息失败测试**

```js
test('training and stadium maps have reciprocal exits and safe spawn points', () => {
  assert.equal(MAPS.training.exits[0].targetMap, 'stadium');
  assert.equal(MAPS.stadium.exits[0].targetMap, 'training');
  assert.equal(canStandOnMap('stadium', MAPS.stadium.start.x, MAPS.stadium.start.y), true);
});

test('Lin Xu and Xiaoman all appear during the first week', () => {
  const names = new Set();
  for (let dayIndex = 3; dayIndex <= 9; dayIndex += 1) {
    for (const npc of getNpcSchedule(dayIndex, 'morning')) names.add(npc.name);
  }
  assert.equal(names.has('林川'), true);
  assert.equal(names.has('许姨'), true);
  assert.equal(names.has('小满'), true);
});

test('Shen Qiao enters at the main stadium on spring 15', () => {
  const shen = getNpcSchedule(3, 'morning').find(npc => npc.id === 'shen-qiao');
  assert.equal(shen.mapId, 'stadium');
  assert.match(shen.copy, /债务|合作/);
});
```

- [ ] **Step 2: 实现地图配置**

`MAPS.training` 使用现有1672×941资产和现有碰撞区；`MAPS.stadium` 使用新资产、独立碰撞区、入口出生点 `{ x: 12, y: 78 }`。训练场出口位于右下海滨路，主赛场出口位于左下入口。每个出口使用 `kind: 'exit'` 和目标地图出生点，不靠 DOM 顺序推断。

- [ ] **Step 3: 实现人物作息内容**

每个作息项包含 `{ id, name, spriteClass, mapId, x, y, copy, optional }`。春15日必须出现沈峤、林川和许姨；春16日小满在训练场；春17日林川在主赛场办公室外；春18日许姨在小店；春20日根据已选外队显示客队队长。与人物交谈只记录事件和关系变化，不阻塞自由移动。

- [ ] **Step 4: 改造场景 DOM 与渲染**

在 `index.html` 中把单一 `<img class="world-map">` 改为一张可换源的 `[data-world-map]`；新增 `[data-map-exits]`、`[data-scheduled-npcs]` 与地图名标签。`game.js` 的 `MAP_SIZE`、`worldObjects` 与 `blockedAreas` 改为读取 `getMap(activeMapId)`。切图时：

1. 保存当前地图位置。
2. 设置 `state.world.mapId`。
3. 读取目标地图保存位置或入口出生点。
4. 更新图片 `src`、`alt`、世界尺寸、目标与 NPC。
5. 重新调用 `fitWorld()`、`updateCamera()`、`updateProximity(true)` 并持久化。

- [ ] **Step 5: 补齐视觉与移动状态**

训练场继续显示序章收集点和小店；主赛场显示办公室、草场准备点、客队入口和比赛触发点。CSS 让地图标签、人物名字和出口提示沿用同一珊瑚红强调色、12px统一圆角、无外发光；移动、切图和对话只动画 `transform` 与 `opacity`，低动态模式立即切换。

- [ ] **Step 6: 运行纯测试并提交**

Run: `node --test prototypes/integrated-day/world-content.test.mjs`

Expected: 3 tests PASS。

```bash
git add prototypes/integrated-day/world-content.js prototypes/integrated-day/npc-schedules.js prototypes/integrated-day/world-content.test.mjs prototypes/integrated-day/index.html prototypes/integrated-day/game.js prototypes/integrated-day/styles.css
git commit -m "feat: add stadium travel and character schedules"
```

### Task 7: 接入七日决定、比赛界面与周结算

**Files:**
- Modify: `prototypes/integrated-day/index.html`
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/styles.css`
- Modify: `prototypes/integrated-day/game-state.js`

**Interfaces:**
- UI calls only `completeRequiredAction`, `resolveManagementShortfall`, `startWeeklyMatch`, `chooseMatchHighlight`, `finishManagementDay`, and `advanceCampaignDay`.
- One reusable `[data-decision-panel]` renders training, opponent, market, facility and welcome choices; `[data-match-panel]` renders three highlights; `[data-week-summary]` renders settlement.

- [ ] **Step 1: 加入管理周 HUD 与账本**

在顶部日期旁显示现金、球场状态、球队凝聚、社区支持和委员会支持。笔记面板在管理周改成七日周轨迹，已完成日期只显示勾选结果，不把五项指标做成进度条。春15日账本明确显示社区预约金、工资、维护和当前现金，沈峤在玩家确认账本后提出承担债务换取合并谈判。

- [ ] **Step 2: 加入通用决定面板**

决定内容固定为：

- 训练：前场压迫、整体站位、给年轻人机会。
- 外队：港口工人队、城市高校联队。
- 集市：海鲜夜市（24元，更多收入）或青少年体验课（12元，更多社区支持）。
- 设施：灯光、看台、草皮。
- 接待：正式商务接待（花费较高）或社区共同迎接（支持较高）。

每个选项只展示三项真实影响：成本、主要收益、风险。选择后关闭面板、在地图上显示对应变化、更新笔记和存档。按钮具备 hover、focus-visible、active 与 disabled 状态，桌面不换行，手机纵向单列。

- [ ] **Step 3: 接入周转面板**

现金低于0时显示三种选择：延迟支出、请求社区援助、接受沈峤过桥资金。面板说明具体代价；选择后现金回到0，关系、社区或沈峤影响立即变化。关闭按钮不可绕过这一状态，但刷新后能恢复到同一面板。

- [ ] **Step 4: 接入周六抵达与周日比赛**

周六在客队通道显示所选球队，完成一次接待对话后可结束当天。周日比赛面板依次呈现三段高光，每段只显示当前比分、场上事件和两个选择。选择触发短促位移动效和比分变化；低动态模式直接更新。三段完成后显示最终比分、胜平负以及林川、小满、郭教练对决定的反应。

- [ ] **Step 5: 结算第一周**

周结算收入使用：`观众基础收入 + 集市收益 + 比赛结果奖励 - 对手接待费 - 设施与活动支出`。摘要必须同时显示现金变化、球场状态、凝聚、社区支持和治理支持，并用一句沈峤的后续动作预告下一周。周结算落盘后设置 `management.weekComplete = true`，保留“继续在球场走走”和“从序章重新开始”，不伪造尚未制作的春22日。

- [ ] **Step 6: 文案与视觉预检**

检查所有可见文字没有破折号字符、AI式空话或不明指代；强调色全局只用珊瑚红；面板圆角统一12px；按钮对比度达到 WCAG AA；没有三列等宽网站卡片；桌面1440×900与手机390×844中，主目标、决定面板、比赛按钮和移动控制都在视口内。

- [ ] **Step 7: 运行全部纯测试并提交**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: 所有测试 PASS。

```bash
git add prototypes/integrated-day/index.html prototypes/integrated-day/game.js prototypes/integrated-day/styles.css prototypes/integrated-day/game-state.js
git commit -m "feat: integrate the first stadium management week"
```

### Task 8: 扩展真实浏览器流程并完成交付验证

**Files:**
- Modify: `prototypes/integrated-day/smoke-test.mjs`
- Modify: `prototypes/integrated-day/README.md`

**Interfaces:**
- Browser debug surface additionally exposes `getMapId()`, `chooseDecision(actionId, choiceId)`, `resolveShortfall(route)`, `chooseHighlight(choiceId)` and `finishMatch()` only for deterministic smoke-driving.

- [ ] **Step 1: 扩展浏览器冒烟测试**

测试必须从全新存档走完序章三天，然后：

1. 从章节总结进入春15日。
2. 在训练场和主赛场之间往返一次。
3. 与沈峤、林川、许姨和小满各完成一次对话。
4. 确认账本并选择整体站位训练。
5. 邀请港口工人队。
6. 选择青少年体验课和补平草皮。
7. 周六完成社区迎接。
8. 周日完成三次高光选择并看到2比1结果。
9. 验证周结算五项指标、`weekComplete` 与版本2存档。
10. 另开隔离存储注入一个版本1存档，验证迁移后旧钱、修缮与郭教练关系仍存在。

- [ ] **Step 2: 加入桌面和手机视觉断言**

浏览器测试检查：

- 两张地图自然尺寸有效，主赛场 src 为新资产。
- 沈峤图片完整加载，人物盒没有裁切。
- 1440×900与390×844无横向溢出。
- 地图出口、决策面板、比赛面板、周转面板和周总结均不离开视口。
- 移动控制不覆盖热栏，比赛按钮在手机上可点击。
- 页面无运行时异常或 console error。

- [ ] **Step 3: 更新 README**

README 改名为“海风球场：第一周”，说明两张地图、春12日至21日、七日经营、两支外队、沈峤登场、三段比赛高光、软失败和版本1存档迁移。保留直接打开 `index.html`、键盘/手机操作以及两条测试命令。

- [ ] **Step 4: 运行完整验证**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: 所有纯规则测试 PASS。

Run: `node prototypes/integrated-day/smoke-test.mjs`

Expected: 输出成功信息，且 `/private/tmp/` 中生成训练场、主赛场、沈峤、决策、比赛、周结算与手机截图。

- [ ] **Step 5: 检查截图和最终工作区**

使用本地图片查看器检查桌面主赛场、周日比赛和手机决策截图。确认层级、对比度、人物一致性、溢出、控件遮挡和地图贴图质量；如发现问题，修复后重跑两套测试。最后运行 `git status --short`，只提交本计划涉及的文件，不加入旧原型和未使用素材。

- [ ] **Step 6: 提交验证与说明**

```bash
git add prototypes/integrated-day/smoke-test.mjs prototypes/integrated-day/README.md
git commit -m "test: verify the first stadium management week"
```

## 完成定义

- 玩家可以从旧三日章节无缝进入春15日。
- 春15日至21日每一天都有一个清晰的主线任务，并能完整结算。
- 经营选择、人物冲突、外队准备、比赛结果和下一周代价形成闭环。
- 新主赛场与旧训练场都可行走，沈峤及三位核心人物可见、完整且画风一致。
- 两种外队、三种训练、两种集市、三种设施和三种周转方案都有可见差异。
- 比赛包含三次可选择的高光节点，输赢不阻断主线。
- 旧存档安全迁移，桌面与手机流程通过，控制台无错误。
