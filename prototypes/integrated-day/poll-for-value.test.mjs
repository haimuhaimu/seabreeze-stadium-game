import assert from 'node:assert/strict';
import test from 'node:test';

let pollForValue;
try {
  ({ pollForValue } = await import('./poll-for-value.js'));
} catch {}

test('delayed Chrome startup can become ready after sixty probes', async () => {
  let probes = 0;
  const result = await pollForValue?.(
    async () => (++probes > 60 ? 'ws://ready' : undefined),
    { wait: async () => {} }
  );

  assert.equal(result, 'ws://ready');
  assert.equal(probes, 61);
});
