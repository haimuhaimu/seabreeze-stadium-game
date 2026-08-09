import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getOrders } from './daily-content.js';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pageUrl = pathToFileURL(join(import.meta.dirname, 'index.html')).href;
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
      const page = pages.find(item => item.type === 'page' && item.url.startsWith(pageUrl));
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

async function waitFor(expression, message, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(80);
  }
  throw new Error(message);
}

async function navigate() {
  navigationCount += 1;
  if (navigationCount === 1) {
    const navigation = await send('Page.navigate', { url: `${pageUrl}?smoke=1` });
    if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);
  } else {
    await send('Page.reload', { ignoreCache: true });
  }
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

async function testThreeDayLoop() {
  await navigate();
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
  assert(desktop.startHidden, 'A fresh profile should not show continue controls');

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
  console.log('PASS training and relationship path');
  console.log('PASS save and reload restoration');
  console.log('PASS desktop and mobile layout');
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
}

process.exitCode = exitCode;
