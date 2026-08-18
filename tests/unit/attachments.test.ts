import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { createProgram, run } from '../../src/main.js';
import { uploadAttachment } from '../../src/attachments.js';
import { CliError } from '../../src/errors.js';
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
      allowOutsideCwd: true,
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

test('attachment upload refuses a protected file before issuing a request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-protected-upload-'));
  const config = join(directory, 'config.json');
  await writeFile(config, JSON.stringify({ token: '1/777:UPLOADLEAK' }), {
    mode: 0o600,
  });
  let requests = 0;
  try {
    await assert.rejects(
      uploadAttachment({
        client: {
          request: async () => {
            requests += 1;
            return {};
          },
        },
        parent: 'task-1',
        file: config,
        protectedPaths: [config],
      }),
      (error: unknown) => error instanceof CliError && error.code === 'USAGE',
    );
    assert.equal(requests, 0);
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

test('attachment download rejects insecure metadata URLs before fetching', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-download-'));
  const destination = join(directory, 'download.bin');
  let fetchCalls = 0;
  const client = {
    request: async () => ({
      data: {
        gid: 'attachment-private',
        name: 'private.bin',
        download_url: 'http://169.254.169.254/latest/meta-data/',
      },
    }),
  };

  try {
    await assert.rejects(
      attachmentsModule.downloadAttachment({
        client,
        gid: 'attachment-private',
        out: destination,
        destDir: directory,
        fetch: async () => {
          fetchCalls += 1;
          return new Response('secret');
        },
      }),
      /HTTPS/,
    );
    assert.equal(fetchCalls, 0);
    await assert.rejects(readFile(destination), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('attachment download rejects hostnames that resolve to loopback', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-download-'));
  let fetchCalls = 0;
  const client = {
    request: async () => ({
      data: {
        gid: 'attachment-loopback',
        name: 'loopback.bin',
        download_url: 'https://localhost.test/source.bin',
      },
    }),
  };

  try {
    await assert.rejects(
      attachmentsModule.downloadAttachment({
        client,
        gid: 'attachment-loopback',
        out: 'download.bin',
        destDir: directory,
        lookup: async () => [{ address: '127.0.0.1', family: 4 }],
        fetch: async () => {
          fetchCalls += 1;
          return new Response('secret');
        },
      }),
      /private or reserved/,
    );
    assert.equal(fetchCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('attachment download rejects IPv4-mapped loopback addresses', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-download-'));
  let fetchCalls = 0;
  const client = {
    request: async () => ({
      data: {
        gid: 'attachment-mapped-loopback',
        name: 'loopback.bin',
        download_url: 'https://[::ffff:127.0.0.1]/source.bin',
      },
    }),
  };

  try {
    await assert.rejects(
      attachmentsModule.downloadAttachment({
        client,
        gid: 'attachment-mapped-loopback',
        out: 'download.bin',
        destDir: directory,
        fetch: async () => {
          fetchCalls += 1;
          return new Response('secret');
        },
      }),
      /private or reserved/,
    );
    assert.equal(fetchCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('attachment download validates every redirect before following it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-download-'));
  const fetched: string[] = [];
  const client = {
    request: async () => ({
      data: {
        gid: 'attachment-redirect',
        name: 'redirect.bin',
        download_url: 'https://public.example.test/source.bin',
      },
    }),
  };

  try {
    await assert.rejects(
      attachmentsModule.downloadAttachment({
        client,
        gid: 'attachment-redirect',
        out: 'download.bin',
        destDir: directory,
        lookup: async () => [{ address: '93.184.216.34', family: 4 }],
        fetch: async (input: URL, init: RequestInit) => {
          fetched.push(input.toString());
          assert.equal(init.redirect, 'manual');
          return new Response(null, {
            status: 302,
            headers: { location: 'https://127.0.0.1/admin' },
          });
        },
      }),
      /private or reserved/,
    );
    assert.deepEqual(fetched, ['https://public.example.test/source.bin']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('attachment download confines traversal paths to the destination root', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-download-'));
  const root = join(directory, 'safe', 'nested');
  const escaped = join(directory, 'escape.txt');
  await mkdir(root, { recursive: true });
  const client = {
    request: async () => ({
      data: {
        gid: 'attachment-traversal',
        name: 'escape.txt',
        download_url: 'https://public.example.test/source.bin',
      },
    }),
  };

  try {
    await assert.rejects(
      attachmentsModule.downloadAttachment({
        client,
        gid: 'attachment-traversal',
        out: join(root, '..', '..', 'escape.txt'),
        destDir: root,
        lookup: async () => [{ address: '93.184.216.34', family: 4 }],
        fetch: async () => new Response('attacker bytes'),
      }),
      /outside destination directory/,
    );
    await assert.rejects(readFile(escaped), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('attachment download CLI exits non-zero before an escaped output is created', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-download-cli-'));
  const root = join(directory, 'safe', 'nested');
  const escaped = join(directory, 'escape.txt');
  await mkdir(root, { recursive: true });

  try {
    const exitCode = await run([
      'node',
      'asn',
      '--token',
      'test-token',
      '--config',
      join(directory, 'missing-config.json'),
      'attachments',
      'download',
      'attachment-traversal',
      '--dest-dir',
      root,
      '--out',
      '../../escape.txt',
    ]);
    assert.notEqual(exitCode, 0);
    await assert.rejects(readFile(escaped), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('attachment download rejects symlinks without clobbering their targets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-download-'));
  const victim = join(directory, 'important.conf');
  const destination = join(directory, 'download.bin');
  await writeFile(victim, 'ORIGINAL-CONTENT');
  await symlink(victim, destination);
  const client = {
    request: async () => ({
      data: {
        gid: 'attachment-symlink',
        name: 'source.bin',
        download_url: 'https://public.example.test/source.bin',
      },
    }),
  };

  try {
    await assert.rejects(
      attachmentsModule.downloadAttachment({
        client,
        gid: 'attachment-symlink',
        out: destination,
        destDir: directory,
        lookup: async () => [{ address: '93.184.216.34', family: 4 }],
        fetch: async () => new Response('attacker bytes'),
      }),
      /symbolic link|already exists/,
    );
    assert.equal(await readFile(victim, 'utf8'), 'ORIGINAL-CONTENT');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('attachment download removes partial files when the size limit is exceeded', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-download-'));
  const destination = join(directory, 'download.bin');
  const client = {
    request: async () => ({
      data: {
        gid: 'attachment-large',
        name: 'large.bin',
        download_url: 'https://public.example.test/source.bin',
      },
    }),
  };

  try {
    await assert.rejects(
      attachmentsModule.downloadAttachment({
        client,
        gid: 'attachment-large',
        out: destination,
        destDir: directory,
        maxBytes: 10,
        lookup: async () => [{ address: '93.184.216.34', family: 4 }],
        fetch: async () => new Response('eleven bytes'),
      }),
      /exceeds maximum size of 10 bytes/,
    );
    await assert.rejects(readFile(destination), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
      destDir: directory,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      fetch: async (_input: unknown, init: RequestInit) => {
        downloadInit = init;
        return new Response('downloaded-bytes');
      },
    });
    assert.deepEqual(result, {
      gid: 'attachment-2',
      name: 'source.bin',
      path: join(await realpath(directory), 'download.bin'),
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

test('attachment deletion requires server-side workspace resolution', () => {
  assert.equal(typeof attachmentsModule.attachmentDeleteRequest, 'function');
  assert.deepEqual(
    attachmentsModule.attachmentDeleteRequest('12345', '999999'),
    {
      method: 'DELETE',
      path: '/attachments/12345',
      workspaceGids: ['999999'],
      workspaceLookupPath: '/attachments/12345',
    },
  );
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
  const download = attachments.commands.find(
    (command) => command.name() === 'download',
  );
  assert.deepEqual(download?.options.map((option) => option.long).sort(), [
    '--dest-dir',
    '--force',
    '--max-bytes',
    '--out',
  ]);
});
