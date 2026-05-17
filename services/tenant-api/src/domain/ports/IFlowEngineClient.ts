export interface DryRunResult {
  reply: string;
  flow_id: string | null;
  trace: unknown[];
}

export interface IFlowEngineClient {
  reloadTenantFlows(tenantId: string): Promise<void>;
  dryRun(tenantId: string, message: string, simulatedWaId: string): Promise<DryRunResult>;
}
