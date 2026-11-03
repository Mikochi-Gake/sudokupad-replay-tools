import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { parseReplayFile, parseReplayText } from '../src/core.js';
import { buildReview } from '../src/review.js';
import { readFile } from 'node:fs/promises';

const basicFixture = resolve('test/fixtures/synthetic-basic.replay');

test('parses replay text without exposing a server-side path', async () => {
  const text = await readFile(basicFixture, 'utf8');
  const fromText = parseReplayText(text);
  const fromFile = await parseReplayFile(basicFixture);
  assert.deepEqual(fromText, fromFile);
});

test('builds a compact review with original mistakes and rollback links', async () => {
  const analysis = await parseReplayFile(basicFixture);
  const review = buildReview(analysis, false, 'fixture.replay');
  assert.equal(review.sourceName, 'fixture.replay');
  assert.deepEqual(review.mistakes.map(item => item.action), [12]);
  assert.equal(review.mistakes[0].resolution?.action, 13);
  assert.equal(review.mistakes[0].resolution?.via, 'undo');
  assert.ok(review.rollbacks.some(item => item.undoes.includes(12)));
  assert.ok(review.timeline.events.every(event => !['hl', 'sl', 'ds'].includes(event.shortType)));
  assert.equal(review.speedClues.selectionActions, 6);
});
