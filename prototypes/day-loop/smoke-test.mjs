import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pageUrl = pathToFileURL(join(import.meta.dirname, 'index.html')).href;
const profileDir = await mkdtemp(join(tmpdir(), 'an-ruotong-smoke-'));
const debugPort = 9237;

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--allow-file-access-from-files',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  `${pageUrl}?v=1`
], { stdio: ['ignore', 'ignore', 'pipe'] });

let chromeError = '';
chrome.stderr.on('data', chunk => { chromeError += chunk.toString(); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDebugger() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const pages = await response.json();
      const page = pages.find(item => item.type === 'page');
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
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function navigate(variant) {
  await send('Page.navigate', { url: `${pageUrl}?v=${variant}` });
  await sleep(450);
  const title = await evaluate('document.title');
  if (!title.includes('安若童')) throw new Error(`Variant ${variant} did not load`);
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
  await sleep(30);
}

async function testFreeDay() {
  await navigate(1);
  for (const id of ['coach', 'grass-a', 'grass-b', 'boards', 'bench', 'door']) {
    await click(`[data-object="${id}"]`);
  }
  const result = await evaluate(`({
    summary: document.querySelector('.day-summary h2')?.textContent,
    goals: [...document.querySelectorAll('.objective.done')].length,
    overflow: document.documentElement.scrollWidth > innerWidth
  })`);
  assert(result.summary === '今天没有白过', 'Free-day loop did not reach its summary');
  assert(result.goals === 4, `Free-day goals did not all complete: ${JSON.stringify(result)}`);
  assert(!result.overflow, 'Free-day desktop layout overflows horizontally');
}

async function testTogether() {
  await navigate(2);
  for (const id of ['lin', 'qiao', 'guo']) {
    await click(`[data-person="${id}"]`);
    await click('[data-spend]');
    await click('[data-close]');
  }
  const enabled = await evaluate('!document.querySelector("[data-end-together]").disabled');
  assert(enabled, 'Together loop did not enable day ending');
  await click('[data-end-together]');
  const summary = await evaluate('document.querySelector(".day-summary h2")?.textContent');
  assert(summary === '队伍记住了你', 'Together loop did not reach its summary');
}

async function testShop() {
  await navigate(3);
  const hiddenInitially = await evaluate('document.querySelector("[data-upgrades]").hidden && getComputedStyle(document.querySelector("[data-upgrades]")).display === "none"');
  assert(hiddenInitially, 'Shop upgrades are visible before serving customers');
  for (const recipe of ['tea', 'towel', 'fruit', 'tea']) {
    await click(`[data-recipe="${recipe}"]`);
  }
  const ready = await evaluate(`({
    goal: document.querySelector('[data-shop-goal="serve"]').classList.contains('done'),
    upgrades: !document.querySelector('[data-upgrades]').hidden,
    money: document.querySelector('[data-energy]').textContent
  })`);
  assert(ready.goal && ready.upgrades, 'Shop loop did not unlock upgrades');
  assert(ready.money === '38 元', 'Shop revenue is incorrect');
  await click('[data-upgrade="遮雨棚"]');
  const summary = await evaluate('document.querySelector(".day-summary h2")?.textContent');
  assert(summary === '遮雨棚修好了', 'Shop loop did not reach its summary');
}

async function testMobile() {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await navigate(1);
  const mobile = await evaluate(`({
    controls: getComputedStyle(document.querySelector('.mobile-controls')).display,
    action: getComputedStyle(document.querySelector('.action-button-mobile')).display,
    overflow: document.documentElement.scrollWidth > innerWidth
  })`);
  assert(mobile.controls !== 'none' && mobile.action !== 'none', 'Mobile controls are not visible');
  assert(!mobile.overflow, 'Mobile layout overflows horizontally');
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
  await testFreeDay();
  await testTogether();
  await testShop();
  await testMobile();
  assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join(' | ')}`);
  console.log('PASS free-day loop');
  console.log('PASS together loop');
  console.log('PASS shop loop');
  console.log('PASS desktop and mobile overflow checks');
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
