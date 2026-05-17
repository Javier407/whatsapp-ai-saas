import type { IFlowRepo } from '../../domain/ports/IFlowRepo.js';
import type { Flow, FlowWithNodes } from '../../domain/models/Flow.js';
import { NotFoundError } from '../../domain/errors.js';

export class GetFlowUseCase {
  constructor(private readonly flowRepo: IFlowRepo) {}

  async execute(tenantId: string, flowId: string): Promise<FlowWithNodes> {
    const flow = await this.flowRepo.findById(flowId);
    if (!flow || flow.tenantId !== tenantId) {
      throw new NotFoundError('Flow', flowId);
    }
    return flow;
  }
}

export class ListFlowsUseCase {
  constructor(private readonly flowRepo: IFlowRepo) {}

  async execute(tenantId: string): Promise<Flow[]> {
    return this.flowRepo.listByTenant(tenantId);
  }
}
