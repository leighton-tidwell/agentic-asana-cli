import assert from 'node:assert/strict';
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
    resolveToken({ configToken: 'config-token', flagToken: 'flag-token' }),
    'config-token',
  );
  assert.equal(resolveToken({ flagToken: 'flag-token' }), 'flag-token');
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
