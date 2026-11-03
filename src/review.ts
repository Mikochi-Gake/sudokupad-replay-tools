import { inspectionSummary, queryEvents } from './core.js';
import type { ReplayAnalysis, ReplayEvent } from './types.js';

const PURE_SELECTION = new Set(['hl', 'sl', 'ds']);
const NON_PROGRESS = new Set(['hl', 'sl', 'ds', 'up', 'wt', 'gs', 'ge']);

function changedValue(event: ReplayEvent, cell: string): string | undefined {
  return event.changes.find(change => change.cell === cell)?.after.value;
}

function findResolution(events: ReplayEvent[], start: number, cell: string, wrongValue: string) {
  for (let index = start + 1; index < events.length; index += 1) {
    const event = events[index];
    const nextValue = changedValue(event, cell);
    if (nextValue === undefined && !event.changes.some(change => change.cell === cell)) continue;
    if (nextValue !== wrongValue) {
      return {
        action: event.index,
        timestampMs: event.timestampMs,
        elapsedMs: Math.max(0, event.timestampMs - events[start].timestampMs),
        via: event.type,
        valueAfter: nextValue,
      };
    }
  }
  return undefined;
}

export function buildReview(analysis: ReplayAnalysis, includeSelection = false, sourceName?: string) {
  const mistakes = analysis.events.flatMap((event, eventIndex) => {
    if (event.shortType !== 'vl') return [];
    return event.solutionMismatches.map(mismatch => ({
      action: event.index,
      timestampMs: event.timestampMs,
      cell: mismatch.cell,
      entered: mismatch.value,
      solution: mismatch.solution,
      resolution: findResolution(analysis.events, eventIndex, mismatch.cell, mismatch.value),
    }));
  });

  const rollbacks = analysis.events
    .filter(event => event.undoes.length > 0 || event.redoes.length > 0)
    .map(event => ({
      action: event.index,
      timestampMs: event.timestampMs,
      type: event.shortType,
      undoes: event.undoes,
      redoes: event.redoes,
      affectedCells: event.affectedCells,
    }));

  const meaningful = analysis.events.filter(event => !NON_PROGRESS.has(event.shortType));
  const longestGaps = meaningful
    .map((event, index) => ({
      beforeAction: index === 0 ? 0 : meaningful[index - 1].index,
      action: event.index,
      timestampMs: event.timestampMs,
      gapMs: event.timestampMs - (index === 0 ? 0 : meaningful[index - 1].timestampMs),
      type: event.shortType,
      affectedCells: event.affectedCells,
    }))
    .sort((a, b) => b.gapMs - a.gapMs || a.action - b.action)
    .slice(0, 10);

  const selectionActions = analysis.events.filter(event => PURE_SELECTION.has(event.shortType)).length;
  const candidateActions = analysis.events.filter(event => event.shortType === 'cd' || event.shortType === 'pm').length;
  const valueActions = analysis.events.filter(event => event.shortType === 'vl').length;
  const timeline = queryEvents(analysis, { includeSelection, limit: 500 });

  return {
    schema: 'sudokupad-replay-review_v1',
    sourceName,
    summary: inspectionSummary(analysis),
    mistakes,
    rollbacks,
    speedClues: {
      selectionActions,
      selectionShare: analysis.events.length === 0 ? 0 : selectionActions / analysis.events.length,
      meaningfulActions: meaningful.length,
      candidateActions,
      valueActions,
      longestGaps,
      note: 'Gaps are time between state-changing actions. They are clues about scanning or reasoning time, not proof of a specific solving technique.',
    },
    timeline: {
      includedSelection: includeSelection,
      totalMatchingEvents: timeline.total,
      truncated: timeline.hasMore,
      events: timeline.events,
    },
  };
}
