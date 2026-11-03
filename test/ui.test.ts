import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

test('local UI serves its page and analyzes uploaded bytes', async () => {
  const child = spawn(process.execPath, [resolve('dist/src/ui-server.js'), '--no-open'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr += chunk; });
  try {
    const url = await new Promise<string>((resolveUrl, reject) => {
      const timer = setTimeout(() => reject(new Error(`UI did not start. ${stderr}`)), 5_000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        const match = /http:\/\/127\.0\.0\.1:\d+/.exec(chunk);
        if (match) {
          clearTimeout(timer);
          resolveUrl(match[0]);
        }
      });
      child.once('exit', code => {
        clearTimeout(timer);
        reject(new Error(`UI exited early with ${code}. ${stderr}`));
      });
    });
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /数独复盘桌/);

    const replay = await readFile(resolve('test/fixtures/synthetic-basic.replay'));
    const response = await fetch(`${url}/api/analyze?name=fixture.replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', Origin: url },
      body: replay,
    });
    assert.equal(response.status, 200);
    const review = await response.json() as { schema: string; sourceName: string; mistakes: unknown[] };
    assert.equal(review.schema, 'sudokupad-replay-review_v1');
    assert.equal(review.sourceName, 'fixture.replay');
    assert.equal(review.mistakes.length, 1);
  } finally {
    child.kill();
  }
});
