import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReplayFile } from '../src/core.js';

const privateReplay = process.env.SUDOKUPAD_GOLDEN_REPLAY;

test('private 1185-action golden replay stays compatible', { skip: privateReplay ? false : 'Set SUDOKUPAD_GOLDEN_REPLAY to run the private regression test.' }, async () => {
  const result = await parseReplayFile(privateReplay!);
  assert.equal(result.actions.length, 1185);
  assert.equal(result.durationMs, 1_945_650);
  assert.deepEqual(result.counts, { up: 2, sl: 517, ds: 446, vl: 75, cd: 100, pm: 26, cl: 4, ud: 14, rd: 1 });
  assert.equal(result.finalSolutionMismatches.length, 0);
  assert.ok(result.events[363].undoes.includes(356));
  assert.ok(result.events[1052].undoes.includes(1052));
  assert.ok(result.events[1053].undoes.includes(1044));
});
