export type NodeType =
  | 'message'
  | 'interactive'
  | 'collect_input'
  | 'condition'
  | 'rag_lookup'
  | 'llm_generate'
  | 'api_call'
  | 'end';

export interface Transition {
  next: string;
  condition?: string;
}

export interface FlowNode {
  id: string;
  flowId: string;
  tenantId: string;
  nodeKey: string;
  type: NodeType;
  config: Record<string, unknown>;
  transitions: Transition[];
  createdAt: Date;
}

export interface Flow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  trigger: Record<string, unknown>;
  entryNode: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlowWithNodes extends Flow {
  nodes: FlowNode[];
}
