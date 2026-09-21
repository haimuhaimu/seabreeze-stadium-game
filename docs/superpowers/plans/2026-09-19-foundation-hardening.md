# Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已经做完的内容站得住：建设与人物投入在 0 至 15 级全程有感，本地存储不可用时仍可完整游玩，并补齐四个纯函数模块的测试盲区与逐帧重排。

**Architecture:** 比赛数值全部留在 `season-state.js` 与 `season-content.js`，建设节点解锁作为纯函数派生，不引入新状态字段。存档安全层封装在 `save-game.js` 内部，调用方签名不变。帧性能改动只涉及 `game.js` 的尺寸缓存与跳帧判断。

**Tech Stack:** Browser-native ES modules, HTML, CSS, Node test runner, existing Chrome DevTools smoke harness.

## Execution Order

实际执行顺序为 Task 1、Task 3、Task 2、Task 4、Task 5、Task 6。Task 3 先做是为了尽早获得画面反馈；它只依赖 Task 1 的 `getMatchOutlook`，与 Task 2 的建设里程碑无耦合。Task 2 完成后需回到 Task 3 的面板补充里程碑进度显示。

## Global Constraints

- 存档版本保持 5，不改变字段结构，版本 1 至 4 迁移链行为不变。- 不新增建设项目，不改动两周主线剧情、赛季事件文本与精英邀请赛结构。
- 不引入第三方依赖，不引入 `Math.random`，保持全项目可确定性回归。
- 不拆分 `game.js` 模块结构，不替换素材，不改动 `prototypes/day-loop/`。
- 不暂存或修改用户未跟踪的源图文件。
- 新增比赛时刻必须沿用 `callbackReady` 召回校验，不得成为无条件得分。

---

### Task 1: 连续让球映射与权重调整

**Files:**
- Modify: `prototypes/integrated-day/season-state.js`
- Modify: `prototypes/integrated-day/season-state.test.mjs`

**Interfaces:**
- Produces: `getMatchOutlook(snapshot, projects, opponentDifficulty)` 返回 `{ rating, gap, concededGoals }`。
- Changes: `teamRating` 权重改为 cohesion 0.26、facility 0.16、建设 0.85；`startSeasonMatch` 的开局让球改为 `clamp(floor(gap / 9), 0, 3)`。

- [x] **Step 1: Write failing rating and conceded-goal tests**

断言新权重下凝聚与设施的贡献值、连续映射在 gap 为 8、9、17、18、26、27 各档的让球数、上限截断为 3，以及起点属性对阵最强队让 2 球、中期属性对阵最强队不让球。

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test prototypes/integrated-day/season-state.test.mjs`

Expected: `getMatchOutlook` 未导出，权重与让球断言失败。

- [x] **Step 3: Implement the continuous mapping**

提取共享的评分与让球计算，供 `startSeasonMatch` 和新的展示接口同时使用，避免两处口径漂移。

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `node --test prototypes/integrated-day/season-state.test.mjs`

Expected: all pass.

- [x] **Step 5: Commit**

Commit: `feat: map team rating to conceded goals continuously`

### Task 2: 建设节点解锁

**Files:**
- Modify: `prototypes/integrated-day/season-content.js`
- Modify: `prototypes/integrated-day/season-content.test.mjs`
- Modify: `prototypes/integrated-day/season-state.js`
- Modify: `prototypes/integrated-day/season-state.test.mjs`

**Interfaces:**
- Produces: `CONSTRUCTION_MILESTONES`、`getConstructionUnlocks(projects)` 返回 `{ extraMoment, forgiveOpening, fullBuild }`。
- Adds: `MATCH_MOMENTS` 第四个时刻与满建设专属时刻，均带 `requiresLevels`。

- [x] **Step 1: Write failing milestone tests**

断言 6 级解锁第四时刻且进球上限升到 4、10 级后首个时刻未命中不再额外送球、15 级解锁专属时刻并写入赛季结算记录，以及 5 级、9 级、14 级各自不解锁。新时刻的每个选项都必须带 callback 字段。

- [x] **Step 2: Run focused tests and verify RED**

Run: `node --test prototypes/integrated-day/season-content.test.mjs prototypes/integrated-day/season-state.test.mjs`

Expected: 里程碑导出与新时刻缺失。

- [x] **Step 3: Implement milestone-gated moments**

按建设总级数派生可用时刻序列，`resolveSeasonMatchMoment` 的未命中惩罚受 10 级容错影响，满建设记录写入 `roundHistory`。不新增存档字段。

- [x] **Step 4: Run focused tests and verify GREEN**

Run the same focused command. Expected: all pass.

- [x] **Step 5: Commit**

Commit: `feat: unlock match moments from stadium construction`

### Task 3: 比赛准备面板显示局势

**Files:**
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/styles.css`
- Modify: `prototypes/integrated-day/smoke-test.mjs`

**Interfaces:**
- Renders: `[data-match-outlook]`，显示局势评估、开局让球与连续的实力差。

- [x] **Step 1: Add failing browser assertions**

载入混合建设等级的联赛存档，断言局势区块存在、建设 2 级与 15 级显示不同实力差、报告当前建设级数、390x844 无溢出、无控制台错误。

- [x] **Step 2: Run smoke test and verify RED**

Run: `node --experimental-websocket prototypes/integrated-day/smoke-test.mjs`

Expected: 局势选择器不存在。

- [x] **Step 3: Render the outlook block**

复用 `getMatchOutlook`，不在视图层重算数值。保持现有手绘风格与珊瑚色强调色。

实施修正：最初只显示开场让球，但让球只有 0 至 3 四档，在弱对手一侧建设 2 级与 15 级都显示“开场不落后”，投入依然无感。因此增加连续的实力差字段，由它承担每一级建设与每一点凝聚的即时反馈。

- [x] **Step 4: Run smoke test and inspect screenshots**

检查桌面与窄屏截图的文字对比、换行与遮挡。已确认 1440x900 与 390x844 均无溢出、无裁切，并逐档核对五种局势文案。

- [x] **Step 5: Commit**

Commit: `feat: show match outlook before kickoff`

### Task 4: 存档读写安全化

**Files:**
- Modify: `prototypes/integrated-day/save-game.js`
- Modify: `prototypes/integrated-day/save-game.test.mjs`
- Modify: `prototypes/integrated-day/game.js`
- Modify: `prototypes/integrated-day/smoke-test.mjs`

**Interfaces:**
- Changes: `writeSave` 返回 `{ ok, record, reason }`，不再抛出存储异常；`loadSave` 在读取异常时返回 `{ ok: false, reason: 'storage-unavailable' }`。

- [x] **Step 1: Write failing storage-failure tests**

用会抛 SecurityError 的 `getItem` 和抛 QuotaExceededError 的 `setItem` 断言两者都不向上抛出、返回正确 reason，且非法存档记录仍然抛 TypeError（该校验属于编程错误，行为不变）。

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test prototypes/integrated-day/save-game.test.mjs`

Expected: 异常直接冒泡，测试失败。

- [x] **Step 3: Implement the safe storage layer**

在 `save-game.js` 内包裹读写，`game.js` 的 `persist()` 在首次写入失败时提示一次并切换为内存存档，后续不重复提示。

- [x] **Step 4: Run focused test and smoke test**

Run: `node --test prototypes/integrated-day/save-game.test.mjs` 与 `node --experimental-websocket prototypes/integrated-day/smoke-test.mjs`

Expected: 单测通过；浏览器验收在禁用存储的上下文里可走到赛季结算并显示提示。

- [x] **Step 5: Commit**

Commit: `fix: keep playing when local storage is unavailable`

### Task 5: 纯函数模块测试与帧性能

**Files:**
- Create: `prototypes/integrated-day/economy-state.test.mjs`
- Create: `prototypes/integrated-day/roster-state.test.mjs`
- Create: `prototypes/integrated-day/facility-state.test.mjs`
- Create: `prototypes/integrated-day/governance-state.test.mjs`
- Modify: `prototypes/integrated-day/game.js`

**Interfaces:**
- No production interface change; 仅补测与内部缓存。

- [x] **Step 1: Write the four module test suites**

覆盖正常值、边界截断与非法输入：账目去重与欠款三条路线、训练重心不可重复选择与属性累加、设施状况上限截断、治理支持与沈峤影响的 0 至 5 截断。

- [x] **Step 2: Run the new tests and verify they pass or expose real bugs**

Run: `node --test prototypes/integrated-day/economy-state.test.mjs prototypes/integrated-day/roster-state.test.mjs prototypes/integrated-day/facility-state.test.mjs prototypes/integrated-day/governance-state.test.mjs`

Expected: 全部通过；若暴露真实缺陷，先修实现再继续。

- [x] **Step 3: Cache layout metrics and skip idle frames**

缓存地图与视口尺寸，只在 resize、地图切换和 `fitWorld` 时失效；角色静止且无训练动画时跳过视觉更新。保持 reduced-motion 行为不变。

- [x] **Step 4: Verify movement, camera, and click-to-walk still work**

Run: `node --experimental-websocket prototypes/integrated-day/smoke-test.mjs`

Expected: 两地往返、点击寻路、跨看台通道与移动端按钮全部通过。

- [x] **Step 5: Commit**

Commit: `test: cover base state modules and idle frames`

### Task 6: 最终验证与文档

**Files:**
- Modify: `README.md`
- Modify: `prototypes/integrated-day/README.md`

- [x] **Step 1: Update the playable feature description**

说明建设三个节点的解锁内容、赛前局势显示，以及本地存储不可用时的降级行为。

- [x] **Step 2: Run the full pure suite**

Run: `node --test prototypes/integrated-day/*.test.mjs`

Expected: 全部通过，零失败。

- [x] **Step 3: Run the full browser smoke suite**

Run: `node --experimental-websocket prototypes/integrated-day/smoke-test.mjs`

Expected: 剧情、联赛、建设、精英赛、布局与控制台检查全部通过。

- [x] **Step 4: Check repository boundaries**

Run: `git diff --check` 与 `git status --short`

Expected: 无空白错误；只剩已知的用户未跟踪文件。

- [x] **Step 5: Commit**

Commit: `docs: explain the hardened foundation`
