import type { PrismaClient } from '@prisma/client';
import type { IUserRepo, CreateUserInput } from '../../domain/ports/IUserRepo.js';
import type { User } from '../../domain/models/User.js';
import { tenantContext } from './tenantContext.js';

function mapUser(row: {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
}): User {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role as User['role'],
    createdAt: row.createdAt,
  };
}

export class PrismaUserRepo implements IUserRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }

  // Login and registration run before any auth context exists, so the RLS
  // GUC is not set by the request pipeline. Since these queries hit the
  // RLS-forced `users` table, establish the tenant context explicitly from the
  // tenantId we already have — otherwise RLS (under the non-superuser runtime
  // role) blocks the row and login/register silently fail.
  async findByEmailAndTenant(email: string, tenantId: string): Promise<User | null> {
    return tenantContext.run(tenantId, async () => {
      const row = await this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email } },
      });
      return row ? mapUser(row) : null;
    });
  }

  async create(input: CreateUserInput): Promise<User> {
    return tenantContext.run(input.tenantId, async () => {
      const row = await this.prisma.user.create({
        data: {
          tenantId: input.tenantId,
          email: input.email,
          passwordHash: input.passwordHash,
          role: input.role as never,
        },
      });
      return mapUser(row);
    });
  }
}
