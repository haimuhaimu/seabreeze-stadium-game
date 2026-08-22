import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

let writeSmokeArtifact;
try {
  ({ writeSmokeArtifact } = await import('./smoke-artifact.js'));
} catch {}

test('browser screenshots are written inside the operating-system temp directory', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'seabreeze-smoke-artifact-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const artifactPath = await writeSmokeArtifact?.('launch', Buffer.from('png'), { directory });

  assert.equal(artifactPath, join(directory, 'integrated-day-launch.png'));
  assert.equal((await readFile(artifactPath, 'utf8')), 'png');
});
