import type { IFlowRepo } from '../../domain/ports/IFlowRepo.js';
import type { IFlowEngineClient } from '../../domain/ports/IFlowEngineClient.js';
import { NotFoundError } from '../../domain/errors.js';

export class DeleteFlowUseCase {
  constructor(
    private readonly flowRepo: IFlowRepo,
    private readonly flowEngineClient: IFlowEngineClient,
  ) {}

  async execute(tenantId: string, flowId: string): Promise<void> {
    const existing = await this.flowRepo.findById(flowId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundError('Flow', flowId);
    }

    await this.flowRepo.delete(flowId);
    this.flowEngineClient.reloadTenantFlows(tenantId).catch(() => undefined);
  }
}
