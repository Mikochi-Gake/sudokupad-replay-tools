import { ReplayError } from './errors.js';
import type { CellChange, CellState, DecodedAction, ReplayEvent } from './types.js';

interface MutableCell {
  given?: string;
  value?: string;
  candidates: Set<string>;
  pencilmarks: Set<string>;
  colours: Set<string>;
  pen: Set<string>;
}

interface MutableState {
  cells: MutableCell[];
  selected: Set<number>;
  penColor?: string;
}

interface StackAction extends DecodedAction {}

const TOOLS = ['normal', 'corner', 'centre', 'colour', 'pen'] as const;
const SELECTION_TYPES = new Set(['hl', 'sl', 'ds', 'up']);

function emptyCell(given?: string): MutableCell {
  return {
    given,
    candidates: new Set(),
    pencilmarks: new Set(),
    colours: new Set(),
    pen: new Set(),
  };
}

function toCellState(cell: MutableCell): CellState {
  return {
    given: cell.given,
    value: cell.value,
    candidates: [...cell.candidates].sort(),
    pencilmarks: [...cell.pencilmarks].sort(),
    colours: [...cell.colours].sort(),
    pen: [...cell.pen].sort(),
  };
}

function cellStateEqual(a: CellState, b: CellState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function cellName(index: number, cols: number): string {
  return `r${Math.floor(index / cols) + 1}c${index % cols + 1}`;
}

export function cellIndex(name: string, rows: number, cols: number): number {
  const match = /^r(\d+)c(\d+)$/i.exec(name);
  if (!match) throw new ReplayError('INVALID_COORDINATE', 'Cell name must use rNcN notation.', { cell: name });
  const row = Number(match[1]);
  const col = Number(match[2]);
  if (row < 1 || row > rows || col < 1 || col > cols) {
    throw new ReplayError('INVALID_COORDINATE', 'Cell name points outside the replay grid.', { cell: name, rows, cols });
  }
  return (row - 1) * cols + col - 1;
}

function readInitialGivens(puzzle: Record<string, unknown>, rows: number, cols: number): Array<string | undefined> {
  const givens = Array<string | undefined>(rows * cols).fill(undefined);
  if (puzzle.grid === undefined) return givens;
  if (!Array.isArray(puzzle.grid) || puzzle.grid.length !== rows) {
    throw new ReplayError('INVALID_PUZZLE', 'Embedded puzzle grid does not match replay rows.', { rows });
  }
  for (let row = 0; row < rows; row += 1) {
    const sourceRow = puzzle.grid[row];
    if (!Array.isArray(sourceRow) || sourceRow.length !== cols) {
      throw new ReplayError('INVALID_PUZZLE', 'Embedded puzzle grid does not match replay columns.', { row: row + 1, cols });
    }
    for (let col = 0; col < cols; col += 1) {
      const rawCell = sourceRow[col];
      if (rawCell && typeof rawCell === 'object' && !Array.isArray(rawCell)) {
        const cell = rawCell as Record<string, unknown>;
        if (cell.given === true && cell.value !== undefined) givens[row * cols + col] = String(cell.value).toLowerCase();
      }
    }
  }
  return givens;
}

export function readSolution(puzzle: Record<string, unknown>, cellCount: number): string[] | undefined {
  const raw = puzzle.solution;
  let solution: string[];
  if (typeof raw === 'string') solution = [...raw].map(String);
  else if (Array.isArray(raw)) solution = raw.flat(Infinity).map(String);
  else return undefined;
  if (solution.length !== cellCount) {
    throw new ReplayError('INVALID_PUZZLE', 'Embedded solution length does not match replay grid.', {
      expected: cellCount,
      actual: solution.length,
    });
  }
  return solution.map(value => value.toLowerCase());
}

export class ReplayEngine {
  private state: MutableState;
  private undoStack: StackAction[] = [];
  private redoStack: StackAction[] = [];
  private undoSelection = 0;
  private inGroup = false;
  private timestampMs = 0;
  readonly solution?: string[];
  readonly initialState: Record<string, CellState>;

  constructor(
    private readonly puzzle: Record<string, unknown>,
    readonly rows: number,
    readonly cols: number,
  ) {
    this.solution = readSolution(puzzle, rows * cols);
    this.state = this.makeInitialState();
    this.initialState = this.exportState();
  }

  private makeInitialState(): MutableState {
    const givens = readInitialGivens(this.puzzle, this.rows, this.cols);
    return { cells: givens.map(emptyCell), selected: new Set() };
  }

  private indicesFromArg(action: DecodedAction): number[] {
    if (!Array.isArray(action.arg)) return [];
    return action.arg.map(name => cellIndex(name, this.rows, this.cols));
  }

  private selectedIndices(): number[] {
    return [...this.state.selected];
  }

  private has(cell: MutableCell, prop: string): boolean {
    if (prop === 'given') return cell.given !== undefined;
    if (prop === 'normal') return cell.value !== undefined;
    if (prop === 'centre') return cell.candidates.size > 0;
    if (prop === 'corner') return cell.pencilmarks.size > 0;
    if (prop === 'colour') return cell.colours.size > 0;
    if (prop === 'pen') return cell.pen.size > 0;
    return false;
  }

  private visible(cell: MutableCell, prop: string): boolean {
    if (prop === 'normal') return !this.has(cell, 'given');
    if (prop === 'centre' || prop === 'corner') return !this.has(cell, 'given') && !this.has(cell, 'normal');
    return true;
  }

  private setFor(cell: MutableCell, prop: string): Set<string> {
    if (prop === 'centre') return cell.candidates;
    if (prop === 'corner') return cell.pencilmarks;
    if (prop === 'colour') return cell.colours;
    if (prop === 'pen') return cell.pen;
    throw new ReplayError('INVALID_ACTION', 'Action references an invalid cell property.', { prop });
  }

  private toggleGroup(indices: number[], prop: string, value: string): Set<number> {
    const eligible = indices.filter(index => this.visible(this.state.cells[index], prop));
    if (prop === 'normal') {
      const remove = eligible.every(index => this.state.cells[index].value === value);
      for (const index of eligible) this.state.cells[index].value = remove ? undefined : value;
      return new Set(eligible);
    }
    const remove = eligible.every(index => this.setFor(this.state.cells[index], prop).has(value));
    for (const index of eligible) {
      const set = this.setFor(this.state.cells[index], prop);
      if (remove) set.delete(value); else set.add(value);
    }
    return new Set(eligible);
  }

  private apply(action: DecodedAction): { executed: boolean; touched: Set<number> } {
    const touched = new Set<number>();
    const selected = this.selectedIndices();
    const value = typeof action.arg === 'string' ? action.arg.toLowerCase() : undefined;
    switch (action.shortType) {
      case 'hl':
      case 'sl':
        for (const index of this.indicesFromArg(action)) this.state.selected.add(index);
        return { executed: true, touched };
      case 'ds': {
        const targets = Array.isArray(action.arg) ? this.indicesFromArg(action) : selected;
        let executed = false;
        for (const index of targets) executed = this.state.selected.delete(index) || executed;
        return { executed, touched };
      }
      case 'vl': return { executed: true, touched: this.toggleGroup(selected, 'normal', value ?? '') };
      case 'cd': return { executed: true, touched: this.toggleGroup(selected, 'centre', value ?? '') };
      case 'pm': return { executed: true, touched: this.toggleGroup(selected, 'corner', value ?? '') };
      case 'co': return { executed: true, touched: this.toggleGroup(selected, 'colour', value ?? '') };
      case 'pe': return { executed: true, touched: this.toggleGroup(selected, 'pen', value ?? '') };
      case 'pc': this.state.penColor = value; return { executed: true, touched };
      case 'cl': {
        const toolIndex = Number(value);
        if (!Number.isInteger(toolIndex) || toolIndex < 0 || toolIndex >= TOOLS.length) {
          throw new ReplayError('INVALID_ACTION', 'Clear action references an invalid tool.', { actionIndex: action.index, arg: action.arg });
        }
        const priority: Record<string, string[]> = {
          normal: ['normal', 'centre', 'corner', 'colour', 'pen'],
          corner: ['corner', 'normal', 'centre', 'colour', 'pen'],
          centre: ['centre', 'normal', 'corner', 'colour', 'pen'],
          colour: ['colour', 'normal', 'centre', 'corner', 'pen'],
          pen: ['pen', 'normal', 'centre', 'corner', 'colour'],
        };
        const prop = priority[TOOLS[toolIndex]].find(candidate => selected.some(index => {
          const cell = this.state.cells[index];
          return this.visible(cell, candidate) && this.has(cell, candidate);
        }));
        if (!prop) return { executed: false, touched };
        for (const index of selected) {
          const cell = this.state.cells[index];
          if (!this.visible(cell, prop)) continue;
          if (prop === 'normal') cell.value = undefined;
          else this.setFor(cell, prop).clear();
          touched.add(index);
        }
        return { executed: true, touched };
      }
      case 'gs': this.inGroup = true; return { executed: true, touched };
      case 'ge': this.inGroup = false; return { executed: true, touched };
      case 'up':
      case 'wt': return { executed: true, touched };
      default:
        throw new ReplayError('UNSUPPORTED_ACTION', 'State engine cannot execute the decoded action.', {
          actionIndex: action.index,
          shortType: action.shortType,
          raw: action.raw,
        });
    }
  }

  private capture(indices: Iterable<number>): Map<number, CellState> {
    const result = new Map<number, CellState>();
    for (const index of indices) result.set(index, toCellState(this.state.cells[index]));
    return result;
  }

  private captureAll(): Map<number, CellState> {
    return this.capture(this.state.cells.keys());
  }

  private changes(before: Map<number, CellState>, candidates: Iterable<number>): CellChange[] {
    const changes: CellChange[] = [];
    for (const index of candidates) {
      const oldState = before.get(index) ?? toCellState(this.state.cells[index]);
      const newState = toCellState(this.state.cells[index]);
      if (!cellStateEqual(oldState, newState)) changes.push({ cell: cellName(index, this.cols), before: oldState, after: newState });
    }
    return changes;
  }

  private replayUndoStack(): void {
    this.state = this.makeInitialState();
    this.inGroup = false;
    for (const action of this.undoStack) this.apply(action);
  }

  private executeUndo(): StackAction[] {
    if (this.undoStack.length === 0) return [];
    const popped: StackAction[] = [];
    let first = true;
    let lastType = '';
    do {
      const action = this.undoStack.pop()!;
      popped.push(action);
      lastType = action.shortType;
      if (lastType === 'ge') this.inGroup = true;
      if (lastType === 'gs') this.inGroup = false;
      if (this.undoSelection === 0) this.redoStack.push(action);
      else if (this.undoSelection-- === 1) break;
      if (first && lastType === 'ds') break;
      first = false;
    } while (this.undoStack.length > 0 && (this.inGroup || SELECTION_TYPES.has(lastType)));
    this.replayUndoStack();
    return popped;
  }

  private executeRedo(): { redone: StackAction[]; implicitUndo: StackAction[] } {
    const redone: StackAction[] = [];
    const implicitUndo = this.undoSelection > 0 ? this.executeUndo() : [];
    if (this.redoStack.length === 0) return { redone, implicitUndo };
    let lastType = '';
    do {
      const action = this.redoStack.pop()!;
      this.apply(action);
      this.undoStack.push(action);
      redone.push(action);
      lastType = action.shortType;
    } while (this.redoStack.length > 0 && (this.inGroup || SELECTION_TYPES.has(lastType)));
    return { redone, implicitUndo };
  }

  step(action: DecodedAction): ReplayEvent {
    this.timestampMs += action.deltaMs;
    if (action.shortType === 'up' && typeof action.arg === 'string') {
      const pausedTicks = Number(action.arg);
      if (!Number.isSafeInteger(pausedTicks) || pausedTicks < 0) {
        throw new ReplayError('INVALID_ACTION', 'Unpause action contains an invalid duration.', { actionIndex: action.index });
      }
      this.timestampMs = Math.max(0, this.timestampMs - pausedTicks * 50);
    }

    const selectionBefore = this.selectedIndices().map(index => cellName(index, this.cols));
    let before = new Map<number, CellState>();
    let candidateIndices = new Set<number>();
    let undoes: number[] = [];
    let redoes: number[] = [];

    if (action.shortType === 'ud') {
      before = this.captureAll();
      candidateIndices = new Set(this.state.cells.keys());
      undoes = this.executeUndo().map(item => item.index);
    } else if (action.shortType === 'rd') {
      before = this.captureAll();
      candidateIndices = new Set(this.state.cells.keys());
      const result = this.executeRedo();
      undoes = result.implicitUndo.map(item => item.index);
      redoes = result.redone.map(item => item.index);
    } else {
      const likely = new Set(this.selectedIndices());
      before = this.capture(likely);
      const result = this.apply(action);
      candidateIndices = result.touched;
      for (const index of result.touched) if (!before.has(index)) before.set(index, toCellState(this.state.cells[index]));
      if (result.executed) {
        if (this.redoStack.length > 0 && SELECTION_TYPES.has(action.shortType)) this.undoSelection += 1;
        else {
          this.redoStack.length = 0;
          this.undoSelection = 0;
        }
        this.undoStack.push(action);
      }
    }

    const changes = this.changes(before, candidateIndices);
    const solutionMismatches = this.solution
      ? changes.flatMap(change => {
          const index = cellIndex(change.cell, this.rows, this.cols);
          return change.after.value !== undefined && change.after.value !== this.solution![index]
            ? [{ cell: change.cell, value: change.after.value, solution: this.solution![index] }]
            : [];
        })
      : [];
    return {
      ...action,
      timestampMs: this.timestampMs,
      selectionBefore,
      selectionAfter: this.selectedIndices().map(index => cellName(index, this.cols)),
      affectedCells: changes.map(change => change.cell),
      changes,
      undoes,
      redoes,
      solutionMismatches,
    };
  }

  exportState(): Record<string, CellState> {
    return Object.fromEntries(this.state.cells.map((cell, index) => [cellName(index, this.cols), toCellState(cell)]));
  }

  get durationMs(): number {
    return this.timestampMs;
  }
}
