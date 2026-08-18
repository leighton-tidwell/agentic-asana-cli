import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const configModule = await import('../../src/config.js').catch(() => ({}));

test('token precedence is environment then config then flag', () => {
  assert.equal(typeof configModule.resolveToken, 'function');
  const resolveToken = configModule.resolveToken as (input: {
    env?: Record<string, string | undefined>;
    configToken?: string;
    flagToken?: string;
  }) => string | undefined;

  assert.equal(
    resolveToken({
      env: { ASANA_PAT: 'env-token' },
      configToken: 'config-token',
      flagToken: 'flag-token',
    }),
    'env-token',
  );
  assert.equal(
    resolveToken({
      env: {},
      configToken: 'config-token',
      flagToken: 'flag-token',
    }),
    'config-token',
  );
  assert.equal(
    resolveToken({ env: {}, flagToken: 'flag-token' }),
    'flag-token',
  );
});

test('redactSecrets removes every occurrence of the active token', () => {
  assert.equal(typeof configModule.redactSecrets, 'function');
  const redactSecrets = configModule.redactSecrets as (
    value: unknown,
    secrets: string[],
  ) => string;
  const token = 'pat-sensitive-value';
  const rendered = redactSecrets(
    new Error(`request failed: Bearer ${token}; url?token=${token}`),
    [token],
  );
  assert.equal(rendered.includes(token), false);
  assert.match(rendered, /\*\*\*/);
});

test('config accepts a webhook target origin allowlist', async () => {
  const root = await mkdtemp(join(tmpdir(), 'asn-config-webhooks-'));
  const path = join(root, 'config.json');
  try {
    await writeFile(
      path,
      JSON.stringify({
        webhookTargetAllowlist: ['https://hooks.example/path'],
      }),
    );

    assert.deepEqual(await configModule.readConfig(path), {
      webhookTargetAllowlist: ['https://hooks.example/path'],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('config rejects a non-array webhook target allowlist', async () => {
  const root = await mkdtemp(join(tmpdir(), 'asn-config-webhooks-invalid-'));
  const path = join(root, 'config.json');
  try {
    await writeFile(
      path,
      JSON.stringify({ webhookTargetAllowlist: 'https://hooks.example' }),
    );

    await assert.rejects(
      configModule.readConfig(path),
      /webhookTargetAllowlist must be an array of strings/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('storeToken restricts an existing config and creates a private parent directory', async () => {
  assert.equal(typeof configModule.storeToken, 'function');
  const root = await mkdtemp(join(tmpdir(), 'asn-config-mode-'));
  const existingPath = join(root, 'config.json');
  const newDirectory = join(root, 'asn');
  const newPath = join(newDirectory, 'config.json');
  try {
    await writeFile(existingPath, '{}', { mode: 0o666 });
    await chmod(existingPath, 0o644);

    await configModule.storeToken(existingPath, 'pat-sensitive-value');
    await configModule.storeToken(newPath, 'pat-sensitive-value');

    assert.equal((await stat(existingPath)).mode & 0o077, 0);
    assert.equal((await stat(newPath)).mode & 0o077, 0);
    assert.equal((await stat(newDirectory)).mode & 0o077, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('storeToken refuses a world-writable parent directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'asn-config-insecure-parent-'));
  const directory = join(root, 'shared');
  try {
    await mkdir(directory);
    await chmod(directory, 0o777);

    await assert.rejects(
      configModule.storeToken(join(directory, 'config.json'), 'token'),
      /insecure directory/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
