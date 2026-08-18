import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { createProgram } from '../../src/main.js';

type Manifest = {
  operations: number;
  commands: Array<{ command: [string, string]; operationId: string }>;
};

const root = resolve(import.meta.dirname, '../..');

test('every vendored OpenAPI operation has an invocable CLI command', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(root, 'gen/manifest.json'), 'utf8'),
  ) as Manifest;
  const program = createProgram();
  const missing: string[] = [];

  for (const entry of manifest.commands) {
    const resource = program.commands.find(
      (command) => command.name() === entry.command[0],
    );
    const operation = resource?.commands.find(
      (command) => command.name() === entry.command[1],
    );
    if (!operation) missing.push(entry.operationId);
  }

  assert.equal(missing.length, 0, `missing operations: ${missing.join(', ')}`);
  assert.equal(manifest.operations, manifest.commands.length);
  console.log(
    `OpenAPI command coverage: ${manifest.operations}/${manifest.operations} operations (100%)`,
  );
});
