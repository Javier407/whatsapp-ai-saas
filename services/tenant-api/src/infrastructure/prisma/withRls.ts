import type { PrismaClient, Prisma } from '@prisma/client';
import { getCurrentTenantId } from './tenantContext.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs a tenant-scoped query with PostgreSQL RLS actually enforced.
 *
 * The GUC `app.tenant_id` is transaction-local (SET LOCAL), so it MUST be set
 * on the same connection that runs the query. This opens one interactive
 * transaction and runs both the SET and the query on its `tx` client — unlike
 * the previous $use middleware, which set the GUC on the transaction connection
 * but ran the query (via next()) on a different pooled connection, leaving RLS
 * effectively disabled (it only appeared to work because the runtime role was
 * a BYPASSRLS superuser).
 *
 * The tenant id comes from AsyncLocalStorage (set per-request from the JWT),
 * or is passed explicitly for pre-auth flows (login/register). With no tenant
 * context the query still runs inside a transaction but without the GUC, so RLS
 * fails closed (no rows / blocked writes) rather than leaking.
 */
export async function withRls<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  explicitTenantId?: string,
): Promise<T> {
  const tenantId = explicitTenantId ?? getCurrentTenantId();

  return prisma.$transaction(async (tx) => {
    if (tenantId) {
      if (!UUID_RE.test(tenantId)) {
        throw new Error('Invalid tenant context');
      }
      // SET LOCAL cannot be parameterized; tenantId is validated as a UUID above.
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    }
    return fn(tx);
  });
}
