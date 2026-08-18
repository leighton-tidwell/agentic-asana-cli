export type ErrorCode =
  | 'USAGE'
  | 'AUTH'
  | 'READONLY_BLOCKED'
  | 'READONLY_UNRESOLVED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER'
  | 'NETWORK'
  | 'CONFLICT'
  | 'INTERNAL';

const EXIT_CODES: Record<ErrorCode, number> = {
  INTERNAL: 1,
  USAGE: 2,
  AUTH: 3,
  READONLY_BLOCKED: 4,
  READONLY_UNRESOLVED: 4,
  FORBIDDEN: 4,
  NOT_FOUND: 5,
  RATE_LIMITED: 6,
  SERVER: 7,
  NETWORK: 8,
  CONFLICT: 9,
};

export class CliError extends Error {
  readonly exitCode: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'CliError';
    this.exitCode = EXIT_CODES[code];
  }
}

export function errorEnvelope(error: CliError): object {
  return {
    error: { code: error.code, message: error.message, details: error.details },
  };
}
