import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');

test('vendored Asana OpenAPI spec is pinned by commit and checksum', async () => {
  const spec = await readFile(resolve(root, 'spec/asana_oas.yaml'));
  const pin = JSON.parse(
    await readFile(resolve(root, 'spec/SPEC_SHA'), 'utf8'),
  ) as { commit: string; sha256: string; source: string };

  assert.match(pin.commit, /^[0-9a-f]{40}$/);
  assert.equal(pin.sha256, createHash('sha256').update(spec).digest('hex'));
  assert.equal(
    pin.source,
    `https://raw.githubusercontent.com/Asana/openapi/${pin.commit}/defs/asana_oas.yaml`,
  );
});

test('package exposes spec sync, codegen, and API coverage scripts', async () => {
  const pkg = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string>; files: string[] };
  assert.equal(pkg.scripts['spec:update'], 'tsx scripts/sync-spec.ts');
  assert.equal(pkg.scripts.codegen, 'tsx codegen/generate.ts');
  assert.equal(
    pkg.scripts['test:api-coverage'],
    'node --import tsx --test tests/coverage/openapi-coverage.test.ts',
  );
  assert.ok(pkg.files.includes('gen'));
});
