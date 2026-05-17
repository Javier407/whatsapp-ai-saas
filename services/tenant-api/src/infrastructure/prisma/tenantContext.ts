import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * AsyncLocalStorage that holds the current tenant_id for RLS enforcement.
 * Set by rlsPlugin.ts per request; read by PrismaClient middleware.
 */
export const tenantContext = new AsyncLocalStorage<string>();

export function getCurrentTenantId(): string | undefined {
  return tenantContext.getStore();
}
