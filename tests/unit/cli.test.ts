import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');

test('auth login stores a PAT without echoing it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-auth-'));
  const config = join(directory, 'config.json');
  const token = 'pat-sensitive-login-value';
  try {
    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        'auth',
        'login',
        '--token',
        token,
        '--config',
        config,
      ],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(run.status, 0, run.stderr);
    assert.equal(`${run.stdout}${run.stderr}`.includes(token), false);
    const stored = JSON.parse(await readFile(config, 'utf8')) as {
      token: string;
    };
    assert.equal(stored.token, token);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('help works with a PAT and advertises workspace listing', () => {
  const run = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/main.ts', '--help'],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ASANA_PAT: 'safe-test-token' },
    },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /workspace/);
  assert.equal(run.stdout.includes('safe-test-token'), false);
});

test('help does not advertise an unimplemented verbose flag', () => {
  const run = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/main.ts', '--help'],
    { cwd: root, encoding: 'utf8' },
  );

  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.includes('--verbose'), false);
});

test('help advertises explicit opt-in for unlisted webhook targets', () => {
  const run = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/main.ts', '--help'],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /--allow-unlisted-webhook-target/);
});

test('workspace dry-run prints a redacted request and exits zero', () => {
  const token = 'pat-sensitive-dry-run';
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'src/main.ts',
      'workspace',
      'list',
      '--dry-run',
      '--opt-fields',
      'name',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ASANA_PAT: token },
    },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.equal(`${run.stdout}${run.stderr}`.includes(token), false);
  assert.deepEqual(JSON.parse(run.stdout), {
    method: 'GET',
    url: 'https://app.asana.com/api/1.0/workspaces?opt_fields=name',
    headers: { Authorization: 'Bearer ***' },
  });
});

test('missing PAT writes the stable error envelope to stderr', () => {
  const environment = { ...process.env };
  delete environment.ASANA_PAT;
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'src/main.ts',
      'workspace',
      'list',
      '--dry-run',
      '--config',
      join(tmpdir(), 'asn-missing-config-for-test.json'),
    ],
    { cwd: root, encoding: 'utf8', env: environment },
  );
  assert.equal(run.status, 3);
  assert.equal(run.stdout, '');
  assert.deepEqual(JSON.parse(run.stderr), {
    error: {
      code: 'AUTH',
      message: 'no Personal Access Token configured',
      details: null,
    },
  });
});

test('errors redact a token passed with the equals flag form', () => {
  const token = '1/777:LEAKME-EQUALS';
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'src/main.ts',
      'tasks',
      'create-task',
      `--token=${token}`,
      '--field',
      token,
      '--dry-run',
    ],
    { cwd: root, encoding: 'utf8' },
  );

  assert.equal(run.status, 2);
  assert.equal(run.stderr.includes(token), false);
  assert.match(run.stderr, /invalid --field: \*\*\*/);
});

test('errors redact the resolved token read from config', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-redact-config-'));
  const config = join(directory, 'config.json');
  const token = '1/777:LEAKME-CONFIG';
  const environment = { ...process.env };
  delete environment.ASANA_PAT;
  try {
    await writeFile(config, JSON.stringify({ token }));
    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        'tasks',
        'create-task',
        '--config',
        config,
        '--field',
        token,
        '--dry-run',
      ],
      { cwd: root, encoding: 'utf8', env: environment },
    );

    assert.equal(run.status, 2);
    assert.equal(run.stderr.includes(token), false);
    assert.match(run.stderr, /invalid --field: \*\*\*/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('config rejects a workspace missing readOnly before dispatch', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-config-validation-'));
  const config = join(directory, 'config.json');
  const environment = { ...process.env };
  delete environment.ASANA_PAT;
  try {
    await writeFile(
      config,
      JSON.stringify({
        token: 'safe-config-token',
        workspaces: [{ gid: '111111', name: 'prod' }],
      }),
    );
    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        'tasks',
        'create-task',
        '--config',
        config,
        '--dry-run',
        '--field',
        'workspace=111111',
      ],
      { cwd: root, encoding: 'utf8', env: environment },
    );

    assert.equal(run.status, 2);
    assert.equal(run.stdout, '');
    assert.deepEqual(JSON.parse(run.stderr), {
      error: {
        code: 'USAGE',
        message: 'config workspaces[0].readOnly is required',
        details: null,
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI entrypoint executes when invoked through an npm-style symlink', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-bin-link-'));
  const bin = join(directory, 'asn');
  await symlink(resolve(root, 'src/main.ts'), bin);
  try {
    const run = spawnSync(
      process.execPath,
      ['--import', 'tsx', bin, '--version'],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), '0.1.4');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
