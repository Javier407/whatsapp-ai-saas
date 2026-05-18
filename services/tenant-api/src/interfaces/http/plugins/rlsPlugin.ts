import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { tenantContext } from '../../../infrastructure/prisma/tenantContext.js';

/**
 * Sets AsyncLocalStorage tenant context so every Prisma query within the request
 * picks up the correct tenant_id for RLS enforcement.
 *
 * Uses enterWith() instead of run() because run() limits the ALS scope to its
 * callback — the scope would end before the route handler executes. enterWith()
 * sets the store for the current async context AND all async operations that
 * derive from it, including the route handler that Fastify awaits next.
 *
 * Must be registered AFTER authPlugin so request.tenantId is already populated
 * when addHook('preHandler') fires.
 */
const rlsPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const tenantId = request.tenantId; // set by authPlugin from JWT tid claim
      if (!tenantId) return;
      // enterWith() persists the ALS store for the remainder of this async context
      // chain, so the route handler (which Fastify awaits after this hook) will
      // read the correct tenantId from getCurrentTenantId().
      tenantContext.enterWith(tenantId);
    },
  );
};

export const rlsPlugin = fp(rlsPluginImpl, {
  name: 'rlsPlugin',
  fastify: '4.x',
});
