/**
 * Base class for all typed domain errors in the gateway service.
 * Every error carries a machine-readable `code` string for structured logging.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Restore prototype chain (required when extending built-ins in TypeScript)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when the X-Hub-Signature-256 header does not match the computed HMAC. */
export class SignatureVerificationError extends DomainError {
  readonly code = 'SIGNATURE_VERIFICATION_FAILED';
}

/**
 * Thrown when a phone_number_id cannot be resolved to any tenant in the
 * database. The webhook event is silently skipped (not a fatal error).
 */
export class TenantNotFoundError extends DomainError {
  readonly code = 'TENANT_NOT_FOUND';

  constructor(readonly phoneNumberId: string) {
    super(`No tenant found for phone_number_id: ${phoneNumberId}`);
  }
}
