import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const workspaceModule = await import('../../src/workspaces.js').catch(
  () => ({}),
);

test('workspace list auto-discovers and caches when none are configured', async () => {
  assert.equal(typeof workspaceModule.listWorkspaces, 'function');
  const directory = await mkdtemp(join(tmpdir(), 'asn-workspaces-'));
  let calls = 0;
  const client = {
    paginate: async () => {
      calls += 1;
      return { data: [{ gid: '100', name: 'Example' }], next_page: null };
    },
  };
  try {
    const options = {
      configured: [],
      cachePath: join(directory, 'workspaces.json'),
      client,
      now: () => 1_000,
    };
    const first = await workspaceModule.listWorkspaces(options);
    const second = await workspaceModule.listWorkspaces(options);
    assert.deepEqual(first, [{ gid: '100', name: 'Example', readOnly: false }]);
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('workspace cache restricts an existing file and creates a private parent directory', async () => {
  assert.equal(typeof workspaceModule.listWorkspaces, 'function');
  const root = await mkdtemp(join(tmpdir(), 'asn-workspace-mode-'));
  const existingCachePath = join(root, 'workspaces.json');
  const newDirectory = join(root, 'asn');
  const newCachePath = join(newDirectory, 'workspaces.json');
  const options = {
    configured: [],
    client: {
      paginate: async () => ({ data: [{ gid: '100' }], next_page: null }),
    },
    refresh: true,
  };
  try {
    await writeFile(existingCachePath, '{}', { mode: 0o666 });
    await chmod(existingCachePath, 0o644);

    await workspaceModule.listWorkspaces({
      ...options,
      cachePath: existingCachePath,
    });
    await workspaceModule.listWorkspaces({
      ...options,
      cachePath: newCachePath,
    });

    assert.equal((await stat(existingCachePath)).mode & 0o077, 0);
    assert.equal((await stat(newCachePath)).mode & 0o077, 0);
    assert.equal((await stat(newDirectory)).mode & 0o077, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
