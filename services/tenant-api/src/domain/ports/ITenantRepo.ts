import type { Tenant } from '../models/Tenant.js';

export interface CreateTenantInput {
  name: string;
  slug: string;
}

export interface UpdateTenantInput {
  name?: string;
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string | null;
}

export interface ITenantRepo {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  create(input: CreateTenantInput): Promise<Tenant>;
  update(id: string, input: UpdateTenantInput): Promise<Tenant>;
}
