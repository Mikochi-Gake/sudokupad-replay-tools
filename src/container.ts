import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ReplayError } from './errors.js';
import { LIMITS } from './limits.js';
import { decompressFromBase64Bounded } from './lz-string-compat.js';
import type { ReplayMetadata, ReplayWarning } from './types.js';

interface RawReplayContainer {
  format: string;
  puzzle: string;
  replay: {
    puzzleId: string;
    type: string;
    rows: number;
    cols: number;
    version: string;
    data: string;
  };
}

export interface ParsedContainer {
  metadata: ReplayMetadata;
  warnings: ReplayWarning[];
  puzzle: Record<string, unknown>;
  actionStream: string;
}

function assertJsonDepth(root: unknown, maxDepth: number): void {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  while (pending.length > 0) {
    const { value, depth } = pending.pop()!;
    if (depth > maxDepth) {
      throw new ReplayError('INVALID_JSON', 'JSON nesting exceeds the configured limit.', { maxDepth });
    }
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
    }
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReplayError('INVALID_CONTAINER', `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new ReplayError('INVALID_CONTAINER', `${label} must be a string.`);
  return value;
}

function requireDimension(value: unknown, label: string, max: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > max) {
    throw new ReplayError('INVALID_CONTAINER', `${label} must be an integer between 1 and ${max}.`);
  }
  return Number(value);
}

export async function readReplayContainer(filePath: string): Promise<ParsedContainer> {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new ReplayError('FILE_NOT_FOUND', 'A local replay file path is required.');
  }
  const absolutePath = resolve(filePath);
  let fileStat;
  try {
    fileStat = await stat(absolutePath);
  } catch (error) {
    throw new ReplayError('FILE_NOT_FOUND', 'Replay file was not found.', {
      path: absolutePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!fileStat.isFile()) throw new ReplayError('NOT_A_FILE', 'Replay path is not a regular file.');
  if (fileStat.size > LIMITS.maxFileBytes) {
    throw new ReplayError('FILE_TOO_LARGE', 'Replay file exceeds the configured size limit.', {
      bytes: fileStat.size,
      maxBytes: LIMITS.maxFileBytes,
    });
  }

  const text = await readFile(absolutePath, 'utf8');
  let unknownContainer: unknown;
  try {
    unknownContainer = JSON.parse(text);
  } catch (error) {
    throw new ReplayError('INVALID_JSON', 'Replay file is not valid JSON.', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  assertJsonDepth(unknownContainer, LIMITS.maxJsonDepth);

  const outer = requireObject(unknownContainer, 'Replay container');
  const format = requireString(outer.format, 'format');
  if (format !== 'replay_v1.0') {
    throw new ReplayError('UNSUPPORTED_FORMAT', 'Unsupported replay container format.', { format });
  }
  const puzzleEncoded = requireString(outer.puzzle, 'puzzle');
  if (!puzzleEncoded.startsWith('fpuz')) {
    throw new ReplayError('INVALID_PUZZLE', 'Embedded puzzle does not use the expected fpuz encoding.');
  }
  const rawReplay = requireObject(outer.replay, 'replay');
  const compression = requireString(rawReplay.type, 'replay.type');
  if (compression !== 'clzw') {
    throw new ReplayError('UNSUPPORTED_COMPRESSION', 'Unsupported replay compression.', { compression });
  }
  const rows = requireDimension(rawReplay.rows, 'replay.rows', LIMITS.maxRows);
  const cols = requireDimension(rawReplay.cols, 'replay.cols', LIMITS.maxCols);
  if (rows * cols > 65_536) {
    throw new ReplayError('INVALID_CONTAINER', 'Replay grid contains too many cells.', { rows, cols });
  }
  const appVersion = requireString(rawReplay.version, 'replay.version');
  const puzzleId = requireString(rawReplay.puzzleId, 'replay.puzzleId');
  const replayData = requireString(rawReplay.data, 'replay.data');

  let puzzlePayload: string;
  try {
    puzzlePayload = decodeURIComponent(puzzleEncoded.slice(4));
  } catch (error) {
    throw new ReplayError('INVALID_PUZZLE', 'Embedded puzzle contains invalid URL encoding.', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  const puzzleText = decompressFromBase64Bounded(puzzlePayload, LIMITS.maxPuzzleChars);
  let unknownPuzzle: unknown;
  try {
    unknownPuzzle = JSON.parse(puzzleText);
  } catch (error) {
    throw new ReplayError('INVALID_PUZZLE', 'Embedded puzzle did not decode to valid JSON.', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  assertJsonDepth(unknownPuzzle, LIMITS.maxJsonDepth);
  const puzzle = requireObject(unknownPuzzle, 'Embedded puzzle');
  const actionStream = decompressFromBase64Bounded(replayData, LIMITS.maxActionStreamChars);

  const warnings: ReplayWarning[] = [];
  if (appVersion !== '0.612.0') {
    warnings.push({
      code: 'UNTESTED_APP_VERSION',
      message: `Replay format is recognized, but SudokuPad app version ${appVersion} has not been validated by the golden sample.`,
    });
  }
  if (puzzle.solution === undefined) {
    warnings.push({ code: 'MISSING_SOLUTION', message: 'Embedded puzzle has no solution; solution comparisons are unavailable.' });
  }

  const metadata: ReplayMetadata = {
    format: 'replay_v1.0',
    compression: 'clzw',
    puzzleId,
    appVersion,
    rows,
    cols,
    title: typeof puzzle.title === 'string' ? puzzle.title : undefined,
    author: typeof puzzle.author === 'string' ? puzzle.author : undefined,
    rules: typeof puzzle.ruleset === 'string' ? puzzle.ruleset : typeof puzzle.rules === 'string' ? puzzle.rules : undefined,
  };

  return { metadata, warnings, puzzle, actionStream };
}
