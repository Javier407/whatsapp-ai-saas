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
