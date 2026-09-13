#!/usr/bin/env node
import { parseReplayFile, inspectionSummary, queryEvents } from './core.js';
import { asReplayError, ReplayError } from './errors.js';

interface ParsedArgs {
  command?: string;
  file?: string;
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, file, ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) throw new ReplayError('INVALID_CONTAINER', `Unexpected argument: ${token}`);
    const name = token.slice(2);
    const next = rest[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(name, next);
      index += 1;
    } else flags.set(name, true);
  }
  return { command, file, flags };
}

function numericFlag(flags: Map<string, string | boolean>, name: string): number | undefined {
  const value = flags.get(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new ReplayError('INVALID_CONTAINER', `--${name} must be a non-negative number.`);
  return parsed;
}

function listFlag(flags: Map<string, string | boolean>, name: string): string[] | undefined {
  const value = flags.get(name);
  if (typeof value !== 'string') return undefined;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function usage(): string {
  return [
    'Usage:',
    '  sudokupad-replay inspect FILE',
    '  sudokupad-replay events FILE [--include-selection] [--type vl,ud] [--cell r8c8] [--from-ms N] [--to-ms N] [--mismatch-only] [--offset N] [--limit N]',
    '  sudokupad-replay state FILE (--action N | --time-ms N)',
  ].join('\n');
}

async function main() {
  const { command, file, flags } = parseArgs(process.argv.slice(2));
  if (!command || !file || !['inspect', 'events', 'state'].includes(command)) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  if (command === 'inspect') {
    const analysis = await parseReplayFile(file);
    process.stdout.write(`${JSON.stringify(inspectionSummary(analysis), null, 2)}\n`);
    return;
  }

  if (command === 'events') {
    const analysis = await parseReplayFile(file);
    const result = queryEvents(analysis, {
      includeSelection: flags.has('include-selection'),
      types: listFlag(flags, 'type'),
      cells: listFlag(flags, 'cell'),
      fromMs: numericFlag(flags, 'from-ms'),
      toMs: numericFlag(flags, 'to-ms'),
      solutionMismatchOnly: flags.has('mismatch-only'),
      offset: numericFlag(flags, 'offset'),
      limit: numericFlag(flags, 'limit'),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const actionIndex = numericFlag(flags, 'action');
  const timeMs = numericFlag(flags, 'time-ms');
  if ((actionIndex === undefined) === (timeMs === undefined)) {
    throw new ReplayError('INVALID_CONTAINER', 'state requires exactly one of --action or --time-ms.');
  }
  let stopAtAction = actionIndex;
  if (timeMs !== undefined) {
    const full = await parseReplayFile(file);
    stopAtAction = full.events.filter(event => event.timestampMs <= timeMs).at(-1)?.index ?? 0;
  }
  const analysis = await parseReplayFile(file, Math.floor(stopAtAction!));
  process.stdout.write(`${JSON.stringify({
    metadata: analysis.metadata,
    atAction: analysis.reliableThroughAction,
    timestampMs: analysis.durationMs,
    state: analysis.finalState,
  }, null, 2)}\n`);
}

main().catch(error => {
  const replayError = asReplayError(error);
  process.stderr.write(`${JSON.stringify({ error: replayError.toJSON() }, null, 2)}\n`);
  process.exitCode = 1;
});
