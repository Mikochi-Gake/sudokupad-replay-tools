export type ReplayErrorCode =
  | 'FILE_NOT_FOUND'
  | 'NOT_A_FILE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_JSON'
  | 'INVALID_CONTAINER'
  | 'UNSUPPORTED_FORMAT'
  | 'UNSUPPORTED_COMPRESSION'
  | 'INVALID_CLZW'
  | 'DECOMPRESSED_LIMIT'
  | 'INVALID_PUZZLE'
  | 'INVALID_ACTION_STREAM'
  | 'UNSUPPORTED_ACTION'
  | 'INVALID_ACTION'
  | 'INVALID_COORDINATE'
  | 'ACTION_LIMIT';

export class ReplayError extends Error {
  readonly code: ReplayErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ReplayErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ReplayError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, details: this.details };
  }
}

export function asReplayError(error: unknown): ReplayError {
  if (error instanceof ReplayError) return error;
  if (error instanceof Error) return new ReplayError('INVALID_CONTAINER', error.message);
  return new ReplayError('INVALID_CONTAINER', String(error));
}
