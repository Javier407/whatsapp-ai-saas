// Native ESM jest does not inject the `jest` global; it must be imported.
import { jest } from '@jest/globals';
import { GetFlowUseCase, ListFlowsUseCase } from '../../src/application/flows/GetFlowUseCase.js';
import { NotFoundError } from '../../src/domain/errors.js';
import type { IFlowRepo } from '../../src/domain/ports/IFlowRepo.js';
import type { Flow, FlowWithNodes } from '../../src/domain/models/Flow.js';

const OWNER_TENANT = 'tenant-a';
const OTHER_TENANT = 'tenant-b';

const FLOW: FlowWithNodes = {
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

describe('GetFlowUseCase', () => {
  it('returns the flow looked up via the tenant-scoped finder', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(FLOW);
    const useCase = new GetFlowUseCase(makeFlowRepo({ findByIdForTenant }));

    const result = await useCase.execute(OWNER_TENANT, FLOW.id);

    expect(result).toBe(FLOW);
    expect(findByIdForTenant).toHaveBeenCalledWith(OWNER_TENANT, FLOW.id);
  });

  it('throws NotFoundError when the flow does not exist', async () => {
    const findByIdForTenant = jest.fn().mockResolvedValue(null);
    const useCase = new GetFlowUseCase(makeFlowRepo({ findByIdForTenant }));

    await expect(useCase.execute(OWNER_TENANT, 'ghost')).rejects.toThrow(NotFoundError);
  });

  // Tenant isolation: a flow owned by another tenant must be indistinguishable
  // from a non-existent one. The use case leans on the tenant-scoped finder and
  // surfaces NotFoundError (NOT ForbiddenError), so a foreign flow's existence
  // never leaks across the tenant boundary.
  it('rejects a cross-tenant flowId as NotFoundError (tenant isolation)', async () => {
    // The mock encodes the repo's contract: findByIdForTenant only resolves the
    // flow for its owning tenant; every other tenant sees null.
    const findByIdForTenant = jest.fn(async (tenantId: string, flowId: string) =>
      tenantId === FLOW.tenantId && flowId === FLOW.id ? FLOW : null,
    );
    const repo = makeFlowRepo({ findByIdForTenant });

    // A real, existing flowId — but requested by a different tenant.
    await expect(new GetFlowUseCase(repo).execute(OTHER_TENANT, FLOW.id)).rejects.toThrow(
      NotFoundError,
    );
    // The owner still resolves it, proving the flowId itself is valid; only the
    // tenant mismatch turns it into a NotFound.
    await expect(new GetFlowUseCase(repo).execute(OWNER_TENANT, FLOW.id)).resolves.toBe(FLOW);
    expect(findByIdForTenant).toHaveBeenCalledWith(OTHER_TENANT, FLOW.id);
  });
});

describe('ListFlowsUseCase', () => {
  it('returns the flows scoped to the tenant', async () => {
    const flows: Flow[] = [FLOW];
    const listByTenant = jest.fn().mockResolvedValue(flows);
    const useCase = new ListFlowsUseCase(makeFlowRepo({ listByTenant }));

    const result = await useCase.execute(OWNER_TENANT);

    expect(result).toBe(flows);
    expect(listByTenant).toHaveBeenCalledWith(OWNER_TENANT);
  });

  it('returns an empty array when the tenant has no flows', async () => {
    const listByTenant = jest.fn().mockResolvedValue([]);
    const useCase = new ListFlowsUseCase(makeFlowRepo({ listByTenant }));

    await expect(useCase.execute(OWNER_TENANT)).resolves.toEqual([]);
  });
});
