import { randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import {
  DomainError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  QuotaExceededError,
} from '../../domain/errors.js';

export interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string; details?: string[] } | null;
  meta: { request_id: string };
}

/** Parse an optional non-negative integer query param, or throw ValidationError.
 *  Guards against NaN reaching the DB layer (parseInt('abc') → NaN → 500). */
export function parseOptionalInt(value: string | undefined, field: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new ValidationError(`Invalid '${field}': must be a non-negative integer`);
  }
  return n;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if the string is a canonical UUID. Use to reject malformed ids before
 *  they hit a Postgres uuid column (which would otherwise 500). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function ok<T>(reply: FastifyReply, data: T, status = 200): void {
  void reply.status(status).send({
    data,
    error: null,
    meta: { request_id: randomUUID() },
  } satisfies ApiResponse<T>);
}

// Maps each domain error to its HTTP status. Ordered most-specific first;
// the bare DomainError catch-all must stay last so subclasses match before it.
const ERROR_STATUS_MAP: ReadonlyArray<[new (...args: never[]) => DomainError, number]> = [
  [NotFoundError, 404],
  [ConflictError, 409],
  [ValidationError, 422],
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [QuotaExceededError, 429],
  [DomainError, 400],
];

export function sendDomainError(reply: FastifyReply, err: unknown): void {
  const requestId = randomUUID();

  for (const [ErrorClass, status] of ERROR_STATUS_MAP) {
    if (err instanceof ErrorClass) {
      void reply.status(status).send({
        data: null,
        error: {
          code: err.code,
          message: err.message,
          ...(err instanceof ValidationError && { details: err.details }),
        },
        meta: { request_id: requestId },
      });
      return;
    }
  }

  // Unknown error — 500
  void reply.status(500).send({
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    meta: { request_id: requestId },
  });
}
