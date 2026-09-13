import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

test('CLI inspect returns machine-readable JSON', () => {
  const result = spawnSync(process.execPath, [resolve('dist/src/cli.js'), 'inspect', resolve('test/fixtures/synthetic-basic.replay')], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as { actionCount: number; metadata: { format: string } };
  assert.equal(output.actionCount, 15);
  assert.equal(output.metadata.format, 'replay_v1.0');
});
