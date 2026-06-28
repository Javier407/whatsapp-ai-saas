// Native ESM jest does not inject the `jest` global; it must be imported.
import { jest } from '@jest/globals';
import { UpdateFlowUseCase } from '../../src/application/flows/UpdateFlowUseCase.js';
import { NotFoundError, ValidationError } from '../../src/domain/errors.js';
import type { IFlowRepo, UpdateFlowInput } from '../../src/domain/ports/IFlowRepo.js';
import type { IFlowEngineClient } from '../../src/domain/ports/IFlowEngineClient.js';
import type { FlowWithNodes } from '../../src/domain/models/Flow.js';

const OWNER_TENANT = 'tenant-a';
const OTHER_TENANT = 'tenant-b';

const EXISTING: FlowWithNodes = {
  id: 'flow-1',
  tenantId: OWNER_TENANT,
  name: 'Welcome',
  description: null,
  trigger: {},
  entryNode: 'start',
  isActive: false,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  nodes: [
    {
      id: 'node-1',
      flowId: 'flow-1',
      tenantId: OWNER_TENANT,
      nodeKey: 'start',
      type: 'end',
      config: {},
      transitions: [],
      createdAt: new Date(),
    },
  ],
};

function makeFlowRepo(overrides: Partial<IFlowRepo> = {}): IFlowRepo {
  return {
    findById: jest.fn(),
    findByIdForTenant: jest.fn(),
    listByTenant: jest.fn(),
    create: jest.fn(),
    createNewVersion: jest.fn(),
    setActive: jest.fn(),
    deactivateByTrigger: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  };
}

function makeEngineClient(overrides: Partial<IFlowEngineClient> = {}): IFlowEngineClient {
  return {
    reloadTenantFlows: jest.fn().mockResolvedValue(undefined),
    dryRun: jest.fn(),
    sendAgentReply: jest.fn().mockResolvedValue(undefined),
    resumeHandoff: jest.fn().mockResolvedValue(undefined),
    getSessionState: jest.fn().mockResolvedValue({ state: null, handoff: false }),
    ...overrides,
  };
}

describe('UpdateFlowUseCase', () => {
  it('throws NotFoundError and never persists when the flow does not exist', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(null);
    const createNewVersion = jest.fn();
    const useCase = new UpdateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, createNewVersion }),
      makeEngineClient(),
    );

    await expect(useCase.execute(OWNER_TENANT, 'ghost', { name: 'x' })).rejects.toThrow(
      NotFoundError,
    );
    expect(createNewVersion).not.toHaveBeenCalled();
  });

  // Tenant isolation: same real flowId, different tenant → NotFoundError, and no
  // write ever reaches another tenant's flow.
  it('rejects a cross-tenant flowId as NotFoundError (tenant isolation)', async () => {
    const findByIdForTenant = jest.fn(async (tenantId: string, flowId: string) =>
      tenantId === EXISTING.tenantId && flowId === EXISTING.id ? EXISTING : null,
    );
    const createNewVersion = jest.fn();
    const useCase = new UpdateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, createNewVersion }),
      makeEngineClient(),
    );

    await expect(useCase.execute(OTHER_TENANT, EXISTING.id, { name: 'x' })).rejects.toThrow(
      NotFoundError,
    );
    expect(createNewVersion).not.toHaveBeenCalled();
  });

  it('validates the merged graph then persists a new version when valid', async () => {
    const updated: FlowWithNodes = { ...EXISTING, version: 2, name: 'Renamed' };
    const findByIdForTenant = jest.fn().mockResolvedValue(EXISTING);
    const createNewVersion = jest.fn().mockResolvedValue(updated);
    const input: UpdateFlowInput = { name: 'Renamed' };
    const useCase = new UpdateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, createNewVersion }),
      makeEngineClient(),
    );

    const result = await useCase.execute(OWNER_TENANT, EXISTING.id, input);

    expect(result).toBe(updated);
    expect(createNewVersion).toHaveBeenCalledWith(EXISTING.id, input);
  });

  it('validates BEFORE persisting — an invalid merged graph throws and skips createNewVersion', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(EXISTING);
    const createNewVersion = jest.fn();
    // entryNode override targets a node that is not present in the merged graph.
    const input: UpdateFlowInput = { entryNode: 'ghost' };
    const useCase = new UpdateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, createNewVersion }),
      makeEngineClient(),
    );

    await expect(useCase.execute(OWNER_TENANT, EXISTING.id, input)).rejects.toThrow(
      ValidationError,
    );
    expect(createNewVersion).not.toHaveBeenCalled();
  });

  it('merges input.nodes against the existing entryNode when entryNode is omitted', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(EXISTING);
    const createNewVersion = jest.fn();
    // New nodes drop the existing entryNode ('start'), so the merged graph has an
    // entry node that no longer exists → ValidationError. This only fails if the
    // use case merged input.nodes with the *existing* entryNode.
    const input: UpdateFlowInput = {
      nodes: [{ nodeKey: 'other', type: 'end', config: {}, transitions: [] }],
    };
    const useCase = new UpdateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, createNewVersion }),
      makeEngineClient(),
    );

    await expect(useCase.execute(OWNER_TENANT, EXISTING.id, input)).rejects.toThrow(
      ValidationError,
    );
    expect(createNewVersion).not.toHaveBeenCalled();
  });

  it('does not fail the request when the best-effort engine reload rejects', async () => {
    const updated: FlowWithNodes = { ...EXISTING, version: 2 };
    const findByIdForTenant = jest.fn().mockResolvedValue(EXISTING);
    const createNewVersion = jest.fn().mockResolvedValue(updated);
    const reloadTenantFlows = jest.fn().mockRejectedValue(new Error('engine down'));
    const useCase = new UpdateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, createNewVersion }),
      makeEngineClient({ reloadTenantFlows }),
    );

    await expect(useCase.execute(OWNER_TENANT, EXISTING.id, { name: 'x' })).resolves.toBe(updated);
    expect(reloadTenantFlows).toHaveBeenCalledWith(OWNER_TENANT);
  });
});
