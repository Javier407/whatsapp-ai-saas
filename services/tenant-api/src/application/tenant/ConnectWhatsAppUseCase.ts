import type { ITenantRepo } from '../../domain/ports/ITenantRepo.js';
import type { Tenant } from '../../domain/models/Tenant.js';
import { NotFoundError } from '../../domain/errors.js';
import { encrypt } from './encryption.js';

export interface ConnectWhatsAppInput {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
}

export class ConnectWhatsAppUseCase {
  constructor(
    private readonly tenantRepo: ITenantRepo,
    private readonly masterKey: string,
  ) {}

  async execute(tenantId: string, input: ConnectWhatsAppInput): Promise<Tenant> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    // Encrypt the access token at rest — never store plaintext
    const encryptedToken = encrypt(input.accessToken, this.masterKey);

    return this.tenantRepo.update(tenantId, {
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      accessToken: encryptedToken,
    });
  }
}
