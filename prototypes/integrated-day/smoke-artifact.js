import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function writeSmokeArtifact(name, data, { directory = tmpdir() } = {}) {
  const artifactPath = join(directory, `integrated-day-${name}.png`);
  await writeFile(artifactPath, data);
  return artifactPath;
}
