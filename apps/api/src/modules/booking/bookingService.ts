import type { Booking as DbBooking, PrismaClient } from "@gracesoft/db";
import type { Booking, CreateBookingInput } from "@gracesoft/shared-types";
import type { CalendarAdapter } from "./calendarAdapter.js";
import { toLocalDateString, type HolidayProvider } from "../holiday/holidayProvider.js";

/** Thrown when a booking's date falls on a public holiday blocked for the business's region. */
export class HolidayBlockedError extends Error {
  constructor(public readonly holidayName: string) {
    super(`This date is a public holiday (${holidayName}) and is not bookable.`);
    this.name = "HolidayBlockedError";
  }
}

export class BookingService {
  constructor(
    private readonly db: PrismaClient,
    private readonly calendar: CalendarAdapter,
    private readonly holidays: HolidayProvider,
  ) {}

  async create(input: CreateBookingInput): Promise<Booking> {
    await this.assertNotOnHoliday(input.businessId, new Date(input.startsAt));

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

  /**
   * Check-in for admin-kiosk (03-project-structure.md) / the pilot-track check-in module
   * (01-milestones.md), where the booker's token doubles as their arrival credential —
   * front desk (or, later, a self-serve kiosk) never needs a name to confirm arrival.
   * Only ever operates on today's confirmed booking for that token; there is nothing to
   * check in twice or check in for the wrong day.
   */
  async checkIn(businessId: string, token: string): Promise<Booking> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const booking = await this.db.booking.findFirst({
      where: {
        businessId,
        token,
        status: "confirmed",
        startsAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { startsAt: "asc" },
    });

    if (!booking) {
      throw new Error("No confirmed booking found for this token today");
    }

    const checkedIn = await this.db.booking.update({
      where: { id: booking.id },
      data: { status: "checked_in" },
    });
    return toBookingDto(checkedIn);
  }

  /** Public-holiday auto-blocking (01-milestones.md Phase 1) — keyed by Business.region. */
  private async assertNotOnHoliday(businessId: string, startsAt: Date): Promise<void> {
    const business = await this.db.business.findUnique({
      where: { id: businessId },
      select: { region: true, timezone: true },
    });
    if (!business) return; // let the FK constraint on booking.create surface the real error

    const localDate = toLocalDateString(startsAt, business.timezone);
    const year = Number(localDate.slice(0, 4));
    const holidays = await this.holidays.getHolidays(business.region, year);
    const match = holidays.find((h) => h.date === localDate);
    if (match) {
      throw new HolidayBlockedError(match.name);
    }
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
