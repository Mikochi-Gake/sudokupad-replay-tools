export type WarningCode = 'UNTESTED_APP_VERSION' | 'MISSING_SOLUTION';

export interface ReplayWarning {
  code: WarningCode;
  message: string;
}

export interface CellState {
  given?: string;
  value?: string;
  candidates: string[];
  pencilmarks: string[];
  colours: string[];
  pen: string[];
}

export interface CellChange {
  cell: string;
  before: CellState;
  after: CellState;
}

export interface DecodedAction {
  index: number;
  code: string;
  shortType: string;
  type: string;
  raw: string;
  rawArg?: string;
  arg?: string | string[];
  deltaTicks: number;
  deltaMs: number;
}

export interface ReplayEvent extends DecodedAction {
  timestampMs: number;
  selectionBefore: string[];
  selectionAfter: string[];
  affectedCells: string[];
  changes: CellChange[];
  undoes: number[];
  redoes: number[];
  solutionMismatches: Array<{ cell: string; value: string; solution: string }>;
}

export interface ReplayMetadata {
  format: 'replay_v1.0';
  compression: 'clzw';
  puzzleId: string;
  appVersion: string;
  rows: number;
  cols: number;
  title?: string;
  author?: string;
  rules?: string;
}

export interface ReplayAnalysis {
  metadata: ReplayMetadata;
  warnings: ReplayWarning[];
  actions: DecodedAction[];
  events: ReplayEvent[];
  initialState: Record<string, CellState>;
  finalState: Record<string, CellState>;
  solution?: string[];
  finalSolutionMismatches: Array<{ cell: string; value?: string; solution: string }>;
  durationMs: number;
  counts: Record<string, number>;
  reliableThroughAction: number;
}

export interface EventFilters {
  includeSelection?: boolean;
  types?: string[];
  cells?: string[];
  fromMs?: number;
  toMs?: number;
  solutionMismatchOnly?: boolean;
  offset?: number;
  limit?: number;
}
