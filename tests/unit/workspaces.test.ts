import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
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
