import type { User, UserRole } from '../models/User.js';

export interface CreateUserInput {
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface IUserRepo {
  findById(id: string): Promise<User | null>;
  findByEmailAndTenant(email: string, tenantId: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}
