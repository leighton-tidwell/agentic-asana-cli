import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');

function run(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/main.ts', ...args],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
}

test('schema and --json-help emit the complete machine-readable catalog', () => {
  const schemaRun = run(['schema']);
  assert.equal(schemaRun.status, 0, schemaRun.stderr);
  const schema = JSON.parse(schemaRun.stdout) as {
    operations: number;
    commands: Array<{
      command: string[];
      parameters: Array<{ type: string; required: boolean }>;
      method: string;
      mutates: boolean;
    }>;
  };
  assert.equal(schema.operations, 249);
  assert.equal(schema.commands.length, 249);
  const createTask = schema.commands.find(
    (entry) => entry.command.join(' ') === 'tasks create-task',
  );
  assert.ok(createTask);
  assert.equal(createTask.method, 'POST');
  assert.equal(createTask.mutates, true);
  assert.ok(
    createTask.parameters.every(
      (parameter) => typeof parameter.type === 'string',
    ),
  );

  const helpRun = run(['--json-help']);
  assert.equal(helpRun.status, 0, helpRun.stderr);
  assert.deepEqual(JSON.parse(helpRun.stdout), schema);
});
