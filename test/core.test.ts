import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { decodeActions } from '../src/actions.js';
import { parseReplayFile, queryEvents } from '../src/core.js';
import { ReplayError } from '../src/errors.js';
import { ReplayEngine } from '../src/engine.js';
import { decompressFromBase64Bounded } from '../src/lz-string-compat.js';

const basicFixture = resolve('test/fixtures/synthetic-basic.replay');
const noSolutionFixture = resolve('test/fixtures/synthetic-no-solution.replay');

test('parses and deterministically replays the public synthetic fixture', async () => {
  const result = await parseReplayFile(basicFixture);
  assert.equal(result.actions.length, 15);
  assert.equal(result.durationMs, 800);
  assert.equal(result.metadata.format, 'replay_v1.0');
  assert.equal(result.metadata.compression, 'clzw');
  assert.ok(result.warnings.some(warning => warning.code === 'UNTESTED_APP_VERSION'));
  assert.equal(result.finalState.r1c1.value, '1');
  assert.equal(result.finalState.r1c3.value, '3');
  assert.deepEqual(result.finalState.r1c2.candidates, []);
  assert.deepEqual(result.finalState.r1c2.pencilmarks, ['3']);
  assert.deepEqual(result.events[7].undoes, [7]);
  assert.deepEqual(result.events[8].redoes, [7]);
  assert.deepEqual(result.events[12].undoes, [12]);
  assert.deepEqual(result.events[11].solutionMismatches, [{ cell: 'r1c3', value: '9', solution: '3' }]);
});

test('event queries hide pure selection by default and paginate', async () => {
  const result = await parseReplayFile(basicFixture);
  const firstPage = queryEvents(result, { limit: 2 });
  assert.equal(firstPage.total, 9);
  assert.equal(firstPage.events.length, 2);
  assert.equal(firstPage.hasMore, true);
  assert.ok(firstPage.events.every(event => !['hl', 'sl', 'ds'].includes(event.shortType)));
  assert.equal(queryEvents(result, { includeSelection: true }).total, 15);
  assert.deepEqual(queryEvents(result, { solutionMismatchOnly: true }).events.map(event => event.index), [12]);
});

test('warns rather than failing when a solution is absent', async () => {
  const result = await parseReplayFile(noSolutionFixture);
  assert.equal(result.solution, undefined);
  assert.ok(result.warnings.some(warning => warning.code === 'MISSING_SOLUTION'));
});

test('unknown action codes fail explicitly and preserve diagnostics', () => {
  assert.throws(
    () => decodeActions('Qx_1', 4, 4, '0.612.0'),
    (error: unknown) => error instanceof ReplayError
      && error.code === 'UNSUPPORTED_ACTION'
      && error.details?.code === 'Q'
      && error.details?.raw === 'Qx_1'
      && error.details?.reliableThroughAction === 0,
  );
});

test('covers colours, pen data, grouping, wait, undo, and redo', () => {
  const stream = 'I0_1E1_1Kx_1L2_1J_1I1_1M_1B2_1N_1G_1H_1P_1';
  const actions = decodeActions(stream, 4, 4, '0.612.0');
  const engine = new ReplayEngine({}, 4, 4);
  const events = actions.map(action => engine.step(action));
  assert.deepEqual(engine.exportState().r1c1.colours, ['1']);
  assert.deepEqual(engine.exportState().r1c1.pen, ['x']);
  assert.equal(engine.exportState().r1c2.value, '2');
  assert.deepEqual(events[9].undoes, [9, 8, 7]);
  assert.deepEqual(events[10].redoes, [7, 8, 9]);
  assert.equal(events[11].shortType, 'wt');
});

test('uses the observed legacy action table only for its version range', () => {
  assert.equal(decodeActions('Fmark_1', 4, 4, '0.80.0')[0].shortType, 'pe');
  assert.equal(decodeActions('F2_1', 4, 4, '0.612.0')[0].shortType, 'cl');
});

test('bounded decompression refuses oversized output', () => {
  const encoded = 'N4IgzglgXgpiBcAWANCALhNAbO8QGUBPAOzQAsYMBjAAgCcYAHLAQ0JoDMIAPNAVwYhULPuQD2dBOD4ATMQGs+jFjIC0DZm1VoxYrGCEg6fHGEpSipCtRpoYYNDRks0LAHSGA5nQgyEAbX9gAF9kELDQkIBdZCDI+IiYuIiU6NjwjPiomPA9UQgxYgCARmQAJmQAZmQUapRSiorS2pqq8uRiqOCgA===';
  assert.throws(
    () => decompressFromBase64Bounded(encoded, 10),
    (error: unknown) => error instanceof ReplayError && error.code === 'DECOMPRESSED_LIMIT',
  );
});

test('rejects directories and unsupported containers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sudokupad-replay-test-'));
  await assert.rejects(() => parseReplayFile(directory), (error: unknown) => error instanceof ReplayError && error.code === 'NOT_A_FILE');
  const invalid = join(directory, 'invalid.replay');
  await writeFile(invalid, JSON.stringify({ format: 'replay_v2.0' }), 'utf8');
  await assert.rejects(() => parseReplayFile(invalid), (error: unknown) => error instanceof ReplayError && error.code === 'UNSUPPORTED_FORMAT');
});
