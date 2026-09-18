import type { ListHolidaysResponse } from "@gracesoft/shared-types";
import { requireStaff } from "@gracesoft/auth";
import type { PrismaClient } from "@gracesoft/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import type { HolidayProvider } from "../modules/holiday/holidayProvider.js";

const querySchema = z.object({
  businessId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
});

export interface HolidayRoutesOptions {
  db: PrismaClient;
  holidayProvider: HolidayProvider;
}

/** Lets a business's staff see which dates are auto-blocked — surfaced in the Phase 1
 * onboarding review step and admin-owner settings. */
export default async function holidayRoutes(fastify: FastifyInstance, opts: HolidayRoutesOptions) {
  fastify.get<{ Querystring: { businessId: string; year: string }; Reply: ListHolidaysResponse }>(
    "/holidays",
    async (request, reply) => {
      const actor = await requireAuth(request);
      requireStaff(actor);
      const query = querySchema.parse(request.query);
      if (actor.businessId !== query.businessId) {
        return reply.forbidden("Actor does not belong to this business");
      }

      const business = await opts.db.business.findUnique({
        where: { id: query.businessId },
        select: { region: true },
      });
      if (!business) {
        return reply.notFound("Business not found");
      }

      const holidays = await opts.holidayProvider.getHolidays(business.region, query.year);
      return { holidays };
    },
  );
}
