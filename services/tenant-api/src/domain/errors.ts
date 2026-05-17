// ---------------------------------------------------------------------------
// Domain errors — typed, not generic Error subclasses
// ---------------------------------------------------------------------------

export class DomainError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} '${id}' not found` : `${resource} not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

export class ValidationError extends DomainError {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN');
  }
}

export class QuotaExceededError extends DomainError {
  constructor(resource: string, limit: number) {
    super(`Quota exceeded: maximum ${limit} ${resource} allowed`, 'QUOTA_EXCEEDED');
  }
}

export class ExternalServiceError extends DomainError {
  constructor(service: string, message: string) {
    super(`External service error (${service}): ${message}`, 'EXTERNAL_SERVICE_ERROR');
  }
}
