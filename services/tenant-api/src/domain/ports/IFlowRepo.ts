import type { Flow, FlowWithNodes, NodeType, Transition } from '../models/Flow.js';

export interface CreateFlowNodeInput {
  nodeKey: string;
  type: NodeType;
  config: Record<string, unknown>;
  transitions: Transition[];
  /** UI-only presentation state (e.g. canvas position). Optional on input; defaults to {}. */
  meta?: Record<string, unknown>;
}

export interface CreateFlowInput {
  tenantId: string;
  name: string;
  description?: string;
  trigger: Record<string, unknown>;
  entryNode: string;
  nodes: CreateFlowNodeInput[];
}

export interface UpdateFlowInput {
  name?: string;
  description?: string;
  trigger?: Record<string, unknown>;
  entryNode?: string;
  nodes?: CreateFlowNodeInput[];
}

export interface IFlowRepo {
  findById(id: string): Promise<FlowWithNodes | null>;
  findByIdForTenant(tenantId: string, flowId: string): Promise<FlowWithNodes | null>;
  listByTenant(tenantId: string): Promise<Flow[]>;
  create(input: CreateFlowInput): Promise<FlowWithNodes>;
  /** Creates a new version of the flow; increments version number.
   *  tenantId scopes the RLS transaction (the id-only lookup runs under RLS). */
  createNewVersion(tenantId: string, id: string, input: UpdateFlowInput): Promise<FlowWithNodes>;
  setActive(tenantId: string, id: string, isActive: boolean): Promise<Flow>;
  /** Deactivate all flows whose trigger overlaps with the given one. */
  deactivateByTrigger(tenantId: string, excludeId: string): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}
