import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { createProgram } from '../../src/main.js';
import { test } from 'node:test';

const attachmentsModule = await import('../../src/attachments.js').catch(
  () => ({}),
);

test('attachment upload streams a real file as asserted multipart form data', async () => {
  assert.equal(typeof attachmentsModule.uploadAttachment, 'function');
  const directory = await mkdtemp(join(tmpdir(), 'asn-attachment-'));
  const file = join(directory, 'evidence.bin');
  const bytes = Buffer.alloc(2 * 1024 * 1024, 0x5a);
  await writeFile(file, bytes);
  let captured: {
    method?: string;
    path?: string;
    workspaceGid?: string;
    headers?: Record<string, string>;
    body?: AsyncIterable<Uint8Array>;
  } = {};
  const client = {
    request: async (request: unknown) => {
      captured = request;
      return { data: { gid: 'attachment-1' } };
    },
  };

  try {
    const result = await attachmentsModule.uploadAttachment({
      client,
      parent: 'task-1',
      file,
      name: 'Agent evidence',
      workspaceGid: 'workspace-1',
    });
    assert.deepEqual(result, { data: { gid: 'attachment-1' } });
    assert.equal(captured.method, 'POST');
    assert.equal(captured.path, '/attachments');
    assert.equal(captured.workspaceGid, 'workspace-1');
    assert.match(
      captured.headers['Content-Type'],
      /^multipart\/form-data; boundary=/,
    );

    const chunks: Buffer[] = [];
    for await (const chunk of captured.body) chunks.push(Buffer.from(chunk));
    assert.ok(chunks.length > 3, 'file should be streamed in multiple chunks');
    const multipart = Buffer.concat(chunks);
    const text = multipart.toString('latin1');
    assert.match(text, /name="parent"\r\n\r\ntask-1/);
    assert.match(text, /name="name"\r\n\r\nAgent evidence/);
    assert.match(text, new RegExp(`filename="${basename(file)}"`));
    assert.equal(multipart.includes(bytes), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('attachment upload streams file content from stdin', async () => {
  let multipart = Buffer.alloc(0);
  const client = {
    request: async (request: { body: AsyncIterable<Uint8Array> }) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request.body) chunks.push(Buffer.from(chunk));
      multipart = Buffer.concat(chunks);
      return { data: { gid: 'attachment-stdin' } };
    },
  };

  await attachmentsModule.uploadAttachment({
    client,
    parent: 'task-stdin',
    file: '-',
    name: 'stdin.txt',
    stdin: Readable.from(['streamed-from-stdin']),
  });

  const text = multipart.toString('utf8');
  assert.match(text, /filename="stdin.txt"/);
  assert.match(text, /streamed-from-stdin/);
});

test('attachment download streams signed content without an authorization header', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-download-'));
  const destination = join(directory, 'download.bin');
  let downloadInit: RequestInit | undefined;
  const client = {
    request: async () => ({
      data: {
        gid: 'attachment-2',
        name: 'source.bin',
        download_url: 'https://signed.example.test/source.bin',
      },
    }),
  };
  try {
    const result = await attachmentsModule.downloadAttachment({
      client,
      gid: 'attachment-2',
      out: destination,
      fetch: async (_input: unknown, init: RequestInit) => {
        downloadInit = init;
        return new Response('downloaded-bytes');
      },
    });
    assert.deepEqual(result, {
      gid: 'attachment-2',
      name: 'source.bin',
      path: destination,
      bytes: 16,
    });
    assert.equal(await readFile(destination, 'utf8'), 'downloaded-bytes');
    assert.equal(
      new Headers(downloadInit?.headers).has('authorization'),
      false,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('attachments expose create, download, and delete convenience commands', () => {
  const program = createProgram();
  const attachments = program.commands.find(
    (command) => command.name() === 'attachments',
  );
  assert.ok(attachments);
  for (const name of ['create', 'download', 'delete']) {
    assert.ok(
      attachments.commands.find((command) => command.name() === name),
      `missing attachments ${name}`,
    );
  }
  const create = attachments.commands.find(
    (command) => command.name() === 'create',
  );
  assert.deepEqual(
    create?.options
      .filter((option) => option.mandatory)
      .map((option) => option.long)
      .sort(),
    ['--file', '--parent'],
  );
});
