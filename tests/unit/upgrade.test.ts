import assert from 'node:assert/strict';
import { test } from 'node:test';

const upgradeModule = await import('../../src/upgrade.js').catch(() => ({}));

test('detectInstallChannel honours an explicit env override', () => {
  const channel = upgradeModule.detectInstallChannel({
    env: { ASN_INSTALL_CHANNEL: 'npm-global' },
    realPath: '/anything/at/all',
  });
  assert.equal(channel, 'npm-global');
});

test('detectInstallChannel recognizes a global npm install path', () => {
  const channel = upgradeModule.detectInstallChannel({
    env: {},
    realPath: '/usr/local/lib/node_modules/@agentic-asana/asn/dist/main.js',
  });
  assert.equal(channel, 'npm-global');
});

test('detectInstallChannel recognizes a source checkout', () => {
  const files = new Set(['/repo/package.json', '/repo/src']);
  const channel = upgradeModule.detectInstallChannel({
    env: {},
    realPath: '/repo/src/main.ts',
    fileExists: (path: string) => files.has(path),
    readFile: (path: string) =>
      path === '/repo/package.json'
        ? JSON.stringify({ name: '@agentic-asana/asn' })
        : '',
  });
  assert.equal(channel, 'source');
});

test('detectInstallChannel falls back to unknown when nothing matches', () => {
  const channel = upgradeModule.detectInstallChannel({
    env: {},
    realPath: '/opt/homebrew/Cellar/asn/0.1.4/bin/asn',
    fileExists: () => false,
  });
  assert.equal(channel, 'unknown');
});

test('fetchLatestRelease parses the tag_name into a bare version', async () => {
  const release = await upgradeModule.fetchLatestRelease(async () =>
    Response.json({ tag_name: 'v0.1.5' }),
  );
  assert.deepEqual(release, { version: '0.1.5' });
});

test('fetchLatestRelease reports an actionable error when the registry has no versions', async () => {
  await assert.rejects(
    upgradeModule.fetchLatestRelease(async () => Response.json({})),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'NOT_FOUND');
      assert.match((error as Error).message, /no published versions/);
      return true;
    },
  );
});

test('fetchLatestRelease reports an actionable error on network failure', async () => {
  await assert.rejects(
    upgradeModule.fetchLatestRelease(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'NETWORK');
      return true;
    },
  );
});

test('fetchLatestRelease reports an actionable error on a non-ok response', async () => {
  await assert.rejects(
    upgradeModule.fetchLatestRelease(
      async () => new Response('', { status: 503 }),
    ),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'SERVER');
      assert.match((error as Error).message, /503/);
      return true;
    },
  );
});

test('runUpgrade no-ops when already on the latest version', async () => {
  let runnerCalls = 0;
  const outcome = await upgradeModule.runUpgrade(
    {},
    {
      env: {},
      currentVersion: '0.1.5',
      realPath: '/usr/local/lib/node_modules/@agentic-asana/asn/dist/main.js',
      fetchLatest: async () => ({ version: '0.1.5' }),
      runner: async () => {
        runnerCalls += 1;
        return { code: 0, stdout: '', stderr: '' };
      },
    },
  );
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.mutated, false);
  assert.match(outcome.message, /already at the latest version/);
  assert.equal(runnerCalls, 0);
});

test('runUpgrade --check reports versions and never mutates', async () => {
  let runnerCalls = 0;
  const outcome = await upgradeModule.runUpgrade(
    { check: true },
    {
      env: {},
      currentVersion: '0.1.4',
      realPath: '/usr/local/lib/node_modules/@agentic-asana/asn/dist/main.js',
      fetchLatest: async () => ({ version: '0.1.5' }),
      runner: async () => {
        runnerCalls += 1;
        return { code: 0, stdout: '', stderr: '' };
      },
    },
  );
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.mutated, false);
  assert.match(outcome.message, /0\.1\.4/);
  assert.match(outcome.message, /0\.1\.5/);
  assert.equal(runnerCalls, 0);
});

test('runUpgrade happy path installs the new version on the npm-global channel', async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const outcome = await upgradeModule.runUpgrade(
    { yes: true },
    {
      env: {},
      currentVersion: '0.1.4',
      realPath: '/usr/local/lib/node_modules/@agentic-asana/asn/dist/main.js',
      fetchLatest: async () => ({ version: '0.1.5' }),
      runner: async (command: string, args: string[]) => {
        calls.push({ command, args });
        return { code: 0, stdout: '', stderr: '' };
      },
    },
  );
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.mutated, true);
  assert.match(outcome.message, /0\.1\.4/);
  assert.match(outcome.message, /0\.1\.5/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, 'npm');
  assert.deepEqual(calls[0]?.args.slice(0, 2), ['install', '-g']);
  assert.match(calls[0]?.args[2] ?? '', /v0\.1\.5/);
});

test('runUpgrade refuses to overwrite an unmanageable channel and names the real command', async () => {
  const files = new Set(['/repo/package.json', '/repo/src']);
  let runnerCalls = 0;
  await assert.rejects(
    upgradeModule.runUpgrade(
      { yes: true },
      {
        env: {},
        currentVersion: '0.1.4',
        realPath: '/repo/src/main.ts',
        fetchLatest: async () => ({ version: '0.1.5' }),
        fileExists: (path: string) => files.has(path),
        readFile: (path: string) =>
          path === '/repo/package.json'
            ? JSON.stringify({ name: '@agentic-asana/asn' })
            : '',
        runner: async () => {
          runnerCalls += 1;
          return { code: 0, stdout: '', stderr: '' };
        },
      },
    ),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'USAGE');
      assert.match((error as Error).message, /git pull/);
      return true;
    },
  );
  assert.equal(runnerCalls, 0);
});

test('runUpgrade surfaces an actionable message on permission denied', async () => {
  await assert.rejects(
    upgradeModule.runUpgrade(
      { yes: true },
      {
        env: {},
        currentVersion: '0.1.4',
        realPath: '/usr/local/lib/node_modules/@agentic-asana/asn/dist/main.js',
        fetchLatest: async () => ({ version: '0.1.5' }),
        runner: async () => ({
          code: 1,
          stdout: '',
          stderr: 'Error: EACCES: permission denied, mkdir ...',
        }),
      },
    ),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'FORBIDDEN');
      assert.match((error as Error).message, /sudo/);
      return true;
    },
  );
});

test('runUpgrade honours an explicit --version pin over the latest release', async () => {
  const calls: Array<{ args: string[] }> = [];
  const outcome = await upgradeModule.runUpgrade(
    { version: '0.1.9', yes: true },
    {
      env: {},
      currentVersion: '0.1.4',
      realPath: '/usr/local/lib/node_modules/@agentic-asana/asn/dist/main.js',
      fetchLatest: async () => ({ version: '0.1.5' }),
      runner: async (_command: string, args: string[]) => {
        calls.push({ args });
        return { code: 0, stdout: '', stderr: '' };
      },
    },
  );
  assert.equal(outcome.mutated, true);
  assert.match(calls[0]?.args[2] ?? '', /v0\.1\.9/);
  assert.match(outcome.message, /0\.1\.9/);
});

test('runUpgrade cancels without mutating when not confirmed and --yes is absent', async () => {
  let runnerCalls = 0;
  const outcome = await upgradeModule.runUpgrade(
    {},
    {
      env: {},
      currentVersion: '0.1.4',
      realPath: '/usr/local/lib/node_modules/@agentic-asana/asn/dist/main.js',
      fetchLatest: async () => ({ version: '0.1.5' }),
      runner: async () => {
        runnerCalls += 1;
        return { code: 0, stdout: '', stderr: '' };
      },
    },
  );
  assert.equal(outcome.mutated, false);
  assert.equal(outcome.exitCode, 0);
  assert.equal(runnerCalls, 0);
});
