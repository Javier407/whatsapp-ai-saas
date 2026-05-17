import type { FastifyPluginAsync } from 'fastify';
import type { DryRunUseCase } from '../../../application/dryrun/DryRunUseCase.js';
import { ok, sendDomainError } from '../reply.js';

interface DryRunRoutesDeps {
  dryRunUseCase: DryRunUseCase;
}

export const dryrunRoutes: FastifyPluginAsync<DryRunRoutesDeps> = async (fastify, opts) => {
  fastify.addHook('preHandler', fastify.authenticate);

  /** POST /api/v1/dry-run */
  fastify.post<{
    Body: { message: string; simulated_wa_id: string };
  }>('/', async (request, reply) => {
    try {
      const result = await opts.dryRunUseCase.execute({
        tenantId: request.tenantId,
        message: request.body.message,
        simulatedWaId: request.body.simulated_wa_id,
      });
      ok(reply, result);
    } catch (err) {
      sendDomainError(reply, err);
    }
  });
};
