export const LIMITS = Object.freeze({
  maxFileBytes: 8 * 1024 * 1024,
  maxPuzzleChars: 32 * 1024 * 1024,
  maxActionStreamChars: 32 * 1024 * 1024,
  maxActions: 250_000,
  maxRows: 256,
  maxCols: 256,
  maxJsonDepth: 128,
});

export type ReplayLimits = typeof LIMITS;
