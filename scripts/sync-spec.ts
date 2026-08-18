#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT_API =
  'https://api.github.com/repos/Asana/openapi/commits?path=defs/asana_oas.yaml&per_page=1';

export interface SyncSpecOptions {
  root: string;
  fetch?: typeof globalThis.fetch;
}

export async function syncSpec(options: SyncSpecOptions): Promise<{
  commit: string;
  sha256: string;
  source: string;
}> {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const commitResponse = await fetchFn(COMMIT_API, {
    headers: { 'User-Agent': 'agentic-asana-cli-spec-sync' },
  });
  if (!commitResponse.ok) {
    throw new Error(
      `GitHub commit lookup returned HTTP ${commitResponse.status}`,
    );
  }
  const commits = (await commitResponse.json()) as Array<{ sha?: string }>;
  const commit = commits[0]?.sha;
  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error('GitHub commit lookup returned no valid SHA');
  }
  const source = `https://raw.githubusercontent.com/Asana/openapi/${commit}/defs/asana_oas.yaml`;
  const specResponse = await fetchFn(source);
  if (!specResponse.ok) {
    throw new Error(`OpenAPI download returned HTTP ${specResponse.status}`);
  }
  const spec = Buffer.from(await specResponse.arrayBuffer());
  const sha256 = createHash('sha256').update(spec).digest('hex');
  const specDirectory = resolve(options.root, 'spec');
  await mkdir(specDirectory, { recursive: true });
  await writeFile(resolve(specDirectory, 'asana_oas.yaml'), spec);
  await writeFile(
    resolve(specDirectory, 'SPEC_SHA'),
    `${JSON.stringify({ commit, sha256, source }, null, 2)}\n`,
  );
  return { commit, sha256, source };
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && thisFile === resolve(process.argv[1])) {
  const root = resolve(dirname(thisFile), '..');
  const pin = await syncSpec({ root });
  process.stdout.write(
    `Updated Asana OpenAPI spec to ${pin.commit} (${pin.sha256}).\n`,
  );
}
