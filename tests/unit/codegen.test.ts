import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const generatorModule = await import('../../codegen/generate.js').catch(
  () => ({}),
);

test('generator emits one uniquely invocable command per OpenAPI operation', async () => {
  assert.equal(typeof generatorModule.generateManifest, 'function');
  const specText = await readFile(resolve(root, 'spec/asana_oas.yaml'), 'utf8');
  const manifest = generatorModule.generateManifest(specText) as {
    commands: Array<{
      command: string[];
      operationId: string;
      method: string;
      path: string;
      parameters: Array<{ in: string; name: string; required: boolean }>;
    }>;
  };

  assert.ok(manifest.commands.length > 200);
  assert.equal(
    new Set(manifest.commands.map((entry) => entry.operationId)).size,
    manifest.commands.length,
  );
  assert.equal(
    new Set(manifest.commands.map((entry) => entry.command.join(' '))).size,
    manifest.commands.length,
  );

  const task = manifest.commands.find(
    (entry) => entry.operationId === 'getTask',
  );
  assert.ok(task);
  assert.deepEqual(task.command, ['tasks', 'get-task']);
  assert.deepEqual(
    task.parameters.filter((parameter) => parameter.in === 'path'),
    [{ in: 'path', name: 'task_gid', required: true, type: 'string' }],
  );
});
