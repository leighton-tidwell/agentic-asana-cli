import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { CliError } from '../../src/errors.js';
import { assertSafeLocalFile } from '../../src/file-access.js';

const root = resolve(import.meta.dirname, '../..');

async function withDirectory(
  prefix: string,
  callback: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('--token=VALUE is redacted from error output', () => {
  const token = '1/777:LEAKME';
  const environment = { ...process.env };
  delete environment.ASANA_PAT;
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'src/main.ts',
      `--token=${token}`,
      '--config',
      join(tmpdir(), 'asn-no-config-token-equals.json'),
      'tasks',
      'create-task',
      '--field',
      token,
    ],
    { cwd: root, encoding: 'utf8', env: environment },
  );

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr.includes('LEAKME'), false);
  assert.match(run.stderr, /\*\*\*/);
});

test('config-file token is redacted from error output', async () => {
  await withDirectory('asn-config-redaction-', async (directory) => {
    const config = join(directory, 'config.json');
    const token = '1/777:CONFIGERRORLEAK';
    await writeFile(config, JSON.stringify({ token }), { mode: 0o600 });
    const environment = { ...process.env };
    delete environment.ASANA_PAT;

    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--config',
        config,
        'tasks',
        'create-task',
        '--field',
        token,
      ],
      { cwd: root, encoding: 'utf8', env: environment },
    );

    assert.equal(run.status, 2);
    assert.equal(run.stdout, '');
    assert.equal(run.stderr.includes('CONFIGERRORLEAK'), false);
    assert.match(run.stderr, /\*\*\*/);
  });
});

test('attachment dry-run redacts known secrets from its body', async () => {
  await withDirectory('asn-attachment-dry-redaction-', async (directory) => {
    const config = join(directory, 'config.json');
    const token = '1/777:ATTACHMENTDRYLEAK';
    await writeFile(config, JSON.stringify({ token }));
    const environment = { ...process.env };
    delete environment.ASANA_PAT;

    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--config',
        config,
        '--dry-run',
        'attachments',
        'create',
        '--parent',
        '123',
        '--file',
        '-',
        '--name',
        token,
      ],
      { cwd: root, encoding: 'utf8', env: environment },
    );

    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.includes('ATTACHMENTDRYLEAK'), false);
    assert.equal(JSON.parse(run.stdout).body.name, '***');
  });
});

test('dry-run redacts known secrets from the request body', async () => {
  await withDirectory('asn-dry-run-redaction-', async (directory) => {
    const config = join(directory, 'config.json');
    const token = '1/777:DRYRUNLEAK';
    await writeFile(config, JSON.stringify({ token }));
    const environment = { ...process.env };
    delete environment.ASANA_PAT;

    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--config',
        config,
        '--dry-run',
        'tasks',
        'create-task',
        '--body-json',
        JSON.stringify({ data: { name: token } }),
      ],
      { cwd: root, encoding: 'utf8', env: environment },
    );

    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stderr, '');
    assert.equal(run.stdout.includes('DRYRUNLEAK'), false);
    assert.equal(JSON.parse(run.stdout).body.data.name, '***');
  });
});

test('sensitive files stay blocked with outside-CWD opt-in', async () => {
  await withDirectory('asn-sensitive-', async (directory) => {
    const home = join(directory, 'home');
    const cwd = join(directory, 'cwd');
    const paths = [
      join(home, '.ssh', 'id_test'),
      join(home, '.aws', 'credentials'),
      join(home, '.config', 'tool', 'config.json'),
      join(directory, 'other', '.env.production'),
      join(directory, 'other', 'mode-600.txt'),
    ];
    await mkdir(cwd, { recursive: true });
    for (const path of paths) {
      await mkdir(resolve(path, '..'), { recursive: true });
      await writeFile(path, 'secret', {
        mode: path.endsWith('mode-600.txt') ? 0o600 : 0o644,
      });
    }

    for (const path of paths) {
      await assert.rejects(
        assertSafeLocalFile(path, {
          cwd,
          home,
          allowOutsideCwd: true,
        }),
        (error: unknown) => error instanceof CliError && error.code === 'USAGE',
        path,
      );
    }
  });
});

test('body-json outside the working directory requires explicit opt-in', async () => {
  await withDirectory('asn-outside-cwd-', async (directory) => {
    const body = join(directory, 'payload.json');
    await writeFile(body, JSON.stringify({ data: { name: 'outside' } }), {
      mode: 0o644,
    });

    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--dry-run',
        'tasks',
        'create-task',
        '--body-json',
        `@${body}`,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ASANA_PAT: 'safe-test-token' },
      },
    );

    assert.equal(run.status, 2, run.stderr);
    assert.equal(run.stdout, '');
    assert.equal(JSON.parse(run.stderr).error.code, 'USAGE');
  });
});

test('body-json refuses the resolved workspace cache file', async () => {
  const directory = await mkdtemp(join(root, '.asn-cache-test-'));
  try {
    const config = join(directory, 'config.json');
    const cache = join(directory, 'asn', 'workspaces.json');
    await mkdir(resolve(cache, '..'), { recursive: true });
    await writeFile(config, JSON.stringify({ token: 'safe-cache-test-token' }));
    await writeFile(cache, JSON.stringify({ data: { name: 'cached' } }), {
      mode: 0o644,
    });
    const environment = {
      ...process.env,
      XDG_CACHE_HOME: directory,
    };
    delete environment.ASANA_PAT;

    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--config',
        config,
        '--dry-run',
        'tasks',
        'create-task',
        '--body-json',
        `@${cache}`,
      ],
      { cwd: root, encoding: 'utf8', env: environment },
    );

    assert.equal(run.status, 2, run.stderr);
    assert.equal(run.stdout, '');
    assert.equal(JSON.parse(run.stderr).error.code, 'USAGE');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('allow-outside-cwd permits a normal outside payload', async () => {
  await withDirectory('asn-allowed-outside-', async (directory) => {
    const body = join(directory, 'payload.json');
    await writeFile(body, JSON.stringify({ data: { name: 'allowed' } }), {
      mode: 0o644,
    });
    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--allow-outside-cwd',
        '--dry-run',
        'tasks',
        'create-task',
        '--body-json',
        `@${body}`,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ASANA_PAT: 'safe-test-token' },
      },
    );

    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout).body.data.name, 'allowed');
  });
});

test('attachment create refuses the active config before any request', async () => {
  await withDirectory('asn-attachment-config-', async (directory) => {
    const config = join(directory, 'config.json');
    const token = '1/777:ATTACHMENTCONFIGLEAK';
    await writeFile(config, JSON.stringify({ token }), { mode: 0o600 });
    const environment = { ...process.env };
    delete environment.ASANA_PAT;

    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--config',
        config,
        'attachments',
        'create',
        '--parent',
        '123',
        '--file',
        config,
      ],
      { cwd: root, encoding: 'utf8', env: environment },
    );

    assert.equal(run.status, 2, run.stderr);
    assert.equal(run.stdout, '');
    assert.equal(run.stderr.includes(token), false);
    assert.equal(JSON.parse(run.stderr).error.code, 'USAGE');
  });
});

test('protected path comparison resolves symlink aliases', async () => {
  const directory = await mkdtemp(join(root, '.asn-canonical-test-'));
  try {
    const config = join(directory, 'config.json');
    const alias = join(directory, 'payload-alias.json');
    const token = '1/777:CANONICALLEAK';
    await writeFile(config, JSON.stringify({ token }), { mode: 0o644 });
    await symlink(config, alias);
    const environment = { ...process.env };
    delete environment.ASANA_PAT;

    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--config',
        config,
        '--dry-run',
        'tasks',
        'create-task',
        '--body-json',
        `@${alias}`,
      ],
      { cwd: root, encoding: 'utf8', env: environment },
    );

    assert.equal(run.status, 2, run.stderr);
    assert.equal(run.stdout, '');
    assert.equal(run.stderr.includes(token), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('body-json refuses the active config file without exposing its token', async () => {
  await withDirectory('asn-config-body-', async (directory) => {
    const config = join(directory, 'config.json');
    const token = '1/777:CONFIGLEAK';
    await writeFile(
      config,
      JSON.stringify({
        token,
        workspaces: [{ gid: '123', readOnly: false }],
      }),
      { mode: 0o600 },
    );

    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--config',
        config,
        '--dry-run',
        '--guard-workspace',
        '123',
        'tasks',
        'create-task',
        '--body-json',
        `@${config}`,
      ],
      { cwd: root, encoding: 'utf8' },
    );

    assert.equal(run.status, 2, run.stderr);
    assert.equal(run.stdout, '');
    assert.equal(`${run.stdout}${run.stderr}`.includes(token), false);
    assert.equal(JSON.parse(run.stderr).error.code, 'USAGE');
  });
});
