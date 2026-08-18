import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const syncModule = await import('../../scripts/sync-spec.js').catch(() => ({}));

test('spec sync refreshes from a pinned upstream commit and checksum', async () => {
  assert.equal(typeof syncModule.syncSpec, 'function');
  const directory = await mkdtemp(join(tmpdir(), 'asn-sync-spec-'));
  const commit = 'a'.repeat(40);
  const spec = 'openapi: 3.0.0\npaths: {}\n';
  const urls: string[] = [];
  const fetch = async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/commits?')) return Response.json([{ sha: commit }]);
    return new Response(spec);
  };

  try {
    const result = await syncModule.syncSpec({ root: directory, fetch });
    assert.equal(result.commit, commit);
    assert.equal(
      await readFile(join(directory, 'spec/asana_oas.yaml'), 'utf8'),
      spec,
    );
    const pin = JSON.parse(
      await readFile(join(directory, 'spec/SPEC_SHA'), 'utf8'),
    );
    assert.deepEqual(pin, {
      commit,
      sha256: createHash('sha256').update(spec).digest('hex'),
      source: `https://raw.githubusercontent.com/Asana/openapi/${commit}/defs/asana_oas.yaml`,
    });
    assert.equal(urls.length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
