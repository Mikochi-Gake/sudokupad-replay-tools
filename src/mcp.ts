#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { inspectionSummary, parseReplayFile, queryEvents } from './core.js';
import { asReplayError } from './errors.js';

const server = new McpServer({ name: 'sudokupad-replay-tools', version: '0.1.0' });

function success(value: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function failure(error: unknown) {
  const value = { error: asReplayError(error).toJSON() };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    isError: true,
  };
}

server.registerTool('inspect_replay', {
  title: 'Inspect SudokuPad replay',
  description: 'Parse a local SudokuPad replay_v1.0/clzw file and return metadata, warnings, counts, duration, and final solution validation. Does not upload or modify the file.',
  inputSchema: { path: z.string().min(1).describe('Absolute or working-directory-relative path to a local .replay file') },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, async ({ path }) => {
  try {
    return success(inspectionSummary(await parseReplayFile(path)) as unknown as Record<string, unknown>);
  } catch (error) {
    return failure(error);
  }
});

server.registerTool('query_events', {
  title: 'Query SudokuPad replay events',
  description: 'Return deterministic replay events with before/after cell changes and undo/redo links. Pure selection events are hidden by default. Results are paginated.',
  inputSchema: {
    path: z.string().min(1),
    includeSelection: z.boolean().optional().default(false),
    types: z.array(z.string()).optional(),
    cells: z.array(z.string()).optional(),
    fromMs: z.number().nonnegative().optional(),
    toMs: z.number().nonnegative().optional(),
    solutionMismatchOnly: z.boolean().optional().default(false),
    offset: z.number().int().nonnegative().optional().default(0),
    limit: z.number().int().min(1).max(500).optional().default(100),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, async ({ path, ...filters }) => {
  try {
    return success(queryEvents(await parseReplayFile(path), filters) as unknown as Record<string, unknown>);
  } catch (error) {
    return failure(error);
  }
});

server.registerTool('get_state', {
  title: 'Get SudokuPad replay state',
  description: 'Reconstruct the complete grid state after an action index or at a replay time. Exactly one position argument is required.',
  inputSchema: {
    path: z.string().min(1),
    actionIndex: z.number().int().nonnegative().optional(),
    timeMs: z.number().nonnegative().optional(),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, async ({ path, actionIndex, timeMs }) => {
  try {
    if ((actionIndex === undefined) === (timeMs === undefined)) throw new Error('Provide exactly one of actionIndex or timeMs.');
    let stopAtAction = actionIndex;
    if (timeMs !== undefined) {
      const full = await parseReplayFile(path);
      stopAtAction = full.events.filter(event => event.timestampMs <= timeMs).at(-1)?.index ?? 0;
    }
    const analysis = await parseReplayFile(path, stopAtAction);
    return success({
      metadata: analysis.metadata,
      atAction: analysis.reliableThroughAction,
      timestampMs: analysis.durationMs,
      state: analysis.finalState,
    });
  } catch (error) {
    return failure(error);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify({ error: asReplayError(error).toJSON() })}\n`);
  process.exit(1);
});
