import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { Config } from '../../../config.js';

export interface JwtPayload {
  sub: string;   // userId
  tid: string;   // tenantId
  role: string;
  exp: number;
}

// Augment Fastify's request to carry tenant context derived from JWT
declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    userId: string;
    userRole: string;
  }
}

const authPluginImpl: FastifyPluginAsync<{ config: Config }> = async (fastify, opts) => {
  await fastify.register(fastifyJwt, {
    secret: opts.config.JWT_SECRET,
    sign: { algorithm: 'HS256' },
  });

  // Decorate request with defaults so TypeScript is happy before the hook runs
  fastify.decorateRequest('tenantId', '');
  fastify.decorateRequest('userId', '');
  fastify.decorateRequest('userRole', '');

  /**
   * Call this hook on any protected route to validate the JWT and bind
   * tenantId / userId / userRole from token claims — NEVER from request body.
   */
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const payload = await request.jwtVerify<JwtPayload>();
        // Bind claims to request — not from body, not from headers other than Authorization
        request.tenantId = payload.tid;
        request.userId = payload.sub;
        request.userRole = payload.role;
      } catch {
        await reply.status(401).send({
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
          meta: {},
        });
      }
    },
  );
};

export const authPlugin = fp(authPluginImpl, {
  name: 'authPlugin',
  fastify: '4.x',
});

// Extend Fastify instance type to include authenticate
declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}
