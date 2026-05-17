import type { IFlowRepo } from '../../domain/ports/IFlowRepo.js';
import type { IFlowEngineClient } from '../../domain/ports/IFlowEngineClient.js';
import type { Flow } from '../../domain/models/Flow.js';
import { NotFoundError } from '../../domain/errors.js';

export class ActivateFlowUseCase {
  constructor(
    private readonly flowRepo: IFlowRepo,
    private readonly flowEngineClient: IFlowEngineClient,
  ) {}

  async execute(tenantId: string, flowId: string): Promise<Flow> {
    const existing = await this.flowRepo.findById(flowId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundError('Flow', flowId);
    }

    // Deactivate other flows with overlapping triggers before activating this one
    await this.flowRepo.deactivateByTrigger(tenantId, flowId);
    const flow = await this.flowRepo.setActive(flowId, true);

    this.flowEngineClient.reloadTenantFlows(tenantId).catch(() => undefined);

    return flow;
  }
}
