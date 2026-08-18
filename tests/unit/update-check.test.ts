import assert from 'node:assert/strict';
import { test } from 'node:test';

const updateCheckModule = await import('../../src/update-check.js').catch(
  () => ({}),
);

type CacheFile = { checkedAt: number; latestVersion: string };

function makeDeps(overrides: Record<string, unknown> = {}) {
  const writes: string[] = [];
  return {
    argv: [] as string[],
    env: {} as Record<string, string | undefined>,
    isTTY: true,
    cachePath: '/tmp/does-not-matter/update-check.json',
    now: () => 1_000_000,
    currentVersion: '0.1.4',
    cliName: 'asn',
    fetchLatest: async () => '0.1.4',
    readCache: async (): Promise<CacheFile | null> => null,
    writeCache: async () => {},
    write: (text: string) => writes.push(text),
    ttlMs: 86_400_000,
    _writes: writes,
    ...overrides,
  };
}

test('prints a stderr notice naming the exact upgrade command when the cache is stale and a newer version exists', async () => {
  assert.equal(typeof updateCheckModule.maybeNotifyUpdate, 'function');
  const deps = makeDeps({
    fetchLatest: async () => '0.2.0',
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(deps._writes.length, 1);
  assert.match(deps._writes[0], /0\.1\.4/);
  assert.match(deps._writes[0], /0\.2\.0/);
  assert.match(deps._writes[0], /asn upgrade/);
});

test('does not call the network on a fresh cache and stays silent when no drift is recorded', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.9.0';
    },
    readCache: async (): Promise<CacheFile> => ({
      checkedAt: 999_000, // within the 24h window of now (1_000_000)
      latestVersion: '0.1.4',
    }),
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 0);
});

test('prints from a fresh cache without hitting the network when drift was already recorded', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.9.0';
    },
    readCache: async (): Promise<CacheFile> => ({
      checkedAt: 999_000,
      latestVersion: '0.2.0',
    }),
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 1);
  assert.match(deps._writes[0], /0\.2\.0/);
});

test('re-checks and writes a fresh cache entry once the cache is older than the ttl', async () => {
  let fetchCalls = 0;
  let written: unknown;
  const deps = makeDeps({
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.2.0';
    },
    readCache: async (): Promise<CacheFile> => ({
      checkedAt: 1_000_000 - 86_400_001, // just older than the 24h ttl
      latestVersion: '0.1.4',
    }),
    writeCache: async (_path: string, data: unknown) => {
      written = data;
    },
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 1);
  assert.equal(deps._writes.length, 1);
  assert.deepEqual(written, { checkedAt: 1_000_000, latestVersion: '0.2.0' });
});

test('suppresses the notice under --no-update-check', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    argv: ['--no-update-check'],
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.2.0';
    },
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 0);
});

test('suppresses the notice under ASN_NO_UPDATE_CHECK=1', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    env: { ASN_NO_UPDATE_CHECK: '1' },
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.2.0';
    },
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 0);
});

test('suppresses the notice under CI=true', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    env: { CI: 'true' },
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.2.0';
    },
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 0);
});

test('suppresses the notice when stderr is not a TTY', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    isTTY: false,
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.2.0';
    },
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 0);
});

test('suppresses the notice during the upgrade command', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    argv: ['upgrade'],
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.2.0';
    },
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 0);
});

test('suppresses the notice during the update alias command', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    argv: ['update'],
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.2.0';
    },
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 0);
});

test('suppresses the notice during --version', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    argv: ['--version'],
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.2.0';
    },
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 0);
});

test('suppresses the notice during --help', async () => {
  let fetchCalls = 0;
  const deps = makeDeps({
    argv: ['--help'],
    fetchLatest: async () => {
      fetchCalls += 1;
      return '0.2.0';
    },
  });
  await updateCheckModule.maybeNotifyUpdate(deps);
  assert.equal(fetchCalls, 0);
  assert.equal(deps._writes.length, 0);
});

test('a thrown error anywhere in the check path is swallowed silently', async () => {
  const deps = makeDeps({
    readCache: async () => {
      throw new Error('cache boom');
    },
    fetchLatest: async () => {
      throw new Error('network boom');
    },
  });
  await assert.doesNotReject(updateCheckModule.maybeNotifyUpdate(deps));
  assert.equal(deps._writes.length, 0);
});

test('a writeCache failure is also swallowed silently after the notice logic runs', async () => {
  const deps = makeDeps({
    fetchLatest: async () => '0.2.0',
    writeCache: async () => {
      throw new Error('disk full');
    },
  });
  await assert.doesNotReject(updateCheckModule.maybeNotifyUpdate(deps));
});

test('defaultUpdateCachePath honours XDG_CACHE_HOME', () => {
  assert.equal(typeof updateCheckModule.defaultUpdateCachePath, 'function');
  const path = updateCheckModule.defaultUpdateCachePath({
    XDG_CACHE_HOME: '/xdg-cache',
  });
  assert.equal(path, '/xdg-cache/asn/update-check.json');
});
