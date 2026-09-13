import { decodeActions } from './actions.js';
import { readReplayContainer } from './container.js';
import { cellName, ReplayEngine } from './engine.js';
import type { EventFilters, ReplayAnalysis, ReplayEvent } from './types.js';

export async function parseReplayFile(filePath: string, stopAtAction?: number): Promise<ReplayAnalysis> {
  const parsed = await readReplayContainer(filePath);
  const actions = decodeActions(parsed.actionStream, parsed.metadata.rows, parsed.metadata.cols, parsed.metadata.appVersion);
  const engine = new ReplayEngine(parsed.puzzle, parsed.metadata.rows, parsed.metadata.cols);
  const limit = stopAtAction === undefined ? actions.length : Math.max(0, Math.min(actions.length, stopAtAction));
  const events: ReplayEvent[] = [];
  for (const action of actions.slice(0, limit)) events.push(engine.step(action));
  const finalState = engine.exportState();
  const finalSolutionMismatches = engine.solution
    ? engine.solution.flatMap((solution, index) => {
        const cell = cellName(index, parsed.metadata.cols);
        const actual = finalState[cell].given ?? finalState[cell].value;
        return actual !== solution ? [{ cell, value: actual, solution }] : [];
      })
    : [];
  const counts = actions.slice(0, limit).reduce<Record<string, number>>((result, action) => {
    result[action.shortType] = (result[action.shortType] ?? 0) + 1;
    return result;
  }, {});
  return {
    metadata: parsed.metadata,
    warnings: parsed.warnings,
    actions: actions.slice(0, limit),
    events,
    initialState: engine.initialState,
    finalState,
    solution: engine.solution,
    finalSolutionMismatches,
    durationMs: engine.durationMs,
    counts,
    reliableThroughAction: limit,
  };
}

const PURE_SELECTION = new Set(['hl', 'sl', 'ds']);

export function queryEvents(analysis: ReplayAnalysis, filters: EventFilters = {}) {
  const includeSelection = filters.includeSelection ?? false;
  const normalizedCells = new Set((filters.cells ?? []).map(cell => cell.toLowerCase()));
  let events = analysis.events.filter(event => {
    if (!includeSelection && PURE_SELECTION.has(event.shortType)) return false;
    if (filters.types?.length && !filters.types.includes(event.shortType) && !filters.types.includes(event.type)) return false;
    if (filters.fromMs !== undefined && event.timestampMs < filters.fromMs) return false;
    if (filters.toMs !== undefined && event.timestampMs > filters.toMs) return false;
    if (filters.solutionMismatchOnly && event.solutionMismatches.length === 0) return false;
    if (normalizedCells.size > 0) {
      const mentioned = new Set([...event.affectedCells, ...event.selectionBefore, ...event.selectionAfter].map(cell => cell.toLowerCase()));
      if (![...normalizedCells].some(cell => mentioned.has(cell))) return false;
    }
    return true;
  });
  const total = events.length;
  const offset = Math.max(0, filters.offset ?? 0);
  const limit = Math.max(1, Math.min(500, filters.limit ?? 100));
  events = events.slice(offset, offset + limit);
  return { total, offset, limit, hasMore: offset + events.length < total, events };
}

export function inspectionSummary(analysis: ReplayAnalysis) {
  return {
    metadata: analysis.metadata,
    warnings: analysis.warnings,
    actionCount: analysis.actions.length,
    durationMs: analysis.durationMs,
    counts: analysis.counts,
    hasSolution: analysis.solution !== undefined,
    finalSolutionMismatchCount: analysis.finalSolutionMismatches.length,
    finalSolutionMismatches: analysis.finalSolutionMismatches.slice(0, 100),
    reliableThroughAction: analysis.reliableThroughAction,
  };
}
