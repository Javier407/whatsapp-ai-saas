export type Plan = 'free' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'offboarded';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  /** Encrypted ciphertext — never plaintext at this layer */
  accessToken: string | null;
  plan: Plan;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}
