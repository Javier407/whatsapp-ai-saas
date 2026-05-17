export type Direction = 'inbound' | 'outbound';

export interface ConversationLog {
  id: bigint;
  tenantId: string;
  waId: string;
  direction: Direction;
  messageType: string;
  content: Record<string, unknown>;
  flowId: string | null;
  nodeKey: string | null;
  llmTokens: number | null;
  latencyMs: number | null;
  createdAt: Date;
}
