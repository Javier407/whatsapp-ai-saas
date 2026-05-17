import type { ITenantRepo } from '../../domain/ports/ITenantRepo.js';
import type { Tenant } from '../../domain/models/Tenant.js';
import { NotFoundError } from '../../domain/errors.js';

export class GetTenantUseCase {
  constructor(private readonly tenantRepo: ITenantRepo) {}

  async execute(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);
    return tenant;
  }
}
