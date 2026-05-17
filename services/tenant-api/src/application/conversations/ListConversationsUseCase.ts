import type { IConvLogRepo, ListConvLogsFilter, PaginatedResult } from '../../domain/ports/IConvLogRepo.js';
import type { ConversationLog } from '../../domain/models/ConversationLog.js';
import { ValidationError } from '../../domain/errors.js';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export interface ListConversationsInput {
  tenantId: string;
  waId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export class ListConversationsUseCase {
  constructor(private readonly convLogRepo: IConvLogRepo) {}

  async execute(input: ListConversationsInput): Promise<PaginatedResult<ConversationLog>> {
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = input.offset ?? 0;

    const filter: ListConvLogsFilter = {
      tenantId: input.tenantId,
      limit,
      offset,
    };

    if (input.waId) filter.waId = input.waId;

    if (input.from) {
      const from = new Date(input.from);
      if (isNaN(from.getTime())) throw new ValidationError(`Invalid 'from' date: ${input.from}`);
      filter.from = from;
    }

    if (input.to) {
      const to = new Date(input.to);
      if (isNaN(to.getTime())) throw new ValidationError(`Invalid 'to' date: ${input.to}`);
      filter.to = to;
    }

    return this.convLogRepo.list(filter);
  }
}
