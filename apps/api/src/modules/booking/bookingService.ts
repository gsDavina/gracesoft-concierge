import type { Booking as DbBooking, PrismaClient } from "@gracesoft/db";
import type { Booking, CreateBookingInput } from "@gracesoft/shared-types";
import type { CalendarAdapter } from "./calendarAdapter.js";

export class BookingService {
  constructor(
    private readonly db: PrismaClient,
    private readonly calendar: CalendarAdapter,
  ) {}

  async create(input: CreateBookingInput): Promise<Booking> {
    const booking = await this.db.booking.create({
      data: {
        businessId: input.businessId,
        token: input.token,
        serviceType: input.serviceType,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        channel: input.channel,
        status: "pending",
      },
    });

    // Calendar write is deliberately scoped to CalendarEventInput — see calendarAdapter.ts.
    const { calendarEventId } = await this.calendar.createEvent({
      token: booking.token,
      serviceType: booking.serviceType,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
    });

    const confirmed = await this.db.booking.update({
      where: { id: booking.id },
      data: { calendarEventId, status: "confirmed" },
    });
    return toBookingDto(confirmed);
  }

  async listForBusiness(businessId: string, date?: string): Promise<Booking[]> {
    const bookings = await this.db.booking.findMany({
      where: {
        businessId,
        ...(date
          ? { startsAt: { gte: new Date(`${date}T00:00:00`), lt: new Date(`${date}T23:59:59`) } }
          : {}),
      },
      orderBy: { startsAt: "asc" },
    });
    return bookings.map(toBookingDto);
  }

  async cancel(bookingId: string): Promise<Booking> {
    const booking = await this.db.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled" },
    });
    if (booking.calendarEventId) {
      await this.calendar.cancelEvent(booking.calendarEventId);
    }
    return toBookingDto(booking);
  }
}

const dbStatusToDto = {
  pending: "pending",
  confirmed: "confirmed",
  checked_in: "checked-in",
  cancelled: "cancelled",
  completed: "completed",
} as const satisfies Record<DbBooking["status"], Booking["status"]>;

function toBookingDto(booking: DbBooking): Booking {
  return {
    id: booking.id,
    businessId: booking.businessId,
    token: booking.token,
    serviceType: booking.serviceType,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    status: dbStatusToDto[booking.status],
    channel: booking.channel,
    calendarEventId: booking.calendarEventId,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}
