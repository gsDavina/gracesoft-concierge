import type {
  AuditLogResponse,
  TokenLookupRequest,
  TokenLookupResponse,
} from "@gracesoft/shared-types";
import { requireOwner, requireStaff } from "@gracesoft/auth";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import type { IdentityService } from "../modules/identity/identityService.js";

const lookupBodySchema = z.object({
  reason: z.string().min(1, "reason is required"),
});

export interface IdentityRoutesOptions {
  identityService: IdentityService;
}

export default async function identityRoutes(
  fastify: FastifyInstance,
  opts: IdentityRoutesOptions,
) {
  fastify.post<{
    Params: { businessId: string; token: string };
    Body: Pick<TokenLookupRequest, "reason">;
    Reply: TokenLookupResponse;
  }>("/businesses/:businessId/identities/:token/lookup", async (request, reply) => {
    const actor = await requireAuth(request);
    requireStaff(actor);

    if (actor.businessId !== request.params.businessId) {
      return reply.forbidden("Actor does not belong to this business");
    }

    const { reason } = lookupBodySchema.parse(request.body);
    const identity = await opts.identityService.lookup(actor, request.params.token, reason);
    return identity;
  });

  fastify.get<{
    Params: { businessId: string };
    Reply: AuditLogResponse;
  }>("/businesses/:businessId/audit-log", async (request, reply) => {
    const actor = await requireAuth(request);
    requireOwner(actor);

    if (actor.businessId !== request.params.businessId) {
      return reply.forbidden("Actor does not belong to this business");
    }

    const entries = await opts.identityService.listAuditLog(request.params.businessId);
    return { entries };
  });
}
