import type { PrismaClient } from '@prisma/client';
import type {
  IFlowRepo,
  CreateFlowInput,
  UpdateFlowInput,
} from '../../domain/ports/IFlowRepo.js';
import type { Flow, FlowNode, FlowWithNodes, Transition } from '../../domain/models/Flow.js';

function mapNode(row: {
  id: string;
  flowId: string;
  tenantId: string;
  nodeKey: string;
  type: string;
  config: unknown;
  transitions: unknown;
  createdAt: Date;
}): FlowNode {
  return {
    id: row.id,
    flowId: row.flowId,
    tenantId: row.tenantId,
    nodeKey: row.nodeKey,
    type: row.type as FlowNode['type'],
    config: row.config as Record<string, unknown>,
    transitions: row.transitions as Transition[],
    createdAt: row.createdAt,
  };
}

function mapFlow(row: {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  trigger: unknown;
  entryNode: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): Flow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    trigger: row.trigger as Record<string, unknown>,
    entryNode: row.entryNode,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapFlowWithNodes(
  row: Parameters<typeof mapFlow>[0] & { nodes: Parameters<typeof mapNode>[0][] },
): FlowWithNodes {
  return { ...mapFlow(row), nodes: row.nodes.map(mapNode) };
}

export class PrismaFlowRepo implements IFlowRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<FlowWithNodes | null> {
    const row = await this.prisma.flow.findUnique({
      where: { id },
      include: { nodes: true },
    });
    return row ? mapFlowWithNodes(row) : null;
  }

  async listByTenant(tenantId: string): Promise<Flow[]> {
    const rows = await this.prisma.flow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapFlow);
  }

  async create(input: CreateFlowInput): Promise<FlowWithNodes> {
    const row = await this.prisma.flow.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        trigger: input.trigger as never,
        entryNode: input.entryNode,
        nodes: {
          create: input.nodes.map((n) => ({
            tenantId: input.tenantId,
            nodeKey: n.nodeKey,
            type: n.type as never,
            config: n.config as never,
            transitions: n.transitions as never,
          })),
        },
      },
      include: { nodes: true },
    });
    return mapFlowWithNodes(row);
  }

  async createNewVersion(id: string, input: UpdateFlowInput): Promise<FlowWithNodes> {
    const existing = await this.prisma.flow.findUniqueOrThrow({
      where: { id },
      include: { nodes: true },
    });

    const newVersion = existing.version + 1;
    const nodes = input.nodes ?? existing.nodes.map((n) => ({
      nodeKey: n.nodeKey,
      type: n.type as FlowNode['type'],
      config: n.config as Record<string, unknown>,
      transitions: n.transitions as unknown as Transition[],
    }));

    const row = await this.prisma.flow.create({
      data: {
        tenantId: existing.tenantId,
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        trigger: (input.trigger ?? existing.trigger) as never,
        entryNode: input.entryNode ?? existing.entryNode,
        isActive: false,
        version: newVersion,
        nodes: {
          create: nodes.map((n) => ({
            tenantId: existing.tenantId,
            nodeKey: n.nodeKey,
            type: n.type as never,
            config: n.config as never,
            transitions: n.transitions as never,
          })),
        },
      },
      include: { nodes: true },
    });

    return mapFlowWithNodes(row);
  }

  async setActive(id: string, isActive: boolean): Promise<Flow> {
    const row = await this.prisma.flow.update({
      where: { id },
      data: { isActive, updatedAt: new Date() },
    });
    return mapFlow(row);
  }

  async deactivateByTrigger(tenantId: string, excludeId: string): Promise<void> {
    await this.prisma.flow.updateMany({
      where: { tenantId, isActive: true, id: { not: excludeId } },
      data: { isActive: false, updatedAt: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.flow.delete({ where: { id } });
  }
}
