// Native ESM jest does not inject the `jest` global; it must be imported.
import { jest } from '@jest/globals';
import { PrismaFlowRepo } from '../../src/infrastructure/prisma/PrismaFlowRepo.js';
import type { PrismaClient } from '@prisma/client';

interface NodeRow {
  id: string;
  flowId: string;
  tenantId: string;
  nodeKey: string;
  type: string;
  config: unknown;
  transitions: unknown;
  meta: unknown;
  createdAt: Date;
}

function nodeRow(meta: unknown): NodeRow {
  return {
    id: 'node-1',
    flowId: 'flow-1',
    tenantId: 'tenant-1',
    nodeKey: 'start',
    type: 'message',
    config: {},
    transitions: [],
    meta,
    createdAt: new Date(),
  };
}

function flowRow(nodes: NodeRow[]) {
  return {
    id: 'flow-1',
    tenantId: 'tenant-1',
    name: 'F',
    description: null,
    trigger: {},
    entryNode: 'start',
    isActive: false,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    nodes,
  };
}

function makeRepo(createReturn: ReturnType<typeof flowRow>) {
  const create = jest.fn(async () => createReturn);
  // The repo now wraps writes in withRls -> prisma.$transaction(fn), running the
  // query on the transaction client. Mock $transaction to invoke the callback
  // with a tx that exposes the same flow.create spy + the SET LOCAL raw call.
  const tx = { $executeRawUnsafe: jest.fn(async () => 0), flow: { create } };
  const prisma = {
    flow: { create },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaClient;
  return { repo: new PrismaFlowRepo(prisma), create };
}

describe('PrismaFlowRepo — meta column', () => {
  it('passes node meta through to the create payload and returns it', async () => {
    const position = { position: { x: 10, y: 20 } };
    const { repo, create } = makeRepo(flowRow([nodeRow(position)]));

    const result = await repo.create({
      tenantId: '11111111-1111-1111-1111-111111111111',
      name: 'F',
      trigger: {},
      entryNode: 'start',
      nodes: [{ nodeKey: 'start', type: 'message', config: {}, transitions: [], meta: position }],
    });

    expect(result.nodes[0]!.meta).toEqual(position);
    // meta reached the Prisma write payload
    const arg = create.mock.calls[0]![0] as { data: { nodes: { create: Array<{ meta?: unknown }> } } };
    expect(arg.data.nodes.create[0]!.meta).toEqual(position);
  });

  it('defaults to {} when meta is omitted on input and null in the row', async () => {
    // DB returns null meta for a row created before/without an explicit value
    const { repo, create } = makeRepo(flowRow([nodeRow(null)]));

    const result = await repo.create({
      tenantId: '11111111-1111-1111-1111-111111111111',
      name: 'F',
      trigger: {},
      entryNode: 'start',
      nodes: [{ nodeKey: 'start', type: 'message', config: {}, transitions: [] }],
    });

    expect(result.nodes[0]!.meta).toEqual({});
    // meta omitted from the payload so the column DEFAULT '{}' applies
    const arg = create.mock.calls[0]![0] as { data: { nodes: { create: Array<{ meta?: unknown }> } } };
    expect(arg.data.nodes.create[0]!.meta).toBeUndefined();
  });
});
