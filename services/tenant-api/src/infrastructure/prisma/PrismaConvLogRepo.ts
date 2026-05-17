import type { PrismaClient } from '@prisma/client';
import type { IConvLogRepo, ListConvLogsFilter, PaginatedResult } from '../../domain/ports/IConvLogRepo.js';
import type { ConversationLog } from '../../domain/models/ConversationLog.js';

function mapLog(row: {
  id: bigint;
  tenantId: string;
  waId: string;
  direction: string;
  messageType: string;
  content: unknown;
  flowId: string | null;
  nodeKey: string | null;
  llmTokens: number | null;
  latencyMs: number | null;
  createdAt: Date;
}): ConversationLog {
  return {
    id: row.id,
    tenantId: row.tenantId,
    waId: row.waId,
    direction: row.direction as ConversationLog['direction'],
    messageType: row.messageType,
    content: row.content as Record<string, unknown>,
    flowId: row.flowId,
    nodeKey: row.nodeKey,
    llmTokens: row.llmTokens,
    latencyMs: row.latencyMs,
    createdAt: row.createdAt,
  };
}

export class PrismaConvLogRepo implements IConvLogRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: ListConvLogsFilter): Promise<PaginatedResult<ConversationLog>> {
    const where = {
      tenantId: filter.tenantId,
      ...(filter.waId && { waId: filter.waId }),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from && { gte: filter.from }),
              ...(filter.to && { lte: filter.to }),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.conversationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
      }),
      this.prisma.conversationLog.count({ where }),
    ]);

    return {
      data: rows.map(mapLog),
      meta: { total, limit: filter.limit, offset: filter.offset },
    };
  }
}
