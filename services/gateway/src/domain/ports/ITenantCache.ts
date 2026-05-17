/**
 * Port — resolves a tenant UUID from a Meta phone number ID.
 * Infrastructure implementation: RedisTenantCache (Redis GET + Postgres fallback).
 */
export interface ITenantCache {
  /**
   * Returns the tenant UUID for the given phone number ID.
   * Throws TenantNotFoundError if the phone number ID is unknown.
   */
  getTenantId(phoneNumberId: string): Promise<string>;
}
