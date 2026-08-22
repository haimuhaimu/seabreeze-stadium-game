const waitForInterval = intervalMs => new Promise(resolve => setTimeout(resolve, intervalMs));

export async function pollForValue(read, { attempts = 200, intervalMs = 100, wait = waitForInterval } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await read();
    if (value) return value;
    if (attempt + 1 < attempts) await wait(intervalMs);
  }
  return undefined;
}
