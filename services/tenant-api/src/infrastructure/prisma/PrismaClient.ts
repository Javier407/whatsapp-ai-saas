import { PrismaClient as BasePrismaClient } from '@prisma/client';

let _instance: BasePrismaClient | null = null;

/**
 * Singleton Prisma client.
 *
 * RLS is enforced per-query by the `withRls` helper (see withRls.ts), which runs
 * `SET LOCAL app.tenant_id` and the query inside the same interactive
 * transaction. A `$use` middleware CANNOT do this: it sets the GUC on the
 * transaction connection but `next()` runs the query on a different pooled
 * connection, so RLS is not actually applied.
 *
 * NOTE: the runtime connection string (DATABASE_URL) must use a NOSUPERUSER,
 * NOBYPASSRLS role (`app_rls`). Migrations use `app_user` (superuser) via
 * DATABASE_MIGRATION_URL.
 */
export function getPrismaClient(): BasePrismaClient {
  if (_instance) return _instance;

  _instance = new BasePrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
  });

  return _instance;
}

export { BasePrismaClient as PrismaClient };
