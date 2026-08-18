import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createProgram } from '../../src/main.js';

const root = resolve(import.meta.dirname, '../..');

test('generated required query parameters are mandatory CLI flags', () => {
  const accessRequests = createProgram().commands.find(
    (command) => command.name() === 'access-requests',
  );
  const list = accessRequests?.commands.find(
    (command) => command.name() === 'get-access-requests',
  );
  assert.equal(
    list?.options.find((option) => option.long === '--target')?.mandatory,
    true,
  );
});

test('generated command maps positional path and query flags to a request', () => {
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'src/main.ts',
      '--dry-run',
      '--config',
      join(tmpdir(), 'asn-generated-cli-no-config.json'),
      'tasks',
      'get-task',
      '123',
      '--opt-fields',
      'name,completed',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ASANA_PAT: 'safe-generated-test-token' },
    },
  );

  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    method: 'GET',
    url: 'https://app.asana.com/api/1.0/tasks/123?opt_fields=name%2Ccompleted',
    headers: { Authorization: 'Bearer ***' },
  });
});

test('generated mutation maps repeated fields to an Asana JSON body', () => {
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'src/main.ts',
      '--dry-run',
      '--config',
      join(tmpdir(), 'asn-generated-cli-no-config.json'),
      'tasks',
      'create-task',
      '--field',
      'name=Hello',
      '--field',
      'completed=true',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ASANA_PAT: 'safe-generated-test-token' },
    },
  );

  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    method: 'POST',
    url: 'https://app.asana.com/api/1.0/tasks',
    headers: {
      Authorization: 'Bearer ***',
      'Content-Type': 'application/json',
    },
    body: { data: { name: 'Hello', completed: true } },
  });
});

test('generated mutation reads --body-json from an @file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-body-json-'));
  const bodyPath = join(directory, 'body.json');
  await writeFile(bodyPath, JSON.stringify({ data: { name: 'From file' } }));
  try {
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
        `@${bodyPath}`,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ASANA_PAT: 'safe-generated-test-token' },
      },
    );
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout).body, {
      data: { name: 'From file' },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('generated mutation reads --body-json from stdin', () => {
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
      '-',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: JSON.stringify({ data: { name: 'From stdin' } }),
      env: { ...process.env, ASANA_PAT: 'safe-generated-test-token' },
    },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).body, {
    data: { name: 'From stdin' },
  });
});

test('generated mutation is blocked for a configured read-only workspace', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asn-readonly-generated-'));
  const config = join(directory, 'config.json');
  await writeFile(
    config,
    JSON.stringify({ workspaces: [{ gid: '100', readOnly: true }] }),
  );
  try {
    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/main.ts',
        '--dry-run',
        '--workspace',
        '100',
        '--config',
        config,
        'tasks',
        'create-task',
        '--field',
        'name=Blocked',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ASANA_PAT: 'safe-generated-test-token' },
      },
    );
    assert.equal(run.status, 4, run.stderr);
    assert.equal(run.stdout, '');
    assert.equal(JSON.parse(run.stderr).error.code, 'READONLY_BLOCKED');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
