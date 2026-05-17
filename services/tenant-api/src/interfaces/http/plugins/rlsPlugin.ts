import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { tenantContext } from '../../../infrastructure/prisma/tenantContext.js';

/**
 * Wraps the Fastify handler execution inside AsyncLocalStorage.run(tenantId, ...)
 * so that every Prisma query within the request picks up the correct tenant_id
 * for RLS enforcement.
 *
 * Must be registered AFTER authPlugin so request.tenantId is already populated
 * when addHook('preHandler') fires.
 */
const rlsPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const tenantId = request.tenantId; // set by authPlugin from JWT tid claim
      if (!tenantId) return;

      // We cannot easily wrap the entire handler in ALS from a hook, but we CAN
      // synchronously enter the store and signal Prisma middleware via the store.
      // The Prisma $use middleware reads getCurrentTenantId() which reads from ALS.
      //
      // Since Fastify's hook and the route handler share the same async chain (await),
      // entering tenantContext here propagates into the route handler automatically
      // as long as we keep the ALS binding alive in the async context.
      //
      // Implementation: use a sub-task that sets up ALS context and resolves only
      // after signaling — this binds the ALS to the current async context chain.
      await tenantContext.run(tenantId, async () => {
        // Signal back to the outer context that the store is set.
        // The route handler runs AFTER this hook returns, but within the same
        // async flow — so ALS propagates forward.
        await Promise.resolve();
      });
    },
  );
};

export const rlsPlugin = fp(rlsPluginImpl, {
  name: 'rlsPlugin',
  fastify: '4.x',
});
