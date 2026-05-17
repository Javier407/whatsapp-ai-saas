import type { IFlowEngineClient, DryRunResult } from '../../domain/ports/IFlowEngineClient.js';

export interface DryRunInput {
  tenantId: string;
  message: string;
  simulatedWaId: string;
}

export class DryRunUseCase {
  constructor(private readonly flowEngineClient: IFlowEngineClient) {}

  async execute(input: DryRunInput): Promise<DryRunResult> {
    return this.flowEngineClient.dryRun(
      input.tenantId,
      input.message,
      input.simulatedWaId,
    );
  }
}
