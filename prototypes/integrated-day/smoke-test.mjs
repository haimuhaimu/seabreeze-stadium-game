import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { getOrders } from './daily-content.js';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const target = resolve(import.meta.dirname, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(import.meta.dirname)) throw new Error('Path leaves prototype');
    const data = await readFile(target);
    response.writeHead(200, { 'content-type': mimeTypes[extname(target)] ?? 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(0, '127.0.0.1', resolveListen);
});
const serverAddress = server.address();
const pageBaseUrl = `http://127.0.0.1:${serverAddress.port}/index.html`;
const pageUrl = `${pageBaseUrl}?smoke=1`;
const profileDir = await mkdtemp(join(tmpdir(), 'integrated-day-smoke-'));
const debugPort = 9238;
let navigationCount = 0;

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--allow-file-access-from-files',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  pageUrl
], { stdio: ['ignore', 'ignore', 'pipe'] });

let chromeError = '';
chrome.stderr.on('data', chunk => { chromeError += chunk.toString(); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDebugger() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const pages = await response.json();
      const page = pages.find(item => item.type === 'page' && item.url.startsWith(pageBaseUrl));
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Chrome DevTools did not start. ${chromeError}`);
}

const socket = new WebSocket(await waitForDebugger());
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let messageId = 0;
const pending = new Map();
const pageErrors = [];

socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push(message.params.exceptionDetails.text);
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    pageErrors.push(message.params.entry.text);
  }
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
}

async function waitFor(expression, message, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(80);
  }
  throw new Error(message);
}

async function navigate() {
  navigationCount += 1;
  await send('Page.reload', { ignoreCache: true });
  await sleep(800);
  try {
    await waitFor(
      'Boolean(window.__integratedDayDebug)',
      `Game module did not initialize. Browser errors: ${pageErrors.join(' | ')}`,
      12000
    );
  } catch (error) {
    const diagnostic = await evaluate(`(async () => {
      let moduleResult = 'not-run';
      try {
        await import('./game.js?diagnostic=' + Date.now());
        moduleResult = 'manual-import-ok';
      } catch (moduleError) {
        moduleResult = moduleError.stack || moduleError.message;
      }
      return {
        href: location.href,
        readyState: document.readyState,
        title: document.title,
        scripts: [...document.scripts].map(script => ({ src: script.src, type: script.type })),
        debugReady: Boolean(window.__integratedDayDebug),
        moduleResult,
        resources: performance.getEntriesByType('resource').map(entry => entry.name)
      };
    })()`);
    throw new Error(`${error.message} Diagnostic: ${JSON.stringify(diagnostic)}`);
  }
  await evaluate(`Promise.race([
    Promise.all([...document.images].map(image => image.complete
      ? true
      : new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        }))),
    new Promise(resolve => setTimeout(resolve, 2500))
  ])`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function click(selector) {
  const clicked = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  assert(clicked, `Missing clickable element: ${selector}`);
  await sleep(40);
}

async function text(selector) {
  return evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim()`);
}

async function capture(name) {
  await sleep(350);
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`/private/tmp/integrated-day-${name}.png`, Buffer.from(shot.data, 'base64'));
}

async function walkAndWait(id, condition) {
  await click(`[data-object="${id}"]`);
  await waitFor(condition, `Player did not finish interaction with ${id}`);
}

async function gatherAndOpen(dayIndex) {
  for (const id of ['tea-a', 'tea-b', 'fruit-a', 'fruit-b']) {
    await walkAndWait(
      id,
      `window.__integratedDayDebug.getState().collectedToday.includes(${JSON.stringify(id)})`
    );
  }
  await walkAndWait(
    'shop',
    'window.__integratedDayDebug.getState().phase === "shop"'
  );
  assert((await evaluate('window.__integratedDayDebug.getState().dayIndex')) === dayIndex, 'Wrong day opened the shop');
}

async function serveDay(dayIndex) {
  for (const order of getOrders(dayIndex)) {
    await click(`[data-recipe="${order.recipe}"]`);
  }
  assert(await evaluate('window.__integratedDayDebug.getState().phase === "evening"'), `Day ${dayIndex} did not reach evening`);
}

async function assertInsideViewport(selector) {
  const result = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || element.hidden) return { visible: false };
    const rect = element.getBoundingClientRect();
    return {
      visible: true,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: innerWidth,
      height: innerHeight
    };
  })()`);
  assert(result.visible, `${selector} is not visible`);
  assert(result.left >= -1 && result.top >= -1 && result.right <= result.width + 1 && result.bottom <= result.height + 1, `${selector} leaves the viewport`);
}

async function loadQualifiedEliteFixture() {
  const prepared = await evaluate(`(async () => {
    const { writeSave } = await import('./save-game.js');
    const { offerEliteInvitation } = await import('./elite-state.js');
    const game = window.__integratedDayDebug.getState();
    game.dayIndex = 23;
    game.phase = 'complete';
    game.minute = 1100;
    game.world.mapId = 'stadium';
    game.season.active = true;
    game.season.seasonNumber = 1;
    game.season.roundIndex = 6;
    game.season.projects = { stands: 3, clinic: 3, academy: 0, market: 0, lights: 0 };
    game.season.week = {
      actions: ['train-attack', 'community-open', 'train-defense'],
      talkedNpcIds: [],
      npcResponses: {},
      helpTags: ['community'],
      memoryNpcIds: [],
      eventId: null,
      eventChoiceId: null,
      eventTag: null,
      roundComplete: true,
      result: { opponentId: 'harbor-workers', homeGoals: 2, awayGoals: 1, points: 3 }
    };
    game.season.match = null;
    game.season.seasonComplete = true;
    game.season.eliteQualified = true;
    game.season.goals = {
      ranking: { complete: true, current: 2, target: 4 },
      construction: { complete: true, current: 6, target: 6 },
      people: { complete: false, current: 2, target: 3 },
      finance: { complete: false, current: game.economy.cash, target: 180 },
      eliteQualified: true
    };
    game.season.elite = offerEliteInvitation(game.season.elite, 1);
    writeSave(localStorage, game, { x: 52, y: 68 }, 'stadium');
    return { cash: game.economy.cash, cohesion: game.roster.cohesion, community: game.communitySupport };
  })()`);
  await navigate();
  await click('[data-continue]');
  await waitFor('!document.querySelector("[data-season-summary]").hidden', 'The qualified season summary did not restore');
  return prepared;
}

async function completeEpisodeDay(dayIndex) {
  assert(await evaluate(`window.__integratedDayDebug.getState().dayIndex === ${dayIndex}`), `Episode day ${dayIndex} did not begin`);
  await waitFor('!document.querySelector("[data-end-management-day]").hidden', 'Management day cannot be closed');
  await click('[data-end-management-day]');
  await waitFor('window.__integratedDayDebug.getState().phase === "complete"', `Episode day ${dayIndex} did not finish`);
  await assertInsideViewport('[data-summary]');
  await click('[data-next-day]');
  await waitFor(`window.__integratedDayDebug.getState().dayIndex === ${dayIndex + 1}`, `Episode day ${dayIndex + 1} did not begin`);
}

async function completeNamingFreeAction(objectId) {
  await walkAndWait(objectId, '!document.querySelector("[data-episode-activity]").hidden');
  for (let step = 0; step < 3; step += 1) {
    await click('[data-free-quality="1"]');
  }
  await click('[data-free-finish]');
  await waitFor('window.__integratedDayDebug.getState().phase === "complete"', 'Naming free action did not finish the day');
}

async function advanceNamingDay(dayIndex) {
  await assertInsideViewport('[data-summary]');
  await click('[data-next-day]');
  await waitFor(`window.__integratedDayDebug.getState().dayIndex === ${dayIndex + 1}`, `Naming day ${dayIndex + 1} did not begin`);
}

async function testThreeDayLoop() {
  await navigate();
  const launch = await evaluate(`({
    visible: !document.querySelector('[data-start-card]').hidden,
    title: document.querySelector('[data-start-card] h1').textContent.trim(),
    directLabel: document.querySelector('[data-direct-week]').textContent.trim(),
    previewLoaded: document.querySelector('.start-preview').complete
      && document.querySelector('.start-preview').naturalWidth === 1672,
    continueHidden: document.querySelector('[data-continue]').hidden
  })`);
  assert(launch.visible, 'A fresh profile does not show the new launch screen');
  assert(launch.title.includes('不会轻易倒下'), 'The launch screen does not introduce the complete stadium goal');
  assert(launch.directLabel === '直接进入春 15 日', 'The direct story-week entry is missing');
  assert(launch.previewLoaded, 'The main stadium preview did not load');
  assert(launch.continueHidden, 'A fresh profile should not offer an absent save');
  await assertInsideViewport('[data-start-card]');
  await capture('launch');

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  assert(!await evaluate('document.documentElement.scrollWidth > innerWidth'), 'Launch screen overflows on mobile');
  await assertInsideViewport('[data-start-card]');
  await capture('launch-mobile');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(250);

  await click('[data-direct-week]');
  await waitFor('window.__integratedDayDebug.getState().dayIndex === 3', 'Direct entry did not open the management week');
  const directWeek = await evaluate(`({
    map: window.__integratedDayDebug.getMapId(),
    cash: window.__integratedDayDebug.getState().economy.cash,
    history: window.__integratedDayDebug.getState().history.length,
    startHidden: document.querySelector('[data-start-card]').hidden
  })`);
  assert(directWeek.map === 'stadium' && directWeek.cash === 107, 'Direct entry did not create the intended stadium state');
  assert(directWeek.history === 3 && directWeek.startHidden, 'Direct entry did not preserve the prologue summary');
  await evaluate('window.__integratedDayDebug.clearProjectSave()');
  await navigate();
  await click('[data-new-game]');

  const desktop = await evaluate(`({
    phase: document.querySelector('.game').dataset.phase,
    date: document.querySelector('[data-date]').textContent.trim(),
    overflow: document.documentElement.scrollWidth > innerWidth,
    mapLoaded: document.querySelector('.world-map').naturalWidth === 1672
      && document.querySelector('.world-map').src.includes('seaside-club-handpainted-v4.png'),
    playerAtlas: getComputedStyle(document.querySelector('.player-sprite')).backgroundImage.includes('an-ruotong-unified-v4-aligned.png'),
    teamAtlas: getComputedStyle(document.querySelector('.npc-guo')).backgroundImage.includes('team-roster-handpainted-v2-aligned.png'),
    startHidden: document.querySelector('[data-start-card]').hidden
  })`);
  assert(desktop.phase === 'morning' && desktop.date === '春 12', 'The chapter does not begin on spring 12');
  assert(!desktop.overflow, 'Desktop layout overflows horizontally');
  assert(desktop.mapLoaded, 'The seaside map did not load');
  assert(desktop.playerAtlas, 'The unified An Ruotong atlas is not connected');
  assert(desktop.teamAtlas, 'The complete team atlas is not connected');
  assert(desktop.startHidden, 'Starting the prologue did not close the launch screen');

  const beforeWalk = await evaluate('window.__integratedDayDebug.getPosition()');
  await click('[data-object="coach"]');
  await sleep(250);
  const afterWalk = await evaluate('window.__integratedDayDebug.getPosition()');
  assert(Math.hypot(afterWalk.x - beforeWalk.x, afterWalk.y - beforeWalk.y) > 0.1, 'Click-to-walk did not move the player');
  await waitFor('window.__integratedDayDebug.getState().relationship.coachMet', 'Day 12 coach meeting did not complete');

  await gatherAndOpen(0);
  await capture('morning');
  await serveDay(0);
  await capture('shop');
  await click('[data-repair="awning"]');
  assert(await evaluate('!document.querySelector("[data-repair-visual=awning]").hidden'), 'Awning repair is not visible on the field');
  await click('[data-finish-day]');
  await assertInsideViewport('[data-summary]');
  await capture('summary');
  await click('[data-next-day]');
  assert(await evaluate('window.__integratedDayDebug.getState().dayIndex === 1'), 'Spring 13 did not begin');

  await navigate();
  assert(!await evaluate('document.querySelector("[data-start-card]").hidden'), 'Reload did not offer the saved game');
  assert((await text('[data-save-summary]')).includes('春 13 日'), 'Continue card has the wrong saved date');
  await assertInsideViewport('[data-start-card]');
  await click('[data-direct-week]');
  assert((await text('[data-direct-week]')).includes('确认进入'), 'Existing saves do not require confirmation before direct entry');
  assert(await evaluate('window.__integratedDayDebug.getState().dayIndex === 1'), 'Direct-entry confirmation changed the existing save too early');
  await click('[data-continue]');
  const restored = await evaluate('window.__integratedDayDebug.getState()');
  assert(restored.dayIndex === 1 && restored.money === 20, 'Spring 13 money did not restore');
  assert(restored.repairs.includes('awning'), 'Awning repair did not restore');
  assert(restored.relationship.coachMet, 'Coach relationship did not restore');
  assert(await evaluate('window.__integratedDayDebug.hasSave()'), 'Project save is missing after reload');

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  const mobile = await evaluate(`({
    overflow: document.documentElement.scrollWidth > innerWidth,
    controls: getComputedStyle(document.querySelector('.touch-controls')).display,
    action: getComputedStyle(document.querySelector('.touch-action')).display,
    controlsRect: document.querySelector('.touch-controls').getBoundingClientRect().toJSON(),
    hotbarRect: document.querySelector('.hotbar').getBoundingClientRect().toJSON()
  })`);
  assert(!mobile.overflow, 'Mobile layout overflows horizontally');
  assert(mobile.controls !== 'none' && mobile.action !== 'none', 'Mobile movement and action controls are not reachable');
  assert(mobile.controlsRect.bottom <= mobile.hotbarRect.top + 1, 'Mobile controls overlap the hotbar');

  await walkAndWait('coach', '!document.querySelector("[data-training]").hidden');
  await assertInsideViewport('[data-training]');
  await assertInsideViewport('[data-shoot]');
  await capture('training');
  await evaluate('window.__integratedDayDebug.shootAt(.28)');
  await evaluate('window.__integratedDayDebug.shootAt(.72)');
  await evaluate('window.__integratedDayDebug.shootAt(.5)');
  const training = await evaluate('window.__integratedDayDebug.getState()');
  assert(training.training.lastScore === 6, 'Three centered shots did not score 6');
  assert(training.relationship.coachTrust === 1, 'Training did not increase coach trust');

  await capture('mobile');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(250);

  await gatherAndOpen(1);
  await serveDay(1);
  await click('[data-save-money]');
  await click('[data-finish-day]');
  await click('[data-next-day]');
  assert(await text('[data-date]') === '春 14', 'Spring 14 did not begin');
  assert(await evaluate('!document.querySelector("[data-repair-visual=awning]").hidden'), 'Repair disappeared on spring 14');

  await gatherAndOpen(2);
  await serveDay(2);
  await click('[data-repair="net"]');
  await click('[data-finish-day]');
  await click('[data-next-day]');
  const ending = await evaluate('window.__integratedDayDebug.getState()');
  assert(ending.chapterComplete, 'Spring 14 did not complete the chapter');
  assert(ending.history.length === 3, 'The chapter does not contain three history entries');
  assert(ending.repairs.includes('awning') && ending.repairs.includes('net'), 'Persistent repairs are incomplete');
  await assertInsideViewport('[data-chapter-summary]');
  await capture('chapter');

  await click('[data-begin-week]');
  await waitFor('window.__integratedDayDebug.getState().dayIndex === 3', 'The first management week did not begin');
  await waitFor(
    'document.querySelector(".world-map").complete && document.querySelector(".world-map").naturalWidth === 1672',
    'The main stadium art did not finish loading'
  );
  const weekStart = await evaluate(`({
    date: document.querySelector('[data-date]').textContent.trim(),
    mapId: window.__integratedDayDebug.getMapId(),
    mapLoaded: document.querySelector('.world-map').naturalWidth === 1672
      && document.querySelector('.world-map').src.includes('seabreeze-main-stadium-v1.png'),
    shenVisible: Boolean(document.querySelector('[data-object="npc-shen-qiao"]')),
    careVisible: !document.querySelector('[data-weekly-care]').hidden,
    metricsHidden: document.querySelector('[data-management-metrics]').hidden,
    weekDays: document.querySelectorAll('[data-week-day]').length
  })`);
  assert(weekStart.date === '春 15' && weekStart.mapId === 'stadium', 'Management week did not open at the stadium on spring 15');
  assert(weekStart.mapLoaded, 'The main stadium art did not load');
  assert(weekStart.shenVisible, 'Shen Qiao is missing from the first stadium morning');
  assert(weekStart.careVisible && weekStart.metricsHidden && weekStart.weekDays === 7, 'The weekly story HUD is incomplete');
  await capture('stadium');

  await walkAndWait(
    'npc-shen-qiao',
    'window.__integratedDayDebug.getState().events.includes("talk-shen-qiao-day-3")'
  );
  assert((await text('[data-speech-copy]')).includes('接下债务'), 'Shen Qiao does not introduce the debt proposal');

  await walkAndWait('to-training', 'window.__integratedDayDebug.getMapId() === "training"');
  await walkAndWait('to-stadium', 'window.__integratedDayDebug.getMapId() === "stadium"');

  await walkAndWait('stadium-office', '!document.querySelector("[data-story-scene]").hidden');
  assert((await text('[data-story-speaker]')) === '郭教练', 'The blank notice scene has the wrong speaker');
  assert((await text('[data-story-prop-caption]')).includes('名字'), 'The blank notice prop is missing');
  await assertInsideViewport('[data-story-scene]');
  await capture('blank-notice');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  assert(!await evaluate('document.documentElement.scrollWidth > innerWidth'), 'Story week overflows on mobile');
  await assertInsideViewport('[data-story-scene]');
  await assertInsideViewport('[data-weekly-care]');
  await capture('story-mobile');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(250);
  await click('[data-story-action="acknowledge-notice"]');
  await completeEpisodeDay(3);

  await walkAndWait('coach', '!document.querySelector("[data-story-scene]").hidden');
  await click('[data-promise-pick="train"]');
  await click('[data-promise-pick="fundraise"]');
  assert(await evaluate('document.querySelectorAll("[data-promise-pick][aria-pressed=true]").length === 2'), 'Two promises were not visibly selected');
  await click('[data-story-action="confirm-promises"]');
  await waitFor('window.__integratedDayDebug.getState().episode.promisesChosen.length === 2', 'The two promises were not recorded');
  await completeEpisodeDay(4);

  await walkAndWait('coach', '!document.querySelector("[data-episode-activity]").hidden');
  assert((await text('[data-activity-title]')).includes('传三次球'), 'The training promise opened the wrong activity');
  await click('[data-pass-value="0.22"]');
  await click('[data-pass-value="0.78"]');
  await click('[data-pass-value="0.50"]');
  await click('[data-activity-finish]');
  await waitFor('window.__integratedDayDebug.getState().episode.promisesCompleted.includes("train")', 'The training promise did not complete');
  await completeEpisodeDay(5);

  await walkAndWait('shop', '!document.querySelector("[data-episode-activity]").hidden');
  assert((await text('[data-activity-title]')).includes('场边小店'), 'The fundraiser opened the wrong activity');
  await click('[data-fundraiser-item="fruit"]');
  await click('[data-fundraiser-item="tea"]');
  await click('[data-fundraiser-item="towel"]');
  await click('[data-fundraising-mode="public"]');
  await waitFor('window.__integratedDayDebug.getState().episode.fundraisingTotal === 48', 'Public fundraising did not reach 48');
  await completeEpisodeDay(6);

  await walkAndWait('pitch-prep', '!document.querySelector("[data-story-scene]").hidden');
  assert(await evaluate('!document.querySelector("[data-story-action=\\"funding:pay-both\\"]").disabled'), 'Fundraising did not unlock paying both bills');
  await capture('friday-funding');
  await click('[data-story-action="funding:pay-both"]');
  await waitFor('window.__integratedDayDebug.getState().episode.missedRequest === "records"', 'The unchosen records request was not remembered');
  await completeEpisodeDay(7);

  await walkAndWait('stadium-office', '!document.querySelector("[data-story-scene]").hidden');
  assert((await text('[data-story-speaker]')) === '沈峤', 'The Saturday reversal has the wrong speaker');
  assert((await text('[data-story-prop-caption]')).includes('旧球员证'), 'Shen Qiao old player card is missing');
  await capture('shen-offer');
  await click('[data-story-action="acknowledge-offer"]');
  await waitFor('window.__integratedDayDebug.getState().episode.shenOffer === "considering"', 'Shen Qiao offer was not recorded');
  await completeEpisodeDay(8);

  assert(await evaluate('window.__integratedDayDebug.getState().dayIndex === 9'), 'Match day did not begin');
  await walkAndWait('match-center', '!document.querySelector("[data-story-scene]").hidden');
  await click('[data-story-action="start-match"]');
  await waitFor('!document.querySelector("[data-match-panel]").hidden', 'The Sunday match did not start');
  await assertInsideViewport('[data-match-panel]');
  await capture('match');
  for (const choiceId of ['repeat-practice', 'ask-xiaoman', 'share-responsibility']) {
    await click(`[data-highlight-choice="${choiceId}"]`);
  }
  await waitFor('Boolean(window.__integratedDayDebug.getState().management.matchResult)', 'The match did not finish after three highlights');
  const matchResult = await evaluate('window.__integratedDayDebug.getState().management.matchResult');
  assert(matchResult.score.home === 2 && matchResult.score.away === 1, 'The canonical episode path did not produce a 2:1 match');
  await waitFor('!document.querySelector("[data-hearing]").hidden', 'The five-chair hearing did not open');
  assert(await evaluate('window.__integratedDayDebug.getState().episode.xiaomanDecision === "stay-trial"'), 'Xiaoman did not make his own stay decision');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  assert(!await evaluate('document.documentElement.scrollWidth > innerWidth'), 'The hearing overflows on mobile');
  await assertInsideViewport('[data-hearing]');
  await capture('hearing-mobile');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(250);
  await click('[data-story-action="hearing:five-party-week"]');
  await waitFor('Boolean(window.__integratedDayDebug.getState().management.weekComplete)', 'The first story week did not settle');
  await assertInsideViewport('[data-week-summary]');
  assert((await text('[data-week-score]')).includes('2 : 1'), 'Weekly settlement has the wrong score');
  assert((await text('[data-week-xiaoman]')).includes('再留一周'), 'Character consequence is missing from the weekly summary');
  assert((await text('[data-week-next-crisis]')).includes('五方会议'), 'The next crisis is missing from the weekly summary');
  await capture('week');

  await navigate();
  assert(!await evaluate('document.querySelector("[data-start-card]").hidden'), 'Reload did not offer the completed management week');
  assert((await text('[data-save-summary]')).includes('春 21 日'), 'Completed week save has the wrong date');
  await click('[data-continue]');
  await assertInsideViewport('[data-week-summary]');

  assert(!await evaluate('document.querySelector("[data-begin-naming-week]").hidden'), 'The second week entry is missing from the first-week settlement');
  await click('[data-begin-naming-week]');
  await waitFor('window.__integratedDayDebug.getState().dayIndex === 10', 'The naming-rights week did not begin');
  assert(await evaluate('!document.querySelector("[data-stadium-sign]").hidden'), 'The covered stadium sign is missing');
  assert((await text('[data-care-title]')).includes('蓝布'), 'The naming-rights HUD does not introduce the covered sign');

  await walkAndWait('guest-gate', '!document.querySelector("[data-story-scene]").hidden');
  assert((await text('[data-story-prop-caption]')).includes('蓝布'), 'The naming proposal is missing its physical prop');
  assert(await evaluate('getComputedStyle(document.querySelector("[data-story-prop] > div")).backgroundImage.includes("naming-rights-memory-strip-v1.png")'), 'The naming-rights memory strip is not connected');
  await capture('naming-proposal');
  await click('[data-story-action="hold-public-vote"]');
  await advanceNamingDay(10);

  await walkAndWait('stadium-office', '!document.querySelector("[data-story-scene]").hidden');
  await click('[data-story-action="write-conditions"]');
  assert(await evaluate('Boolean(document.querySelector("[data-object=free-shop]"))'), 'Free-time choices did not appear after the five conditions');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  assert(!await evaluate('document.documentElement.scrollWidth > innerWidth'), 'The naming-rights world overflows on mobile');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await completeNamingFreeAction('free-shop');
  await advanceNamingDay(11);

  await walkAndWait('pitch-prep', '!document.querySelector("[data-story-scene]").hidden');
  await click('[data-story-action="open-free-time"]');
  await completeNamingFreeAction('free-community');
  await advanceNamingDay(12);

  await walkAndWait('stadium-office', '!document.querySelector("[data-story-scene]").hidden');
  assert((await text('[data-story-prop-caption]')).includes('刮掉'), 'The scratched founder plaque is missing');
  await click('[data-story-action="acknowledge-history"]');
  assert(await evaluate('Boolean(document.querySelector("[data-object=free-archive]"))'), 'The archive did not unlock after the founder plaque');
  await completeNamingFreeAction('free-shop');
  await advanceNamingDay(13);

  await walkAndWait('match-center', '!document.querySelector("[data-story-scene]").hidden');
  assert(!await evaluate('[...document.querySelectorAll("[data-story-action]")].find(element => element.dataset.storyAction === "naming-vote:community-save").disabled'), 'Community self-rescue did not unlock');
  await click('[data-story-action="naming-vote:community-save"]');
  await advanceNamingDay(14);

  await walkAndWait('stadium-office', '!document.querySelector("[data-story-scene]").hidden');
  await click('[data-story-action="naming-response:restore-history"]');
  await completeNamingFreeAction('free-archive');
  await advanceNamingDay(15);

  await walkAndWait('match-center', '!document.querySelector("[data-story-scene]").hidden');
  await click('[data-story-action="start-naming-match"]');
  assert((await text('[data-match-home]')) === '海风球场', 'The second match does not use the voted stadium name');
  for (const choiceId of ['keep-gates-open', 'steady-everyone', 'let-name-show']) {
    await click(`[data-highlight-choice="${choiceId}"]`);
  }
  await waitFor('window.__integratedDayDebug.getState().namingRights.weekComplete', 'The naming-rights week did not settle');
  await assertInsideViewport('[data-week-summary]');
  assert((await text('[data-final-stadium-name]')) === '海风球场', 'The final sign has the wrong stadium name');
  assert((await text('[data-final-authority]')).includes('五把椅子'), 'The final sign does not preserve the voted authority');
  assert((await text('[data-week-next-crisis]')).includes('强队邀请费'), 'The continuation hook is missing');
  await capture('naming-final');

  await click('[data-begin-season]');
  await waitFor('window.__integratedDayDebug.getState().season.active && window.__integratedDayDebug.getState().dayIndex === 17', 'The Haifeng league did not begin');
  assert(!await evaluate('document.querySelector("[data-season-docket]").hidden'), 'The persistent league docket is missing');
  assert((await text('[data-season-actions]')) === '行动 0 / 3', 'The first league round does not start with three open actions');

  await walkAndWait('npc-lin-chuan', '!document.querySelector("[data-season-conversation]").hidden');
  assert((await text('[data-season-npc-name]')) === '林川', 'The recurring NPC conversation opened the wrong person');
  await click('[data-season-response="solve"]');
  assert(await evaluate('window.__integratedDayDebug.getState().season.relationships["lin-chuan"] === 1'), 'The NPC response did not create a persistent bond');
  await click('[data-season-conversation-close]');

  await click('[data-season-board-open]');
  await assertInsideViewport('[data-season-board]');
  assert(await evaluate('document.querySelectorAll(".season-standing-row").length === 8'), 'The league board does not show all eight teams');
  assert(await evaluate('document.querySelectorAll(".season-projects > div").length === 5'), 'The construction board does not show all five projects');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  assert(!await evaluate('document.documentElement.scrollWidth > innerWidth'), 'The league board overflows on mobile');
  await assertInsideViewport('[data-season-board]');
  await capture('league-board-mobile');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await click('[data-season-board-close]');

  await walkAndWait('season-action-attack', '!document.querySelector("[data-decision-panel]").hidden');
  await click('[data-decision-choice="train-attack"]');
  await walkAndWait('season-action-community', '!document.querySelector("[data-decision-panel]").hidden');
  await click('[data-decision-choice="community-open"]');
  await walkAndWait('season-project-stands', '!document.querySelector("[data-decision-panel]").hidden');
  await click('[data-decision-choice="stands"]');
  assert(await evaluate('window.__integratedDayDebug.getState().season.projects.stands === 1'), 'The first permanent stand upgrade was not built');
  assert((await text('[data-season-actions]')) === '行动 3 / 3', 'The weekly action counter did not fill');

  assert(!await evaluate('Boolean(document.querySelector("[data-object=season-match-center]"))'), 'The match opened before the round incident was answered');
  await walkAndWait('to-training', 'window.__integratedDayDebug.getMapId() === "training"');
  await walkAndWait('season-event-shared-pitch', '!document.querySelector("[data-season-event]").hidden');
  assert((await text('[data-season-event-title]')) === '谁先用半块场地', 'The first authored incident did not open');
  assert(await evaluate('document.querySelectorAll("[data-season-event-choice]").length === 3'), 'The incident does not offer three distinct decisions');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  assert(!await evaluate('document.documentElement.scrollWidth > innerWidth'), 'The league incident overflows on mobile');
  await assertInsideViewport('[data-season-event]');
  await capture('league-incident-mobile');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await click('[data-season-event-choice="share-half"]');
  assert(await evaluate('window.__integratedDayDebug.getState().season.week.eventChoiceId === "share-half"'), 'The incident decision was not saved');
  assert(await evaluate('window.__integratedDayDebug.getState().season.week.actions.length === 3'), 'The incident incorrectly spent a weekly action');
  assert((await text('[data-season-incident-status]')).includes('已回应'), 'The league docket did not remember the incident');
  assert(!await evaluate('document.querySelector("[data-season-event-result]").hidden'), 'The incident consequence was not shown');
  await click('[data-season-event-close]');

  await walkAndWait('npc-xiaoman', '!document.querySelector("[data-season-conversation]").hidden');
  assert((await text('[data-season-npc-copy]')).includes('那道白线'), 'Xiaoman did not react to the shared-pitch decision');
  assert((await text('[data-season-memory-source]')).includes('回应刚刚的决定'), 'The incident reaction has no current-decision source');
  assert((await text('[data-season-memory-choice]')) === '把半块场地画出来', 'The NPC remembered the wrong incident choice');
  assert(!await evaluate('document.querySelector("[data-season-memory]").hidden'), 'The incident follow-up action is missing');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  assert(!await evaluate('document.documentElement.scrollWidth > innerWidth'), 'The NPC memory conversation overflows on mobile');
  await assertInsideViewport('[data-season-conversation]');
  await capture('league-npc-memory-mobile');
  await click('[data-season-memory-talk]');
  assert(await evaluate('window.__integratedDayDebug.getState().season.relationships.xiaoman === 2'), 'The incident follow-up did not strengthen Xiaoman bond');
  assert(await evaluate('window.__integratedDayDebug.getState().season.week.actions.length === 3'), 'The incident follow-up incorrectly spent a weekly action');
  assert(await evaluate('window.__integratedDayDebug.getState().season.week.memoryNpcIds.includes("xiaoman")'), 'The incident follow-up was not saved');
  assert((await text('[data-season-memory-talk]')) === '本轮已谈清楚', 'The incident follow-up did not enter its completed state');
  await click('[data-season-conversation-close]');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await click('[data-season-board-open]');
  assert(await evaluate('document.querySelectorAll(".season-history > div").length === 1'), 'The season handbook did not record the incident');
  await click('[data-season-board-close]');
  await walkAndWait('to-stadium', 'window.__integratedDayDebug.getMapId() === "stadium"');

  await walkAndWait('season-match-center', '!document.querySelector("[data-match-panel]").hidden');
  await click('[data-highlight-choice="use-attack-work"]');
  const secondMoment = await evaluate(`({
    choices: [...document.querySelectorAll('[data-highlight-choice]')].map(button => button.dataset.highlightChoice),
    match: window.__integratedDayDebug.getState().season.match,
    panelHidden: document.querySelector('[data-match-panel]').hidden
  })`);
  assert(secondMoment.choices.includes('open-safe-stands'), `The second league moment did not render: ${JSON.stringify(secondMoment)}`);
  await click('[data-highlight-choice="open-safe-stands"]');
  await click('[data-highlight-choice="share-final-ball"]');
  await waitFor('window.__integratedDayDebug.getState().season.week.roundComplete', 'The first league match did not settle');
  await assertInsideViewport('[data-season-summary]');
  assert((await text('[data-season-summary-rank]')).includes('当前第'), 'The round summary does not show the live rank');
  assert((await text('[data-season-summary-event]')).includes('谁先用半块场地'), 'The round summary forgot the authored incident');
  await capture('league-round-summary');
  await click('[data-season-next]');
  await waitFor('window.__integratedDayDebug.getState().season.roundIndex === 1', 'The second league round did not open');
  assert(await evaluate('window.__integratedDayDebug.getState().season.projects.stands === 1'), 'Construction did not persist into the next round');
  assert(await evaluate('window.__integratedDayDebug.getState().season.relationships["lin-chuan"] === 1'), 'NPC bonds did not persist into the next round');
  assert(await evaluate('window.__integratedDayDebug.getState().season.relationships.xiaoman === 2'), 'The incident follow-up bond did not persist into the next round');
  await walkAndWait('to-training', 'window.__integratedDayDebug.getMapId() === "training"');
  await walkAndWait('npc-xiaoman', '!document.querySelector("[data-season-conversation]").hidden');
  assert((await text('[data-season-memory-source]')).includes('还记得第 1 轮'), 'The previous incident disappeared before the next decision');
  assert((await text('[data-season-npc-copy]')).includes('那道白线'), 'Xiaoman forgot the previous incident in the next round');
  await click('[data-season-conversation-close]');

  const eliteBefore = await loadQualifiedEliteFixture();
  assert((await text('[data-season-summary-title]')).includes('精英邀请赛资格'), 'The qualified season summary does not announce the invitation');
  assert((await text('[data-season-next]')) === '接受精英邀请', 'The qualified season does not offer a playable elite finale');
  await click('[data-season-next]');
  await waitFor('!document.querySelector("[data-elite-panel]").hidden', 'The elite invitation panel did not open');
  assert((await text('[data-elite-opponent]')) === '鹤岭青训联队', 'The elite invitation opened the wrong opponent');
  assert(await evaluate('document.querySelectorAll("[data-elite-preparation]").length === 3'), 'The elite invitation does not offer three preparation routes');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  assert(!await evaluate('document.documentElement.scrollWidth > innerWidth'), 'The elite invitation overflows on mobile');
  await assertInsideViewport('[data-elite-panel]');
  await capture('elite-invitation-mobile');
  await click('[data-elite-preparation="shared-plan"]');
  assert(await evaluate('window.__integratedDayDebug.getState().season.elite.status === "match"'), 'The elite preparation did not start the match');
  assert((await text('[data-elite-score]')) === '0 : 2', 'The elite match did not begin from its authored deficit');
  for (const choiceId of ['use-league-shape', 'open-built-route', 'follow-shared-plan']) {
    await click(`[data-elite-choice="${choiceId}"]`);
  }
  assert(await evaluate('window.__integratedDayDebug.getState().season.elite.result.id === "champion"'), 'The fully prepared elite route did not win');
  assert((await text('[data-elite-score]')) === '2 : 1', 'The elite final score is not visible');
  assert(await evaluate(`window.__integratedDayDebug.getState().economy.cash === ${eliteBefore.cash + 160}`), 'The elite prize was not paid');
  assert(await evaluate(`window.__integratedDayDebug.getState().roster.cohesion === ${Math.min(100, eliteBefore.cohesion + 4)}`), 'The elite cohesion reward was not applied');
  assert(await evaluate(`window.__integratedDayDebug.getState().communitySupport === ${Math.min(100, eliteBefore.community + 8)}`), 'The elite community reward was not applied');
  assert((await text('[data-elite-result-title]')) === '击败精英队', 'The elite result does not show the permanent outcome');
  await click('[data-elite-next]');
  await waitFor('window.__integratedDayDebug.getState().season.seasonNumber === 2', 'The elite finale did not open the next season');
  assert(await evaluate('window.__integratedDayDebug.getState().season.elite.bestResultId === "champion"'), 'The elite best result did not persist');
}

let exitCode = 0;
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await testThreeDayLoop();
  console.log('PASS three-day life loop');
  console.log('PASS visible launch screen and direct management-week entry');
  console.log('PASS training and relationship path');
  console.log('PASS save and reload restoration');
  console.log('PASS desktop and mobile layout');
  console.log('PASS two-map promise week');
  console.log('PASS blank notice, Shen reversal, and five-chair hearing');
  console.log('PASS three active promise activities');
  console.log('PASS deterministic callback match and character settlement');
  console.log('PASS naming-rights week, free-time loop, public vote, and sign reveal');
  console.log('PASS repeatable league round, authored incident, remembered NPC response, construction, match, and standings');
  console.log('PASS qualified elite invitation, preparation callbacks, permanent result, and next season');
  assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join(' | ')}`);
  console.log('PASS browser console');
} catch (error) {
  exitCode = 1;
  console.error(error.stack || error.message);
} finally {
  socket.close();
  chrome.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => chrome.once('close', resolve)),
    sleep(1500)
  ]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await rm(profileDir, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      break;
    } catch (error) {
      if (attempt === 2) console.warn(`Temporary profile cleanup skipped: ${error.code}`);
      await sleep(150);
    }
  }
  await new Promise(resolveClose => server.close(resolveClose));
}

process.exitCode = exitCode;
