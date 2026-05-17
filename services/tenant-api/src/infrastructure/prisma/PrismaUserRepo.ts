import type { PrismaClient } from '@prisma/client';
import type { IUserRepo, CreateUserInput } from '../../domain/ports/IUserRepo.js';
import type { User } from '../../domain/models/User.js';

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

  async findByEmailAndTenant(email: string, tenantId: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    return row ? mapUser(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role as never,
      },
    });
    return mapUser(row);
  }
}
