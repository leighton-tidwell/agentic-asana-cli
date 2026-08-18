import assert from 'node:assert/strict';
import { test } from 'node:test';

const outputModule = await import('../../src/output.js').catch(() => ({}));

const envelope = {
  data: [
    { gid: '1', name: 'One' },
    { gid: '2', name: 'Two' },
  ],
  next_page: null,
};

test('output renders json, jsonl, and table formats', () => {
  assert.equal(typeof outputModule.renderOutput, 'function');
  assert.equal(
    outputModule.renderOutput(envelope, 'json'),
    JSON.stringify(envelope),
  );
  assert.equal(
    outputModule.renderOutput(envelope, 'jsonl'),
    '{"gid":"1","name":"One"}\n{"gid":"2","name":"Two"}',
  );
  assert.match(outputModule.renderOutput(envelope, 'table'), /gid\s+name/);
  assert.match(outputModule.renderOutput(envelope, 'table'), /1\s+One/);
});
