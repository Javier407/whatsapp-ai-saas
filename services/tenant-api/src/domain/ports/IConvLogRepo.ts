import type { ConversationLog } from '../models/ConversationLog.js';

export interface ListConvLogsFilter {
  tenantId: string;
  waId?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface IConvLogRepo {
  list(filter: ListConvLogsFilter): Promise<PaginatedResult<ConversationLog>>;
}
