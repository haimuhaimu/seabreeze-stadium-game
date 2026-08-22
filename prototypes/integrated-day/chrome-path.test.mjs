import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

let resolveChromePath;
try {
  ({ resolveChromePath } = await import('./chrome-path.js'));
} catch {}

test('configured Chrome executable overrides platform candidates', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'seabreeze-chrome-path-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configured = join(directory, 'configured-chrome');
  const detected = join(directory, 'detected-chrome');
  await writeFile(configured, '');
  await writeFile(detected, '');

  assert.equal(
    resolveChromePath?.({ env: { CHROME_PATH: configured }, candidates: [detected] }),
    configured
  );
});

test('first existing platform candidate is used without an override', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'seabreeze-chrome-path-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const missing = join(directory, 'missing-chrome');
  const detected = join(directory, 'detected-chrome');
  await writeFile(detected, '');

  assert.equal(
    resolveChromePath({ env: {}, candidates: [missing, detected] }),
    detected
  );
});

test('missing Chrome executable reports the override to configure', () => {
  assert.throws(
    () => resolveChromePath({ env: {}, candidates: ['/missing/chrome'] }),
    /CHROME_PATH/
  );
});

test('invalid CHROME_PATH is rejected before spawning Chrome', () => {
  assert.throws(
    () => resolveChromePath({ env: { CHROME_PATH: '/missing/chrome' }, candidates: [] }),
    /CHROME_PATH.*does not exist/
  );
});

test('Chrome is discovered from PATH on Linux', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'seabreeze-chrome-path-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = join(directory, 'google-chrome');
  await writeFile(executable, '');

  assert.equal(
    resolveChromePath({ env: { PATH: directory }, platformName: 'linux' }),
    executable
  );
});
