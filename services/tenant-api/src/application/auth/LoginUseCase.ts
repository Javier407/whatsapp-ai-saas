import argon2 from 'argon2';
import type { ITenantRepo } from '../../domain/ports/ITenantRepo.js';
import type { IUserRepo } from '../../domain/ports/IUserRepo.js';
import { UnauthorizedError, NotFoundError } from '../../domain/errors.js';

export interface LoginInput {
  email: string;
  password: string;
  tenantSlug: string;
}

export interface LoginOutput {
  tenantId: string;
  userId: string;
  role: string;
}

export class LoginUseCase {
  constructor(
    private readonly tenantRepo: ITenantRepo,
    private readonly userRepo: IUserRepo,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const tenant = await this.tenantRepo.findBySlug(input.tenantSlug);
    if (!tenant) {
      // Return generic error to prevent slug enumeration
      throw new UnauthorizedError('Invalid credentials');
    }

    const user = await this.userRepo.findByEmailAndTenant(input.email, tenant.id);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return { tenantId: tenant.id, userId: user.id, role: user.role };
  }
}
