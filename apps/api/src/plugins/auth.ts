import type { AuthenticatedActor } from "@gracesoft/shared-types";
import { UnauthenticatedError, bearerTokenFromHeader, type SessionProvider } from "@gracesoft/auth";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    actor: AuthenticatedActor | null;
  }
}

/**
 * DEV-ONLY session provider: trusts a base64-encoded JSON actor payload as the bearer
 * token. Stands in for Clerk/Auth.js (see packages/auth/src/session.ts) until that
 * provider account exists. Wiring `authProvider` in server.ts to anything else for
 * production is a required follow-up, not optional hardening.
 */
export class DevSessionProvider implements SessionProvider {
  async verify(token: string): Promise<AuthenticatedActor | null> {
    try {
      const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
      if (!decoded.userId || !decoded.businessId || !decoded.role) return null;
      return decoded as AuthenticatedActor;
    } catch {
      return null;
    }
  }
}

export interface AuthPluginOptions {
  sessionProvider: SessionProvider;
}

async function authPlugin(fastify: FastifyInstance, opts: AuthPluginOptions) {
  fastify.decorateRequest("actor", null);

  fastify.addHook("preHandler", async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header) {
      request.actor = null;
      return;
    }
    const token = bearerTokenFromHeader(header);
    request.actor = await opts.sessionProvider.verify(token);
  });
}

/** Use as a route preHandler to reject unauthenticated requests. */
export async function requireAuth(request: FastifyRequest): Promise<AuthenticatedActor> {
  if (!request.actor) {
    throw new UnauthenticatedError();
  }
  return request.actor;
}

export default fp(authPlugin, { name: "auth" });
