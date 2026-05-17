import type { IFlowRepo, CreateFlowInput } from '../../domain/ports/IFlowRepo.js';
import type { IFlowEngineClient } from '../../domain/ports/IFlowEngineClient.js';
import type { FlowWithNodes } from '../../domain/models/Flow.js';
import { FlowGraphValidator } from './FlowGraphValidator.js';

export class CreateFlowUseCase {
  private readonly validator = new FlowGraphValidator();

  constructor(
    private readonly flowRepo: IFlowRepo,
    private readonly flowEngineClient: IFlowEngineClient,
  ) {}

  async execute(tenantId: string, input: Omit<CreateFlowInput, 'tenantId'>): Promise<FlowWithNodes> {
    this.validator.validate({ entryNode: input.entryNode, nodes: input.nodes });

    const flow = await this.flowRepo.create({ ...input, tenantId });

    // Best-effort cache invalidation — don't fail the request if flow-engine is down
    this.flowEngineClient.reloadTenantFlows(tenantId).catch(() => undefined);

    return flow;
  }
}
