export interface DryRunResult {
  reply: string;
  flow_id: string | null;
  trace: unknown[];
}

export interface IFlowEngineClient {
  reloadTenantFlows(tenantId: string): Promise<void>;
  dryRun(tenantId: string, message: string, simulatedWaId: string): Promise<DryRunResult>;
  /** Send an agent's reply to the customer as the business (during handoff). */
  sendAgentReply(tenantId: string, waId: string, message: string): Promise<void>;
  /** Hand the conversation back to the bot (clear HUMAN_HANDOFF). */
  resumeHandoff(tenantId: string, waId: string): Promise<void>;
}
