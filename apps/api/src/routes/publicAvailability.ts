import type { PrismaClient } from "@gracesoft/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AvailabilityService } from "../modules/booking/availabilityService.js";

export interface PublicAvailabilityRoutesOptions {
  db: PrismaClient;
  availabilityService: AvailabilityService;
}

const optionsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(14),
});

const slotsQuerySchema = z.object({
  service: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

/**
 * Unauthenticated, read-only availability — used by apps/demo so its booking form offers
 * exactly the dates and times the owner published in Admin. Exposes nothing the Telegram
 * bot doesn't already show any stranger who messages it: published service names and
 * durations, open dates, and free slot times. No bookings, tokens, or identities.
 */
export default async function publicAvailabilityRoutes(
  fastify: FastifyInstance,
  opts: PublicAvailabilityRoutesOptions,
) {
  fastify.get<{ Params: { businessId: string }; Querystring: { days?: string } }>(
    "/public/businesses/:businessId/booking-options",
    async (request, reply) => {
      const business = await findBusiness(opts.db, request.params.businessId);
      if (!business) return reply.notFound("Business not found");
      const { days } = optionsQuerySchema.parse(request.query);

      const [services, dates] = await Promise.all([
        opts.availabilityService.listPublishedServices(business.id),
        opts.availabilityService.listOpenDates(business.id, days),
      ]);
      return { timezone: business.timezone, services, dates };
    },
  );

  fastify.get<{ Params: { businessId: string }; Querystring: { service?: string; date?: string } }>(
    "/public/businesses/:businessId/slots",
    async (request, reply) => {
      const business = await findBusiness(opts.db, request.params.businessId);
      if (!business) return reply.notFound("Business not found");
      const { service, date } = slotsQuerySchema.parse(request.query);

      const slots = await opts.availabilityService.listSlots(business.id, service, date, new Date());
      return { slots };
    },
  );
}

function findBusiness(db: PrismaClient, id: string) {
  return db.business.findUnique({ where: { id }, select: { id: true, timezone: true } });
}
