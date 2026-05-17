import type { IFlowRepo, UpdateFlowInput } from '../../domain/ports/IFlowRepo.js';
import type { IFlowEngineClient } from '../../domain/ports/IFlowEngineClient.js';
import type { FlowWithNodes } from '../../domain/models/Flow.js';
import { FlowGraphValidator } from './FlowGraphValidator.js';
import { NotFoundError } from '../../domain/errors.js';

export class UpdateFlowUseCase {
  private readonly validator = new FlowGraphValidator();

  constructor(
    private readonly flowRepo: IFlowRepo,
    private readonly flowEngineClient: IFlowEngineClient,
  ) {}

  async execute(
    tenantId: string,
    flowId: string,
    input: UpdateFlowInput,
  ): Promise<FlowWithNodes> {
    const existing = await this.flowRepo.findById(flowId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundError('Flow', flowId);
    }

    // Validate the merged graph before creating a new version
    const nodes = input.nodes ?? existing.nodes;
    const entryNode = input.entryNode ?? existing.entryNode;
    this.validator.validate({ entryNode, nodes });

    const updated = await this.flowRepo.createNewVersion(flowId, input);

    this.flowEngineClient.reloadTenantFlows(tenantId).catch(() => undefined);

    return updated;
  }
}
