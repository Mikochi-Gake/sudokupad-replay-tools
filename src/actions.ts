import { ReplayError } from './errors.js';
import { LIMITS } from './limits.js';
import type { DecodedAction } from './types.js';

const CURRENT_ACTIONS = ['hl', 'vl', 'pm', 'cd', 'co', 'cl', 'ud', 'rd', 'sl', 'ds', 'pe', 'pc', 'gs', 'ge', 'up', 'wt'];
const LEGACY_ACTIONS_078_TO_0812 = ['hl', 'vl', 'pm', 'cd', 'co', 'pe', 'cl', 'ud', 'rd', 'sl', 'ds', 'gs', 'ge'];
const ACTION_LONG_NAMES: Record<string, string> = {
  hl: 'select',
  sl: 'select',
  ds: 'deselect',
  vl: 'value',
  pm: 'pencilmarks',
  cd: 'candidates',
  co: 'colour',
  cl: 'clear',
  ud: 'undo',
  rd: 'redo',
  pe: 'pen',
  pc: 'pencolor',
  gs: 'groupstart',
  ge: 'groupend',
  up: 'unpause',
  wt: 'wait',
};
const CELL_ARGUMENT_ACTIONS = new Set(['hl', 'sl', 'ds']);

function parseVersion(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersion(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function actionTable(version: string): string[] {
  const parsed = parseVersion(version);
  if (
    parsed &&
    compareVersion(parsed, [0, 78, 0]) >= 0 &&
    compareVersion(parsed, [0, 81, 2]) <= 0
  ) return LEGACY_ACTIONS_078_TO_0812;
  return CURRENT_ACTIONS;
}

function decodeCells(raw: string, rows: number, cols: number, actionIndex: number): string[] {
  if (raw === '-' || raw === '') return [];
  const width = (rows * cols - 1).toString(16).length;
  if (raw.length % width !== 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new ReplayError('INVALID_COORDINATE', 'Cell argument is not a valid hexadecimal cell list.', {
      actionIndex,
      raw,
      width,
    });
  }
  const cells: string[] = [];
  for (let offset = 0; offset < raw.length; offset += width) {
    const numeric = Number.parseInt(raw.slice(offset, offset + width), 16);
    if (numeric >= rows * cols) {
      throw new ReplayError('INVALID_COORDINATE', 'Cell argument points outside the replay grid.', {
        actionIndex,
        numeric,
        rows,
        cols,
      });
    }
    cells.push(`r${Math.floor(numeric / cols) + 1}c${numeric % cols + 1}`);
  }
  return cells;
}

export function decodeActions(stream: string, rows: number, cols: number, appVersion: string): DecodedAction[] {
  const table = actionTable(appVersion);
  const actions: DecodedAction[] = [];
  let position = 0;

  while (position < stream.length) {
    if (actions.length >= LIMITS.maxActions) {
      throw new ReplayError('ACTION_LIMIT', 'Replay contains more actions than the configured limit.', {
        maxActions: LIMITS.maxActions,
        position,
      });
    }
    const start = position;
    const code = stream[position];
    if (!/[A-Z]/.test(code)) {
      throw new ReplayError('INVALID_ACTION_STREAM', 'Expected an uppercase action code.', { position, raw: stream.slice(position, position + 32) });
    }
    position += 1;
    const separator = stream.indexOf('_', position);
    if (separator < 0) {
      throw new ReplayError('INVALID_ACTION_STREAM', 'Action is missing its time separator.', { position: start, raw: stream.slice(start) });
    }
    const rawArg = stream.slice(position, separator);
    position = separator + 1;
    const timeStart = position;
    while (position < stream.length && /[0-9]/.test(stream[position])) position += 1;
    if (timeStart === position) {
      throw new ReplayError('INVALID_ACTION', 'Action has no numeric time delta.', { position: start, raw: stream.slice(start, position + 16) });
    }
    const raw = stream.slice(start, position);
    const tableIndex = code.codePointAt(0)! - 'A'.codePointAt(0)!;
    const shortType = table[tableIndex];
    if (!shortType) {
      throw new ReplayError('UNSUPPORTED_ACTION', 'Replay contains an unsupported action code.', {
        actionIndex: actions.length + 1,
        position: start,
        code,
        raw,
        reliableThroughAction: actions.length,
      });
    }
    const deltaTicks = Number(stream.slice(timeStart, position));
    if (!Number.isSafeInteger(deltaTicks)) {
      throw new ReplayError('INVALID_ACTION', 'Action time delta is not a safe integer.', { actionIndex: actions.length + 1, raw });
    }
    const arg = CELL_ARGUMENT_ACTIONS.has(shortType)
      ? rawArg === '' ? undefined : decodeCells(rawArg, rows, cols, actions.length + 1)
      : rawArg === '' || rawArg === '-' ? undefined : rawArg;
    actions.push({
      index: actions.length + 1,
      code,
      shortType,
      type: ACTION_LONG_NAMES[shortType] ?? shortType,
      raw,
      rawArg: rawArg || undefined,
      arg,
      deltaTicks,
      deltaMs: deltaTicks * 50,
    });
  }
  return actions;
}
