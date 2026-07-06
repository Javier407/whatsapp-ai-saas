import type { FastifyPluginAsync } from 'fastify';
import type { RegisterUseCase } from '../../../application/auth/RegisterUseCase.js';
import type { LoginUseCase } from '../../../application/auth/LoginUseCase.js';
import { ok, sendDomainError } from '../reply.js';
import { ValidationError } from '../../../domain/errors.js';

interface AuthRoutesDeps {
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesDeps> = async (fastify, opts) => {
  /**
   * POST /api/v1/auth/register
   * Body: { tenant_name, email, password }
   * Returns: { tenant_id, user_id, token }
   */
  fastify.post<{
    Body: { tenant_name: string; email: string; password: string };
  }>('/register', async (request, reply) => {
    try {
      const { tenant_name, email, password } = request.body ?? {};
      if (!tenant_name || !email || !password) {
        throw new ValidationError('tenant_name, email and password are required');
      }
      const result = await opts.registerUseCase.execute({
        tenantName: tenant_name,
        email,
        password,
      });

      const token = fastify.jwt.sign(
        { sub: result.userId, tid: result.tenantId, role: 'owner' },
        { expiresIn: '12h' },
      );

      ok(reply, { tenant_id: result.tenantId, user_id: result.userId, token }, 201);
    } catch (err) {
      sendDomainError(reply, err);
    }
  });

  /**
   * POST /api/v1/auth/login
   * Body: { email, password, tenant_slug }
   * Returns: { token, tenant_id, expires_at }
   */
  fastify.post<{
    Body: { email: string; password: string; tenant_slug: string };
  }>('/login', async (request, reply) => {
    try {
      const { email, password, tenant_slug } = request.body ?? {};
      if (!email || !password || !tenant_slug) {
        throw new ValidationError('email, password and tenant_slug are required');
      }
      const result = await opts.loginUseCase.execute({
        email,
        password,
        tenantSlug: tenant_slug,
      });

      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const token = fastify.jwt.sign(
        { sub: result.userId, tid: result.tenantId, role: result.role },
        { expiresIn: '12h' },
      );

      ok(reply, { token, tenant_id: result.tenantId, expires_at: expiresAt });
    } catch (err) {
      sendDomainError(reply, err);
    }
  });
};
