import type { Booking as DbBooking, PrismaClient } from "@gracesoft/db";
import type { BlueprintHours, Booking, CreateBookingInput } from "@gracesoft/shared-types";
import type { CalendarAdapter } from "./calendarAdapter.js";
import { toLocalDateString, type HolidayProvider } from "../holiday/holidayProvider.js";
import { fitsWithinSlots, getDaySlots, toLocalDateAndMinutes, weekdayOf } from "../../lib/businessHours.js";

/** Thrown when a booking's date falls on a public holiday blocked for the business's region. */
export class HolidayBlockedError extends Error {
  constructor(public readonly holidayName: string) {
    super(`This date is a public holiday (${holidayName}) and is not bookable.`);
    this.name = "HolidayBlockedError";
  }
}

/**
 * Thrown when a booking doesn't fit entirely inside one of the business's published
 * opening-hours ranges for that day (e.g. with Monday 09:00–17:00, a 1-hour booking can
 * start no earlier than 09:00 and no later than 16:00).
 */
export class OutsideOpeningHoursError extends Error {
  constructor(message = "This time is outside the business's opening hours.") {
    super(message);
    this.name = "OutsideOpeningHoursError";
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
    await this.assertWithinOpeningHours(input.businessId, new Date(input.startsAt), new Date(input.endsAt));

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

  /**
   * Every booking — whatever the channel — must fit inside one published opening-hours
   * range. Enforced here rather than only in AvailabilityService, because /bookings also
   * accepts an arbitrary startsAt/endsAt directly. A business with no published blueprint
   * has no hours to enforce yet, so it's allowed through (matches pre-onboarding behaviour).
   */
  private async assertWithinOpeningHours(businessId: string, startsAt: Date, endsAt: Date): Promise<void> {
    if (!(endsAt > startsAt)) {
      throw new OutsideOpeningHoursError("A booking must end after it starts.");
    }
    const business = await this.db.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    });
    if (!business) return; // let the FK constraint on booking.create surface the real error

    const blueprint = await this.db.blueprint.findFirst({
      where: { businessId, status: "published" },
      select: { hours: true },
    });
    if (!blueprint) return;

    const start = toLocalDateAndMinutes(startsAt, business.timezone);
    const end = toLocalDateAndMinutes(endsAt, business.timezone);
    // A booking ending exactly at local midnight reads as minute 0 of the next day.
    const endMinutes = end.date === start.date ? end.minutes : end.minutes === 0 ? 24 * 60 : -1;
    if (endMinutes < 0) {
      throw new OutsideOpeningHoursError("A booking can't span more than one day.");
    }

    const hours = blueprint.hours as unknown as BlueprintHours[];
    const slots = getDaySlots(hours.find((h) => h.day === weekdayOf(start.date, business.timezone)));
    if (!fitsWithinSlots(slots, start.minutes, endMinutes)) {
      const open = slots.map((s) => `${s.opens}–${s.closes}`).join(", ");
      throw new OutsideOpeningHoursError(
        open
          ? `That time is outside opening hours. On that day, bookings must fall within: ${open}.`
          : "The business is closed on that day.",
      );
    }
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
