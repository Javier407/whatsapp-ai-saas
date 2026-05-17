export type UserRole = 'owner' | 'admin' | 'viewer';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}
