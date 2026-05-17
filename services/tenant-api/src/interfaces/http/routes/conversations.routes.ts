import type { FastifyPluginAsync } from 'fastify';
import type { ListConversationsUseCase } from '../../../application/conversations/ListConversationsUseCase.js';
import { ok, sendDomainError } from '../reply.js';

interface ConversationRoutesDeps {
  listConversationsUseCase: ListConversationsUseCase;
}

export const conversationsRoutes: FastifyPluginAsync<ConversationRoutesDeps> = async (
  fastify,
  opts,
) => {
  fastify.addHook('preHandler', fastify.authenticate);

  /** GET /api/v1/conversations */
  fastify.get<{
    Querystring: {
      wa_id?: string;
      from?: string;
      to?: string;
      limit?: string;
      offset?: string;
    };
  }>('/', async (request, reply) => {
    try {
      const result = await opts.listConversationsUseCase.execute({
        tenantId: request.tenantId,
        waId: request.query.wa_id,
        from: request.query.from,
        to: request.query.to,
        limit: request.query.limit ? parseInt(request.query.limit, 10) : undefined,
        offset: request.query.offset ? parseInt(request.query.offset, 10) : undefined,
      });

      ok(reply, {
        data: result.data.map((l) => ({
          id: l.id.toString(),
          wa_id: l.waId,
          direction: l.direction,
          message_type: l.messageType,
          content: l.content,
          flow_id: l.flowId,
          node_key: l.nodeKey,
          llm_tokens: l.llmTokens,
          latency_ms: l.latencyMs,
          created_at: l.createdAt,
        })),
        meta: result.meta,
      });
    } catch (err) {
      sendDomainError(reply, err);
    }
  });
};
