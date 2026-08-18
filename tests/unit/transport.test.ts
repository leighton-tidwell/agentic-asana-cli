import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';

const transportModule = await import('../../src/transport.js').catch(
  () => ({}),
);

test('mutating request to a read-only workspace never reaches fetch', async () => {
  assert.equal(typeof transportModule.AsanaClient, 'function');
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '100', readOnly: true }],
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  });

  await assert.rejects(
    client.request({ method: 'POST', path: '/tasks', workspaceGid: '100' }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.equal(calls, 0);
});

test('task creation resolves project ownership and ignores a bogus workspace assertion', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const call = { url: String(input), method: init?.method ?? 'GET' };
      calls.push(call);
      return call.method === 'GET'
        ? Response.json({ data: { workspace: { gid: '111111' } } })
        : Response.json({ data: { gid: 'created-task' } });
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/tasks',
      workspaceGids: ['999999'],
      body: { data: { name: 'pwned', projects: ['1201111111111'] } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(calls, [
    {
      url: 'https://app.asana.com/api/1.0/projects/1201111111111?opt_fields=workspace.gid,parent.gid,parent.resource_type',
      method: 'GET',
    },
  ]);
});

test('task creation fails closed when any project workspace cannot resolve', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push(method);
      if (method === 'POST') return Response.json({ data: { gid: 'created' } });
      return String(input).includes('/projects/safe')
        ? Response.json({ data: { workspace: { gid: '999999' } } })
        : Response.json({ data: {} });
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/tasks',
      workspaceGids: ['not-a-real-gid'],
      workspaceLookupPaths: ['/projects/safe', '/projects/unknown'],
      body: { data: { projects: ['safe', 'unknown'] } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(calls, ['GET', 'GET']);
});

test('project creation resolves team ownership before mutating', async () => {
  const methods: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (_input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      methods.push(method);
      return Response.json({ data: { workspace: { gid: '111111' } } });
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/projects',
      workspaceGids: ['999999'],
      workspaceLookupPaths: ['/teams/team-1'],
      body: { data: { name: 'pwned', team: 'team-1' } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(methods, ['GET']);
});

test('attachment creation resolves parent ownership before mutating', async () => {
  const methods: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (_input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      methods.push(method);
      return Response.json({ data: { workspace: { gid: '111111' } } });
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/attachments',
      workspaceGids: ['999999'],
      workspaceLookupPaths: ['/tasks/task-1'],
      body: { data: { parent: 'task-1' } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(methods, ['GET']);
});

test('container resolution network failure fails closed before mutation', async () => {
  const methods: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (_input: string | URL | Request, init?: RequestInit) => {
      methods.push(init?.method ?? 'GET');
      throw new TypeError('network down');
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/tasks',
      workspaceGids: ['999999'],
      workspaceLookupPaths: ['/projects/project-1'],
      body: { data: { projects: ['project-1'] } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(methods, ['GET']);
});

test('container in a writable workspace permits collection creation', async () => {
  const methods: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (_input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      methods.push(method);
      return method === 'GET'
        ? Response.json({ data: { workspace: { gid: '999999' } } })
        : Response.json({ data: { gid: 'created-task' } });
    },
  });

  const result = await client.request({
    method: 'POST',
    path: '/tasks',
    workspaceGids: ['999999'],
    workspaceLookupPaths: ['/projects/project-1'],
    body: { data: { projects: ['project-1'] } },
  });
  assert.deepEqual(result, { data: { gid: 'created-task' } });
  assert.deepEqual(methods, ['GET', 'POST']);
});

test('resource-addressed task mutation resolves its owning workspace before DELETE', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET' });
      return String(input).includes('/tasks/1201234567890') &&
        (init?.method ?? 'GET') === 'GET'
        ? Response.json({ data: { workspace: { gid: '111111' } } })
        : Response.json({ data: {} });
    },
  });

  await assert.rejects(
    client.request({
      method: 'DELETE',
      path: '/tasks/1201234567890',
      workspaceGids: ['999999'],
      workspaceLookupPath: '/tasks/1201234567890',
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(calls, [
    {
      url: 'https://app.asana.com/api/1.0/tasks/1201234567890?opt_fields=workspace.gid,parent.gid,parent.resource_type',
      method: 'GET',
    },
  ]);
});

test('unresolvable resource workspace fails closed despite a caller assertion', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET' });
      return Response.json({ data: {} });
    },
  });

  await assert.rejects(
    client.request({
      method: 'DELETE',
      path: '/tasks/unknown',
      workspaceGids: ['999999'],
      workspaceLookupPath: '/tasks/unknown',
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, 'GET');
});

test('resolved non-read-only resource workspace permits the mutation', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push(method);
      return method === 'GET'
        ? Response.json({ data: { workspace: { gid: '999999' } } })
        : Response.json({ data: { deleted: true } });
    },
  });

  const result = await client.request({
    method: 'DELETE',
    path: '/tasks/safe-task',
    workspaceGids: ['999999'],
    workspaceLookupPath: '/tasks/safe-task',
  });
  assert.deepEqual(result, { data: { deleted: true } });
  assert.deepEqual(calls, ['GET', 'DELETE']);
});

test('attachment workspace resolution blocks DELETE and caches the lookup', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(init?.method ?? 'GET');
      return Response.json({ data: { workspace: { gid: '111111' } } });
    },
  });
  const request = {
    method: 'DELETE',
    path: '/attachments/12345',
    workspaceGids: ['999999'],
    workspaceLookupPath: '/attachments/12345',
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(client.request(request), (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      return true;
    });
  }
  assert.deepEqual(calls, ['GET']);
});

test('attachment resolver follows its parent task to the owning workspace', async () => {
  const urls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      return url.includes('/attachments/')
        ? Response.json({
            data: { parent: { gid: 'task-1', resource_type: 'task' } },
          })
        : Response.json({ data: { workspace: { gid: '111111' } } });
    },
  });

  await assert.rejects(
    client.request({
      method: 'DELETE',
      path: '/attachments/12345',
      workspaceGids: ['999999'],
      workspaceLookupPath: '/attachments/12345',
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      return true;
    },
  );
  assert.deepEqual(urls, [
    'https://app.asana.com/api/1.0/attachments/12345?opt_fields=parent.gid,parent.resource_type',
    'https://app.asana.com/api/1.0/tasks/task-1?opt_fields=workspace.gid,parent.gid,parent.resource_type',
  ]);
});

test('pagination follows next_page offsets and honors a result limit', async () => {
  const urls: string[] = [];
  const pages = [
    { data: [{ gid: '1' }, { gid: '2' }], next_page: { offset: 'next' } },
    { data: [{ gid: '3' }, { gid: '4' }], next_page: null },
  ];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    fetch: async (input: string | URL | Request) => {
      urls.push(String(input));
      return Response.json(pages.shift());
    },
  });

  const result = await client.paginate('/workspaces', { all: true, limit: 3 });
  assert.deepEqual(result, {
    data: [{ gid: '1' }, { gid: '2' }, { gid: '3' }],
    next_page: { offset: 'next' },
  });
  assert.equal(urls.length, 2);
  assert.match(urls[1] ?? '', /offset=next/);
});

test('429 retries honor Retry-After then use exponential backoff', async () => {
  const delays: number[] = [];
  const responses = [
    new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }),
    new Response('{}', { status: 429 }),
    Response.json({ data: { gid: '1' } }),
  ];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    maxAttempts: 3,
    sleep: async (milliseconds: number) => {
      delays.push(milliseconds);
    },
    fetch: async () => responses.shift() as Response,
  });

  const result = await client.request({ method: 'GET', path: '/users/me' });
  assert.deepEqual(result, { data: { gid: '1' } });
  assert.deepEqual(delays, [2000, 2000]);
});

test('HTTP failures map to documented structured errors', async () => {
  const cases = [
    [401, 'AUTH', 3],
    [403, 'FORBIDDEN', 4],
    [404, 'NOT_FOUND', 5],
    [500, 'SERVER', 7],
    [409, 'CONFLICT', 9],
  ] as const;
  for (const [status, code, exitCode] of cases) {
    const client = new transportModule.AsanaClient({
      token: 'safe-test-token',
      fetch: async () =>
        Response.json({ errors: [{ message: 'failure' }] }, { status }),
    });
    await assert.rejects(
      client.request({ method: 'POST', path: '/tasks' }),
      (error: unknown) => {
        assert.equal((error as { code: string }).code, code);
        assert.equal((error as { exitCode: number }).exitCode, exitCode);
        return true;
      },
    );
  }
});

test('transport sends multipart Readable bodies without JSON encoding', async () => {
  const stream = Readable.from(['multipart-bytes']);
  let captured: {
    body?: unknown;
    duplex?: string;
    headers?: Record<string, string>;
  } = {};
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    fetch: async (_input: unknown, init: unknown) => {
      captured = init;
      return Response.json({ data: { gid: 'attachment-1' } });
    },
  });

  await client.request({
    method: 'POST',
    path: '/attachments',
    headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
    body: stream,
  });

  assert.equal(captured.body, stream);
  assert.equal(captured.duplex, 'half');
  assert.equal(
    captured.headers['Content-Type'],
    'multipart/form-data; boundary=test',
  );
});

test('batch blocks a mutating sub-request to a read-only workspace before fetch', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/batch',
      workspaceGid: '999999',
      body: {
        data: {
          actions: [
            {
              method: 'post',
              relative_path: '/tasks',
              data: { workspace: '111111' },
            },
          ],
        },
      },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.equal(calls, 0);
});

test('batch with an unexpected body shape fails closed before fetch', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/batch',
      workspaceGid: '999999',
      body: { data: { actions: 'not-an-array' } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.equal(calls, 0);
});

test('batch with a malformed action fails closed before fetch', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/batch',
      workspaceGid: '999999',
      body: { data: { actions: [{}] } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.equal(calls, 0);
});

test('batch permits read-only workspace GET sub-requests', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async () => {
      calls += 1;
      return Response.json({ data: [] });
    },
  });

  await client.request({
    method: 'POST',
    path: '/batch',
    body: {
      data: {
        actions: [
          {
            method: 'get',
            relative_path: '/tasks?workspace=111111',
            data: { workspace: '111111' },
          },
        ],
      },
    },
  });
  assert.equal(calls, 1);
});

test('batch blocks a mutating sub-request with an unresolved workspace', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/batch',
      workspaceGid: '999999',
      body: {
        data: {
          actions: [{ method: 'delete', relative_path: '/tasks/123' }],
        },
      },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.equal(calls, 0);
});

test('batch recursively blocks a nested batch mutation', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/batch',
      body: {
        data: {
          actions: [
            {
              method: 'post',
              relative_path: '/batch',
              data: {
                actions: [
                  {
                    method: 'post',
                    relative_path: '/tasks',
                    data: { workspace: '111111' },
                  },
                ],
              },
            },
          ],
        },
      },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      return true;
    },
  );
  assert.equal(calls, 0);
});

test('webhook creation resolves its resource workspace and blocks before POST', async () => {
  let calls = 0;
  const resolvedResources: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '111111', readOnly: true }],
    resolveWorkspace: async (resourceGid: string) => {
      resolvedResources.push(resourceGid);
      return '111111';
    },
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/webhooks?opt_fields=gid',
      workspaceGid: '999999',
      body: {
        data: {
          resource: '1201234567890',
          target: 'https://attacker.example/hook',
        },
      },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(resolvedResources, ['1201234567890']);
  assert.equal(calls, 0);
});

test('webhook creation blocks an unlisted external target without opt-in', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '111111', readOnly: true },
      { gid: '999999', readOnly: false },
    ],
    resolveWorkspace: async () => '999999',
    webhookTargetAllowlist: ['https://hooks.example'],
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  });

  await assert.rejects(
    client.request({
      method: 'POST',
      path: '/webhooks',
      body: {
        data: {
          resource: '1201234567890',
          target: 'https://attacker.example/hook',
        },
      },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.equal(calls, 0);
});

test('webhook creation permits an allowlisted target origin', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '111111', readOnly: true },
      { gid: '999999', readOnly: false },
    ],
    resolveWorkspace: async () => '999999',
    webhookTargetAllowlist: ['https://hooks.example/approved-path'],
    fetch: async () => {
      calls += 1;
      return Response.json({ data: { gid: 'webhook-1' } });
    },
  });

  await client.request({
    method: 'POST',
    path: '/webhooks',
    body: {
      data: {
        resource: '1201234567890',
        target: 'https://hooks.example/callback',
      },
    },
  });
  assert.equal(calls, 1);
});

test('webhook creation permits an unlisted target with explicit opt-in', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '111111', readOnly: true },
      { gid: '999999', readOnly: false },
    ],
    resolveWorkspace: async () => '999999',
    webhookTargetAllowlist: [],
    allowUnlistedWebhookTarget: true,
    fetch: async () => {
      calls += 1;
      return Response.json({ data: { gid: 'webhook-1' } });
    },
  });

  await client.request({
    method: 'POST',
    path: '/webhooks',
    body: {
      data: {
        resource: '1201234567890',
        target: 'https://operator-approved.example/callback',
      },
    },
  });
  assert.equal(calls, 1);
});
