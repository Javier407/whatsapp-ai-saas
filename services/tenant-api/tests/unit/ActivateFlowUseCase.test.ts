// Native ESM jest does not inject the `jest` global; it must be imported.
import { jest } from '@jest/globals';
import { ActivateFlowUseCase } from '../../src/application/flows/ActivateFlowUseCase.js';
import { NotFoundError } from '../../src/domain/errors.js';
import type { IFlowRepo } from '../../src/domain/ports/IFlowRepo.js';
import type { IFlowEngineClient } from '../../src/domain/ports/IFlowEngineClient.js';
import type { Flow, FlowWithNodes } from '../../src/domain/models/Flow.js';

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

const ACTIVATED: Flow = { ...EXISTING, isActive: true };

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
    ...overrides,
  };
}

describe('ActivateFlowUseCase', () => {
  it('throws NotFoundError and activates nothing when the flow does not exist', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(null);
    const deactivateByTrigger = jest.fn();
    const setActive = jest.fn();
    const useCase = new ActivateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, deactivateByTrigger, setActive }),
      makeEngineClient(),
    );

    await expect(useCase.execute(OWNER_TENANT, 'ghost')).rejects.toThrow(NotFoundError);
    expect(deactivateByTrigger).not.toHaveBeenCalled();
    expect(setActive).not.toHaveBeenCalled();
  });

  // Tenant isolation: a flow owned by another tenant cannot be activated, and the
  // failure is a NotFoundError indistinguishable from a missing flow.
  it('rejects a cross-tenant flowId as NotFoundError (tenant isolation)', async () => {
    const findByIdForTenant = jest.fn(async (tenantId: string, flowId: string) =>
      tenantId === EXISTING.tenantId && flowId === EXISTING.id ? EXISTING : null,
    );
    const setActive = jest.fn();
    const useCase = new ActivateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, setActive }),
      makeEngineClient(),
    );

    await expect(useCase.execute(OTHER_TENANT, EXISTING.id)).rejects.toThrow(NotFoundError);
    expect(setActive).not.toHaveBeenCalled();
  });

  it('deactivates overlapping triggers BEFORE activating this flow', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(EXISTING);
    const deactivateByTrigger = jest.fn().mockResolvedValue(undefined);
    const setActive = jest.fn().mockResolvedValue(ACTIVATED);
    const useCase = new ActivateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, deactivateByTrigger, setActive }),
      makeEngineClient(),
    );

    const result = await useCase.execute(OWNER_TENANT, EXISTING.id);

    expect(result).toBe(ACTIVATED);
    expect(deactivateByTrigger).toHaveBeenCalledWith(OWNER_TENANT, EXISTING.id);
    expect(setActive).toHaveBeenCalledWith(EXISTING.id, true);
    // Order matters: peers must be deactivated before this flow is set active,
    // otherwise two flows with the same trigger could be active at once.
    expect(deactivateByTrigger.mock.invocationCallOrder[0]!).toBeLessThan(
      setActive.mock.invocationCallOrder[0]!,
    );
  });

  it('does not fail the request when the best-effort engine reload rejects', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(EXISTING);
    const deactivateByTrigger = jest.fn().mockResolvedValue(undefined);
    const setActive = jest.fn().mockResolvedValue(ACTIVATED);
    const reloadTenantFlows = jest.fn().mockRejectedValue(new Error('engine down'));
    const useCase = new ActivateFlowUseCase(
      makeFlowRepo({ findByIdForTenant, deactivateByTrigger, setActive }),
      makeEngineClient({ reloadTenantFlows }),
    );

    await expect(useCase.execute(OWNER_TENANT, EXISTING.id)).resolves.toBe(ACTIVATED);
    expect(reloadTenantFlows).toHaveBeenCalledWith(OWNER_TENANT);
  });
});
