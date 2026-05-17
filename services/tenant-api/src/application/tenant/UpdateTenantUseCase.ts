import type { ITenantRepo } from '../../domain/ports/ITenantRepo.js';
import type { Tenant } from '../../domain/models/Tenant.js';
import { NotFoundError } from '../../domain/errors.js';

export interface UpdateTenantInput {
  name: string;
}

export class UpdateTenantUseCase {
  constructor(private readonly tenantRepo: ITenantRepo) {}

  async execute(tenantId: string, input: UpdateTenantInput): Promise<Tenant> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);
    return this.tenantRepo.update(tenantId, { name: input.name });
  }
}
