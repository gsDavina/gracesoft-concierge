import type {
  CheckInResponse,
  CreateBookingResponse,
  ListBookingsResponse,
} from "@gracesoft/shared-types";
import { requireStaff } from "@gracesoft/auth";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import type { BookingService } from "../modules/booking/bookingService.js";

const createBookingSchema = z.object({
  businessId: z.string().min(1),
  token: z.string().min(1),
  serviceType: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  channel: z.enum(["whatsapp", "telegram", "admin"]),
});

const checkInSchema = z.object({
  businessId: z.string().min(1),
  token: z.string().min(1),
});

export interface BookingRoutesOptions {
  bookingService: BookingService;
}

export default async function bookingRoutes(fastify: FastifyInstance, opts: BookingRoutesOptions) {
  fastify.post<{ Reply: CreateBookingResponse }>("/bookings", async (request, reply) => {
    const input = createBookingSchema.parse(request.body);
    // Channel adapters (WhatsApp/Telegram webhook handlers) call this with channel set
    // accordingly; "admin" bookings require an authenticated staff actor.
    if (input.channel === "admin") {
      const actor = await requireAuth(request);
      requireStaff(actor);
      if (actor.businessId !== input.businessId) {
        return reply.forbidden("Actor does not belong to this business");
      }
    }

    const booking = await opts.bookingService.create(input);
    return { booking };
  });

  fastify.get<{
    Querystring: { businessId: string; date?: string };
    Reply: ListBookingsResponse;
  }>("/bookings", async (request, reply) => {
    const actor = await requireAuth(request);
    requireStaff(actor);
    if (actor.businessId !== request.query.businessId) {
      return reply.forbidden("Actor does not belong to this business");
    }

    const bookings = await opts.bookingService.listForBusiness(
      request.query.businessId,
      request.query.date,
    );
    return { bookings };
  });

  fastify.post<{ Reply: CheckInResponse }>("/bookings/check-in", async (request, reply) => {
    const actor = await requireAuth(request);
    requireStaff(actor);
    const input = checkInSchema.parse(request.body);
    if (actor.businessId !== input.businessId) {
      return reply.forbidden("Actor does not belong to this business");
    }

    const booking = await opts.bookingService.checkIn(input.businessId, input.token);
    return { booking };
  });
}
