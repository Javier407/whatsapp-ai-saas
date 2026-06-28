// Native ESM jest does not inject the `jest` global; it must be imported.
import { jest } from '@jest/globals';
import { DeleteFlowUseCase } from '../../src/application/flows/DeleteFlowUseCase.js';
import { NotFoundError } from '../../src/domain/errors.js';
import type { IFlowRepo } from '../../src/domain/ports/IFlowRepo.js';
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
    ...overrides,
  };
}

describe('DeleteFlowUseCase', () => {
  it('throws NotFoundError and deletes nothing when the flow does not exist', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(null);
    const del = jest.fn();
    const useCase = new DeleteFlowUseCase(
      makeFlowRepo({ findByIdForTenant, delete: del }),
      makeEngineClient(),
    );

    await expect(useCase.execute(OWNER_TENANT, 'ghost')).rejects.toThrow(NotFoundError);
    expect(del).not.toHaveBeenCalled();
  });

  // Tenant isolation: deleting another tenant's flow must be impossible, and the
  // attempt must look exactly like deleting something that never existed.
  it('rejects a cross-tenant flowId as NotFoundError (tenant isolation)', async () => {
    const findByIdForTenant = jest.fn(async (tenantId: string, flowId: string) =>
      tenantId === EXISTING.tenantId && flowId === EXISTING.id ? EXISTING : null,
    );
    const del = jest.fn();
    const useCase = new DeleteFlowUseCase(
      makeFlowRepo({ findByIdForTenant, delete: del }),
      makeEngineClient(),
    );

    await expect(useCase.execute(OTHER_TENANT, EXISTING.id)).rejects.toThrow(NotFoundError);
    expect(del).not.toHaveBeenCalled();
  });

  it('deletes the flow and triggers an engine reload', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(EXISTING);
    const del = jest.fn().mockResolvedValue(undefined);
    const reloadTenantFlows = jest.fn().mockResolvedValue(undefined);
    const useCase = new DeleteFlowUseCase(
      makeFlowRepo({ findByIdForTenant, delete: del }),
      makeEngineClient({ reloadTenantFlows }),
    );

    await expect(useCase.execute(OWNER_TENANT, EXISTING.id)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith(EXISTING.id);
    expect(reloadTenantFlows).toHaveBeenCalledWith(OWNER_TENANT);
  });

  it('does not fail the request when the best-effort engine reload rejects', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(EXISTING);
    const del = jest.fn().mockResolvedValue(undefined);
    const reloadTenantFlows = jest.fn().mockRejectedValue(new Error('engine down'));
    const useCase = new DeleteFlowUseCase(
      makeFlowRepo({ findByIdForTenant, delete: del }),
      makeEngineClient({ reloadTenantFlows }),
    );

    await expect(useCase.execute(OWNER_TENANT, EXISTING.id)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith(EXISTING.id);
  });
});
