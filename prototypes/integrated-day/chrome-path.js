import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';

function platformCandidates(platformName, env) {
  const executableNames = platformName === 'win32'
    ? ['chrome.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  const separator = platformName === 'win32' ? ';' : ':';
  const pathCandidates = (env.PATH || '')
    .split(separator)
    .filter(Boolean)
    .flatMap(directory => executableNames.map(name => join(directory, name)));
  const fixedCandidates = platformName === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : platformName === 'linux'
      ? ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
      : [
          join(env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          join(env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe')
        ];
  return [...pathCandidates, ...fixedCandidates];
}

export function resolveChromePath({ env = process.env, platformName = platform(), candidates } = {}) {
  if (env.CHROME_PATH) {
    if (existsSync(env.CHROME_PATH)) return env.CHROME_PATH;
    throw new Error(`CHROME_PATH does not exist: ${env.CHROME_PATH}`);
  }
  const detectedCandidates = candidates ?? platformCandidates(platformName, env);
  const resolved = detectedCandidates.find(candidate => existsSync(candidate));
  if (!resolved) {
    throw new Error('Chrome executable not found. Set CHROME_PATH to run the browser smoke test.');
  }
  return resolved;
}
