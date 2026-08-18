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
