import { PrismaClient as BasePrismaClient } from '@prisma/client';
import { getCurrentTenantId } from './tenantContext.js';

// Tenant-scoped models that require RLS SET LOCAL before every query.
const TENANT_SCOPED_MODELS = new Set([
  'user',
  'flow',
  'flowNode',
  'knowledgeBaseDocument',
  'conversationLog',
]);

let _instance: BasePrismaClient | null = null;

/**
 * Singleton Prisma client with RLS middleware.
 *
 * For every query on a tenant-scoped model, wraps the operation in a
 * transaction that first executes:
 *   SET LOCAL app.tenant_id = '<uuid>'
 *
 * This makes PostgreSQL's RLS policies enforce row-level isolation.
 * The tenantId is read from AsyncLocalStorage — never from request body.
 *
 * NOTE: DATABASE_URL must use the `app_user` role (no BYPASSRLS).
 *       DATABASE_MIGRATION_URL must use the `migrator` role (BYPASSRLS).
 */
export function getPrismaClient(): BasePrismaClient {
  if (_instance) return _instance;

  _instance = new BasePrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
  });

  _instance.$use(async (params, next) => {
    const model = params.model?.toLowerCase();

    if (!model || !TENANT_SCOPED_MODELS.has(model)) {
      return next(params);
    }

    const tenantId = getCurrentTenantId();

    if (!tenantId) {
      // No tenant context set — RLS will block all rows. This is the safe default.
      return next(params);
    }

    // Wrap in an interactive transaction to set the GUC before the query runs.
    return _instance!.$transaction(async (tx) => {
      // SET LOCAL scopes to the current transaction only.
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return next(params);
    });
  });

  return _instance;
}

export { BasePrismaClient as PrismaClient };
