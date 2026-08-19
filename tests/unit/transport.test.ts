import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('caller workspace cannot bypass authoritative organization or target ownership', async () => {
  for (const { path, data } of [
    {
      path: '/teams',
      data: { name: 'pwned', organization: 'ro-organization' },
    },
    {
      path: '/organization_exports',
      data: { organization: 'ro-organization' },
    },
    {
      path: '/access_requests',
      data: { target: 'ro-target', user: 'me' },
    },
  ]) {
    const calls: Array<{ url: string; method: string }> = [];
    const client = new transportModule.AsanaClient({
      token: 'safe-test-token',
      workspaces: [
        { gid: '111111', readOnly: true },
        { gid: '222222', readOnly: false },
      ],
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        const call = { url: String(input), method: init?.method ?? 'GET' };
        calls.push(call);
        return call.method === 'GET'
          ? Response.json({ data: { workspace: { gid: '111111' } } })
          : Response.json({ data: { gid: 'created' } });
      },
    });

    await assert.rejects(
      client.request({
        method: 'POST',
        path,
        workspaceGids: ['222222'],
        body: { data: { ...data, workspace: '222222' } },
      }),
      (error: unknown) => {
        assert.ok(
          ['READONLY_BLOCKED', 'READONLY_UNRESOLVED'].includes(
            (error as { code: string }).code,
          ),
        );
        return true;
      },
    );
    assert.equal(
      calls.filter((call) => call.method === 'POST').length,
      0,
      path,
    );
  }
});

test('object and string container reference shapes cannot be hidden by a decoy workspace', async () => {
  for (const { path, data } of [
    {
      path: '/tasks',
      data: { name: 'pwned', projects: [{ gid: 'ro-project' }] },
    },
    { path: '/tasks', data: { name: 'pwned', projects: 'ro-project' } },
    { path: '/tasks', data: { name: 'pwned', parent: { gid: 'ro-task' } } },
    { path: '/projects', data: { name: 'pwned', team: { gid: 'ro-team' } } },
  ]) {
    const calls: string[] = [];
    const client = new transportModule.AsanaClient({
      token: 'safe-test-token',
      workspaces: [
        { gid: '111111', readOnly: true },
        { gid: '222222', readOnly: false },
      ],
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        calls.push(method);
        return method === 'GET'
          ? Response.json({
              data: {
                workspace: {
                  gid: String(input).includes('/workspaces/222222')
                    ? '222222'
                    : '111111',
                },
              },
            })
          : Response.json({ data: { gid: 'created' } });
      },
    });

    await assert.rejects(
      client.request({
        method: 'POST',
        path,
        workspaceGids: ['222222'],
        body: { data: { ...data, workspace: '222222' } },
      }),
      (error: unknown) => {
        assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
        return true;
      },
    );
    assert.equal(calls.includes('POST'), false, path);
  }
});

test('body workspace authorizes a create only after server confirmation', async () => {
  for (const confirmed of [false, true]) {
    const methods: string[] = [];
    const client = new transportModule.AsanaClient({
      token: 'safe-test-token',
      workspaces: [
        { gid: '111111', readOnly: true },
        { gid: '222222', readOnly: false },
      ],
      fetch: async (_input: string | URL | Request, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        methods.push(method);
        return method === 'GET'
          ? Response.json({ data: confirmed ? { gid: '222222' } : {} })
          : Response.json({ data: { gid: 'created' } });
      },
    });
    const request = {
      method: 'POST',
      path: '/tasks',
      workspaceGids: ['222222'],
      body: { data: { name: 'created', workspace: '222222' } },
    };

    if (confirmed) {
      await client.request(request);
      assert.deepEqual(methods, ['GET', 'POST']);
    } else {
      await assert.rejects(client.request(request), (error: unknown) => {
        assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
        return true;
      });
      assert.deepEqual(methods, ['GET']);
    }
  }
});

test('project-parent collection creates resolve project ownership on supported endpoints', async () => {
  for (const path of [
    '/allocations',
    '/budgets',
    '/memberships',
    '/rates',
    '/status_updates',
  ]) {
    for (const { parent, workspace, sent } of [
      { parent: 'rw-project', workspace: '222222', sent: true },
      { parent: 'ro-project', workspace: '111111', sent: false },
    ]) {
      const methods: string[] = [];
      const client = new transportModule.AsanaClient({
        token: 'safe-test-token',
        workspaces: [
          { gid: '111111', readOnly: true },
          { gid: '222222', readOnly: false },
        ],
        fetch: async (input: string | URL | Request, init?: RequestInit) => {
          const method = init?.method ?? 'GET';
          methods.push(method);
          const url = String(input);
          if (method === 'POST')
            return Response.json({ data: { gid: 'created' } });
          if (url.includes(`/projects/${parent}`)) {
            return Response.json({ data: { workspace: { gid: workspace } } });
          }
          return Response.json({ data: {} }, { status: 404 });
        },
      });
      const request = {
        method: 'POST',
        path,
        body: {
          data: {
            parent,
            ...(path === '/rates' ? { resource: 'user-1', rate: 1 } : {}),
          },
        },
      };

      if (sent) {
        await client.request(request);
        assert.equal(
          methods.filter((method) => method === 'POST').length,
          1,
          path,
        );
      } else {
        await assert.rejects(client.request(request), (error: unknown) => {
          assert.ok(
            ['READONLY_BLOCKED', 'READONLY_UNRESOLVED'].includes(
              (error as { code: string }).code,
            ),
          );
          return true;
        });
        assert.equal(methods.includes('POST'), false, path);
      }
    }
  }
});

test('caller fields never upgrade an unresolved manifest collection create to sent', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../gen/manifest.json', import.meta.url), 'utf8'),
  ) as { commands: Array<{ method: string; path: string }> };
  const paths = manifest.commands
    .filter(
      (entry) =>
        entry.method === 'POST' &&
        entry.path.split('/').filter(Boolean).length === 1 &&
        !['/batch', '/webhooks', '/workspaces'].includes(entry.path),
    )
    .map((entry) => entry.path);
  assert.equal(paths.length, 19);

  for (const path of paths) {
    for (const assertion of [undefined, '222222', 'invalid']) {
      for (const bodyWorkspace of [undefined, '222222']) {
        const methods: string[] = [];
        const client = new transportModule.AsanaClient({
          token: 'safe-test-token',
          workspaces: [
            { gid: '111111', readOnly: true },
            { gid: '222222', readOnly: false },
          ],
          fetch: async (_input: string | URL | Request, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            methods.push(method);
            return method === 'GET'
              ? Response.json({ data: {} })
              : Response.json({ data: { gid: 'created' } });
          },
        });

        await assert.rejects(
          client.request({
            method: 'POST',
            path,
            ...(assertion ? { workspaceGids: [assertion] } : {}),
            ...(bodyWorkspace
              ? { body: { data: { workspace: bodyWorkspace } } }
              : {}),
          }),
          (error: unknown) => {
            assert.ok(
              ['READONLY_BLOCKED', 'READONLY_UNRESOLVED'].includes(
                (error as { code: string }).code,
              ),
            );
            return true;
          },
        );
        assert.equal(methods.includes('POST'), false, `${path} ${assertion}`);
      }
    }
  }
});

test('polymorphic target and parent references use the first resolvable container type', async () => {
  for (const { path, data, expectedLookups } of [
    {
      path: '/access_requests',
      data: { target: 'project-1', user: 'me' },
      expectedLookups: ['/projects/project-1'],
    },
    {
      path: '/memberships',
      data: { parent: 'portfolio-1', member: 'user-1' },
      expectedLookups: [
        '/projects/portfolio-1',
        '/goals/portfolio-1',
        '/portfolios/portfolio-1',
      ],
    },
  ]) {
    const lookups: string[] = [];
    const client = new transportModule.AsanaClient({
      token: 'safe-test-token',
      workspaces: [{ gid: '111111', readOnly: true }],
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        const pathname = new URL(String(input)).pathname.replace(
          '/api/1.0',
          '',
        );
        if (method === 'POST')
          return Response.json({ data: { gid: 'created' } });
        lookups.push(pathname);
        return expectedLookups.at(-1) === pathname
          ? Response.json({ data: { workspace: { gid: '111111' } } })
          : Response.json({ data: {} }, { status: 404 });
      },
    });

    await assert.rejects(
      client.request({ method: 'POST', path, body: { data } }),
      (error: unknown) => {
        assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
        return true;
      },
    );
    assert.deepEqual(lookups, expectedLookups);
  }
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

test('section mutation in a writable workspace succeeds while another workspace is read-only', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '1111111111111111', readOnly: false },
      { gid: '2222222222222222', readOnly: true },
    ],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(method);
      if (method !== 'GET') return Response.json({ data: { gid: 'sec-1' } });
      if (url.includes('/sections/')) {
        return Response.json({
          data: { gid: 'sec-1', project: { gid: 'proj-1' } },
        });
      }
      return Response.json({
        data: { workspace: { gid: '1111111111111111' } },
      });
    },
  });

  const result = await client.request({
    method: 'PUT',
    path: '/sections/sec-1',
    workspaceLookupPath: '/sections/sec-1',
    body: { data: { name: 'Renamed' } },
  });

  assert.deepEqual(result, { data: { gid: 'sec-1' } });
  assert.deepEqual(calls, ['GET', 'GET', 'PUT']);
});

test('section resolver hops section → project → workspace', async () => {
  const urls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '1111111111111111', readOnly: false },
      { gid: '2222222222222222', readOnly: true },
    ],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET') urls.push(url);
      if (url.includes('/sections/')) {
        return Response.json({
          data: { gid: 'sec-1', project: { gid: 'proj-1' } },
        });
      }
      if (url.includes('/projects/')) {
        return Response.json({
          data: { workspace: { gid: '1111111111111111' } },
        });
      }
      return Response.json({ data: { gid: 'sec-1' } });
    },
  });

  await client.request({
    method: 'PUT',
    path: '/sections/sec-1',
    workspaceLookupPath: '/sections/sec-1',
    body: { data: { name: 'Renamed' } },
  });

  assert.deepEqual(urls, [
    'https://app.asana.com/api/1.0/sections/sec-1?opt_fields=workspace.gid,parent.gid,parent.resource_type,project.gid',
    'https://app.asana.com/api/1.0/projects/proj-1?opt_fields=workspace.gid,parent.gid,parent.resource_type',
  ]);
});

test('section mutation targeting a read-only workspace is still blocked', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '1111111111111111', readOnly: false },
      { gid: '2222222222222222', readOnly: true },
    ],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(method);
      if (method !== 'GET') return Response.json({ data: { gid: 'sec-1' } });
      if (url.includes('/sections/')) {
        return Response.json({
          data: { gid: 'sec-1', project: { gid: 'proj-1' } },
        });
      }
      return Response.json({
        data: { workspace: { gid: '2222222222222222' } },
      });
    },
  });

  await assert.rejects(
    client.request({
      method: 'PUT',
      path: '/sections/sec-1',
      workspaceLookupPath: '/sections/sec-1',
      body: { data: { name: 'Renamed' } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(calls, ['GET', 'GET']);
});

test('section resolution is cached across repeated requests', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '2222222222222222', readOnly: true }],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET') calls.push(url);
      if (url.includes('/sections/')) {
        return Response.json({
          data: { gid: 'sec-1', project: { gid: 'proj-1' } },
        });
      }
      return Response.json({
        data: { workspace: { gid: '2222222222222222' } },
      });
    },
  });

  for (let i = 0; i < 2; i += 1) {
    await assert.rejects(
      client.request({
        method: 'PUT',
        path: '/sections/sec-1',
        workspaceLookupPath: '/sections/sec-1',
        body: { data: { name: 'Renamed' } },
      }),
      (error: unknown) => {
        assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
        return true;
      },
    );
  }
  assert.equal(calls.length, 2);
});

test('resource with no resolvable container still fails closed', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '2222222222222222', readOnly: true }],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push(method);
      return Response.json({ data: { gid: 'x' } });
    },
  });

  await assert.rejects(
    client.request({
      method: 'PUT',
      path: '/memberships/x',
      workspaceLookupPath: '/memberships/x',
      body: { data: {} },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(calls, ['GET']);
});

test('link resolution stops at the depth budget', async () => {
  const calls: string[] = [];
  let counter = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '2222222222222222', readOnly: true }],
    fetch: async () => {
      calls.push('GET');
      counter += 1;
      return Response.json({
        data: {
          gid: `p${counter}`,
          parent: { gid: `p${counter + 1}`, resource_type: 'task' },
        },
      });
    },
  });

  await assert.rejects(
    client.request({
      method: 'PUT',
      path: '/sections/a',
      workspaceLookupPath: '/sections/a',
      body: { data: {} },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
      return true;
    },
  );
  assert.ok(
    calls.length <= 5,
    `expected a bounded number of GETs, got ${calls.length}`,
  );
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

test('webhook creation blocks an unlisted target with an all-writable config and an explicit allowlist', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '999999', readOnly: false }],
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

test('webhook creation blocks an unlisted target with an all-writable config and no configured allowlist', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '999999', readOnly: false }],
    resolveWorkspace: async () => '999999',
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

test('webhook creation permits an allowlisted target origin with an all-writable config', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '999999', readOnly: false }],
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

test('dry-run (assertAllowed) blocks an unlisted target with an all-writable config and an explicit allowlist', () => {
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '999999', readOnly: false }],
    webhookTargetAllowlist: ['https://hooks.example'],
  });

  assert.throws(
    () =>
      client.assertAllowed({
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
});

test('dry-run (assertAllowed) blocks an unlisted target with an all-writable config and no configured allowlist', () => {
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '999999', readOnly: false }],
  });

  assert.throws(
    () =>
      client.assertAllowed({
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
});

test('dry-run (assertAllowed) permits an allowlisted target origin with an all-writable config', () => {
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '999999', readOnly: false }],
    webhookTargetAllowlist: ['https://hooks.example/approved-path'],
  });

  assert.doesNotThrow(() =>
    client.assertAllowed({
      method: 'POST',
      path: '/webhooks',
      body: {
        data: {
          resource: '1201234567890',
          target: 'https://hooks.example/callback',
        },
      },
    }),
  );
});

test('dry-run (assertAllowed) permits an unlisted target with explicit opt-in and an all-writable config', () => {
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '999999', readOnly: false }],
    webhookTargetAllowlist: [],
    allowUnlistedWebhookTarget: true,
  });

  assert.doesNotThrow(() =>
    client.assertAllowed({
      method: 'POST',
      path: '/webhooks',
      body: {
        data: {
          resource: '1201234567890',
          target: 'https://attacker.example/hook',
        },
      },
    }),
  );
});

test('webhook creation permits an unlisted target with explicit opt-in and an all-writable config', async () => {
  let calls = 0;
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '999999', readOnly: false }],
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

test('story mutation resolves through the live-shaped target field (no task/project keys) and succeeds in a writable workspace', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '1111111111111111', readOnly: false },
      { gid: '2222222222222222', readOnly: true },
    ],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(method);
      if (method !== 'GET') return Response.json({ data: { gid: 'sto-1' } });
      if (url.includes('/stories/')) {
        return Response.json({
          data: {
            gid: 'sto-1',
            target: { gid: 'task-1', resource_type: 'task' },
          },
        });
      }
      return Response.json({
        data: { workspace: { gid: '1111111111111111' } },
      });
    },
  });

  const result = await client.request({
    method: 'PUT',
    path: '/stories/sto-1',
    workspaceLookupPath: '/stories/sto-1',
    body: { data: { text: 'x' } },
  });

  assert.deepEqual(result, { data: { gid: 'sto-1' } });
  assert.deepEqual(calls, ['GET', 'GET', 'PUT']);
});

test('story deletion resolves through the live-shaped target field and succeeds in a writable workspace', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '1111111111111111', readOnly: false },
      { gid: '2222222222222222', readOnly: true },
    ],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(method);
      if (method !== 'GET') return Response.json({ data: {} });
      if (url.includes('/stories/')) {
        return Response.json({
          data: {
            gid: 'sto-1',
            target: { gid: 'task-1', resource_type: 'task' },
          },
        });
      }
      return Response.json({
        data: { workspace: { gid: '1111111111111111' } },
      });
    },
  });

  await client.request({
    method: 'DELETE',
    path: '/stories/sto-1',
    workspaceLookupPath: '/stories/sto-1',
  });

  assert.deepEqual(calls, ['GET', 'GET', 'DELETE']);
});

test('story mutation targeting a read-only workspace via the live-shaped target field is blocked with zero mutating fetches', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '1111111111111111', readOnly: false },
      { gid: '2222222222222222', readOnly: true },
    ],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(method);
      if (method !== 'GET') return Response.json({ data: { gid: 'sto-1' } });
      if (url.includes('/stories/')) {
        return Response.json({
          data: {
            gid: 'sto-1',
            target: { gid: 'task-1', resource_type: 'task' },
          },
        });
      }
      return Response.json({
        data: { workspace: { gid: '2222222222222222' } },
      });
    },
  });

  await assert.rejects(
    client.request({
      method: 'PUT',
      path: '/stories/sto-1',
      workspaceLookupPath: '/stories/sto-1',
      body: { data: { text: 'x' } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(calls, ['GET', 'GET']);
});

test('rate mutation resolves through parent -> project -> workspace and succeeds in a writable workspace', async () => {
  const urls: string[] = [];
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '1111111111111111', readOnly: false },
      { gid: '2222222222222222', readOnly: true },
    ],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(method);
      if (method === 'GET') urls.push(url);
      if (method !== 'GET') return Response.json({ data: { gid: 'rate-1' } });
      if (url.includes('/rates/')) {
        return Response.json({
          data: {
            gid: 'rate-1',
            resource: { gid: 'user-9', resource_type: 'user' },
            parent: { gid: 'proj-1', resource_type: 'project' },
          },
        });
      }
      if (url.includes('/projects/')) {
        return Response.json({
          data: { workspace: { gid: '1111111111111111' } },
        });
      }
      return Response.json({ data: {} });
    },
  });

  const result = await client.request({
    method: 'PUT',
    path: '/rates/rate-1',
    workspaceLookupPath: '/rates/rate-1',
    body: { data: { rate: '100' } },
  });

  assert.deepEqual(result, { data: { gid: 'rate-1' } });
  assert.deepEqual(calls, ['GET', 'GET', 'PUT']);
  assert.ok(!urls.some((url) => url.includes('/tasks/user-9')));
});

test('rate mutation targeting a read-only workspace via parent is blocked with zero mutating fetches', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [
      { gid: '1111111111111111', readOnly: false },
      { gid: '2222222222222222', readOnly: true },
    ],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(method);
      if (method !== 'GET') return Response.json({ data: { gid: 'rate-1' } });
      if (url.includes('/rates/')) {
        return Response.json({
          data: {
            gid: 'rate-1',
            resource: { gid: 'user-9', resource_type: 'user' },
            parent: { gid: 'proj-1', resource_type: 'project' },
          },
        });
      }
      if (url.includes('/projects/')) {
        return Response.json({
          data: { workspace: { gid: '2222222222222222' } },
        });
      }
      return Response.json({ data: {} });
    },
  });

  await assert.rejects(
    client.request({
      method: 'PUT',
      path: '/rates/rate-1',
      workspaceLookupPath: '/rates/rate-1',
      body: { data: { rate: '100' } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_BLOCKED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(calls, ['GET', 'GET']);
});

test('a resource whose declared link is absent from the response exits READONLY_UNRESOLVED with zero mutating fetches', async () => {
  const calls: string[] = [];
  const client = new transportModule.AsanaClient({
    token: 'safe-test-token',
    workspaces: [{ gid: '1111111111111111', readOnly: true }],
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push(method);
      if (method !== 'GET') return Response.json({ data: { gid: 'sto-1' } });
      return Response.json({ data: { gid: 'sto-1' } });
    },
  });

  await assert.rejects(
    client.request({
      method: 'PUT',
      path: '/stories/sto-1',
      workspaceLookupPath: '/stories/sto-1',
      body: { data: { text: 'x' } },
    }),
    (error: unknown) => {
      assert.equal((error as { code: string }).code, 'READONLY_UNRESOLVED');
      assert.equal((error as { exitCode: number }).exitCode, 4);
      return true;
    },
  );
  assert.deepEqual(calls, ['GET']);
});
