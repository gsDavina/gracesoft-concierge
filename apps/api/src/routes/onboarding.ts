import type {
  GenerateDraftResponse,
  GetBlueprintResponse,
  ListSourcesResponse,
  PublishBlueprintResponse,
  SubmitSourceResponse,
  UpdateBlueprintRequest,
  UpdateBlueprintResponse,
} from "@gracesoft/shared-types";
import { requireOwner } from "@gracesoft/auth";
import type { PrismaClient } from "@gracesoft/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import type { OnboardingService } from "../modules/onboarding/onboardingService.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB — plain text/markdown only, see textExtraction.ts

const urlSourceSchema = z.object({ url: z.string().url() });

const blueprintServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
});
const blueprintHoursSchema = z.object({
  day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  opens: z.string().optional(),
  closes: z.string().optional(),
  closed: z.boolean().optional(),
});
const blueprintFaqSchema = z.object({ question: z.string().min(1), answer: z.string().min(1) });
const blueprintContentSchema = z.object({
  services: z.array(blueprintServiceSchema),
  hours: z.array(blueprintHoursSchema),
  faqs: z.array(blueprintFaqSchema),
});

export interface OnboardingRoutesOptions {
  db: PrismaClient;
  onboardingService: OnboardingService;
}

/** Blueprint editing is owner-only across every route here — see packages/auth's
 * requireOwner doc comment ("billing, blueprint editing, audit log access"). */
export default async function onboardingRoutes(fastify: FastifyInstance, opts: OnboardingRoutesOptions) {
  // --- Input step: submit sources -----------------------------------------------------

  fastify.post<{ Params: { businessId: string }; Reply: SubmitSourceResponse }>(
    "/businesses/:businessId/onboarding/sources/url",
    async (request, reply) => {
      const actor = await requireAuth(request);
      requireOwner(actor);
      if (actor.businessId !== request.params.businessId) {
        return reply.forbidden("Actor does not belong to this business");
      }

      const { url } = urlSourceSchema.parse(request.body);
      const source = await opts.onboardingService.submitUrlSource(request.params.businessId, url);
      return { source };
    },
  );

  fastify.post<{ Params: { businessId: string }; Reply: SubmitSourceResponse }>(
    "/businesses/:businessId/onboarding/sources/document",
    async (request, reply) => {
      const actor = await requireAuth(request);
      requireOwner(actor);
      if (actor.businessId !== request.params.businessId) {
        return reply.forbidden("Actor does not belong to this business");
      }

      const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
      if (!file) {
        return reply.badRequest("No file uploaded");
      }
      const buffer = await file.toBuffer();

      const source = await opts.onboardingService.submitDocumentSource(request.params.businessId, {
        fileName: file.filename,
        mimeType: file.mimetype,
        buffer,
      });
      return { source };
    },
  );

  fastify.get<{ Params: { businessId: string }; Reply: ListSourcesResponse }>(
    "/businesses/:businessId/onboarding/sources",
    async (request, reply) => {
      const actor = await requireAuth(request);
      requireOwner(actor);
      if (actor.businessId !== request.params.businessId) {
        return reply.forbidden("Actor does not belong to this business");
      }

      const sources = await opts.onboardingService.listSources(request.params.businessId);
      return { sources };
    },
  );

  // --- Auto-draft step -----------------------------------------------------------------

  fastify.post<{ Params: { businessId: string }; Reply: GenerateDraftResponse }>(
    "/businesses/:businessId/onboarding/draft",
    async (request, reply) => {
      const actor = await requireAuth(request);
      requireOwner(actor);
      if (actor.businessId !== request.params.businessId) {
        return reply.forbidden("Actor does not belong to this business");
      }

      const blueprint = await opts.onboardingService.generateDraft(request.params.businessId);
      return { blueprint };
    },
  );

  // --- Human-in-the-loop review/edit + publish ------------------------------------------

  fastify.get<{ Params: { businessId: string }; Reply: GetBlueprintResponse }>(
    "/businesses/:businessId/blueprint",
    async (request, reply) => {
      const actor = await requireAuth(request);
      requireOwner(actor);
      if (actor.businessId !== request.params.businessId) {
        return reply.forbidden("Actor does not belong to this business");
      }

      const blueprint = await opts.onboardingService.getBlueprint(request.params.businessId);
      return { blueprint };
    },
  );

  fastify.patch<{
    Params: { businessId: string };
    Body: Omit<UpdateBlueprintRequest, "businessId">;
    Reply: UpdateBlueprintResponse;
  }>("/businesses/:businessId/blueprint", async (request, reply) => {
    const actor = await requireAuth(request);
    requireOwner(actor);
    if (actor.businessId !== request.params.businessId) {
      return reply.forbidden("Actor does not belong to this business");
    }

    const content = blueprintContentSchema.parse(request.body);
    const blueprint = await opts.onboardingService.updateContent(request.params.businessId, content);
    return { blueprint };
  });

  fastify.post<{ Params: { businessId: string }; Reply: PublishBlueprintResponse }>(
    "/businesses/:businessId/blueprint/publish",
    async (request, reply) => {
      const actor = await requireAuth(request);
      requireOwner(actor);
      if (actor.businessId !== request.params.businessId) {
        return reply.forbidden("Actor does not belong to this business");
      }

      const staffUser = await opts.db.staffUser.findUniqueOrThrow({
        where: { authSubject: actor.userId },
        select: { id: true },
      });
      const blueprint = await opts.onboardingService.publish(request.params.businessId, staffUser.id);
      return { blueprint };
    },
  );
}
