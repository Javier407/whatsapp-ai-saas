import type { FastifyPluginAsync } from 'fastify';
import type { ListConversationsUseCase } from '../../../application/conversations/ListConversationsUseCase.js';
import type { IFlowEngineClient } from '../../../domain/ports/IFlowEngineClient.js';
import { ok, sendDomainError } from '../reply.js';

interface ConversationRoutesDeps {
  listConversationsUseCase: ListConversationsUseCase;
  flowEngineClient: IFlowEngineClient;
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

      ok(
        reply,
        result.data.map((l) => ({
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
      );
    } catch (err) {
      sendDomainError(reply, err);
    }
  });

  /** GET /api/v1/conversations/:wa_id/state — bot vs human-handoff status */
  fastify.get<{
    Params: { wa_id: string };
  }>('/:wa_id/state', async (request, reply) => {
    try {
      const state = await opts.flowEngineClient.getSessionState(
        request.tenantId,
        request.params.wa_id,
      );
      ok(reply, state);
    } catch (err) {
      sendDomainError(reply, err);
    }
  });

  /** POST /api/v1/conversations/:wa_id/reply — agent reply during handoff */
  fastify.post<{
    Params: { wa_id: string };
    Body: { message: string };
  }>('/:wa_id/reply', async (request, reply) => {
    try {
      const message = (request.body?.message ?? '').trim();
      if (!message) {
        return reply.status(400).send({
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'message must not be empty' },
        });
      }
      await opts.flowEngineClient.sendAgentReply(request.tenantId, request.params.wa_id, message);
      ok(reply, { status: 'sent' });
    } catch (err) {
      sendDomainError(reply, err);
    }
  });

  /** POST /api/v1/conversations/:wa_id/resume — hand control back to the bot */
  fastify.post<{
    Params: { wa_id: string };
  }>('/:wa_id/resume', async (request, reply) => {
    try {
      await opts.flowEngineClient.resumeHandoff(request.tenantId, request.params.wa_id);
      ok(reply, { status: 'resumed' });
    } catch (err) {
      sendDomainError(reply, err);
    }
  });
};
