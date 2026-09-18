import type { PrismaClient } from "@gracesoft/db";
import type { BlueprintHours, Weekday } from "@gracesoft/shared-types";
import { toLocalDateString, type HolidayProvider } from "../holiday/holidayProvider.js";
import { zonedTimeToUtc } from "../../lib/timezone.js";

const DEFAULT_SLOT_MINUTES = 30;
const ACTIVE_STATUSES = ["pending", "confirmed", "checked_in", "completed"] as const;

export interface Slot {
  /** "HH:mm", business-local. */
  time: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Phase 4 (Telegram Expansion): the booking bot needs to offer a booker real open
 * times, not just accept an arbitrary exact timestamp the way BookingService.create()
 * does today. This service is the seam that turns a business's published Blueprint
 * hours + services into actual bookable slots, honoring holidays (reuses the same
 * HolidayProvider from Phase 1) and already-booked times.
 *
 * Deliberately simple for a pilot-scale single-resource business: one booking at a time
 * blocks that whole slot across the entire business, regardless of service — there is no
 * concept of multiple simultaneous doctors/rooms in the schema yet. Fine for a solo GP
 * pilot; would need a resource/staff dimension to support a multi-doctor clinic.
 */
export class AvailabilityService {
  constructor(
    private readonly db: PrismaClient,
    private readonly holidays: HolidayProvider,
  ) {}

  /** Open (business-hours, non-holiday) calendar dates over the next `daysAhead` days, starting today. */
  async listOpenDates(businessId: string, daysAhead = 7): Promise<string[]> {
    const business = await this.db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { region: true, timezone: true },
    });
    const blueprint = await this.db.blueprint.findFirst({
      where: { businessId, status: "published" },
    });
    if (!blueprint) return [];
    const hours = blueprint.hours as unknown as BlueprintHours[];

    const today = toLocalDateString(new Date(), business.timezone);
    const dates: string[] = [];
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = toLocalDateString(d, business.timezone);
      const weekday = weekdayOf(dateStr, business.timezone);
      const dayHours = hours.find((h) => h.day === weekday);
      if (!dayHours || dayHours.closed || !dayHours.opens || !dayHours.closes) continue;

      const year = Number(dateStr.slice(0, 4));
      const holidaysThisYear = await this.holidays.getHolidays(business.region, year);
      if (holidaysThisYear.some((h) => h.date === dateStr)) continue;

      dates.push(dateStr);
    }
    return dates;
  }

  /** Services from the business's published blueprint, for offering a booker a choice. */
  async listPublishedServices(businessId: string): Promise<{ name: string }[]> {
    const blueprint = await this.db.blueprint.findFirst({ where: { businessId, status: "published" } });
    if (!blueprint) return [];
    const services = blueprint.services as unknown as { name: string }[];
    return services.map((s) => ({ name: s.name }));
  }

  /** FAQs from the business's published blueprint — the vertical-specific context (e.g.
   * a clinic's confidentiality/no-diagnosis copy) surfaced to a real booker via /faq. */
  async listPublishedFaqs(businessId: string): Promise<{ question: string; answer: string }[]> {
    const blueprint = await this.db.blueprint.findFirst({ where: { businessId, status: "published" } });
    if (!blueprint) return [];
    return blueprint.faqs as unknown as { question: string; answer: string }[];
  }

  /** Open time slots for a specific service on a specific date, excluding already-booked times. */
  async listSlots(businessId: string, serviceType: string, date: string): Promise<Slot[]> {
    const business = await this.db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { timezone: true },
    });
    const blueprint = await this.db.blueprint.findFirst({
      where: { businessId, status: "published" },
    });
    if (!blueprint) return [];
    const hours = blueprint.hours as unknown as BlueprintHours[];
    const services = blueprint.services as unknown as { name: string; durationMinutes?: number }[];

    const weekday = weekdayOf(date, business.timezone);
    const dayHours = hours.find((h) => h.day === weekday);
    if (!dayHours || dayHours.closed || !dayHours.opens || !dayHours.closes) return [];

    const service = services.find((s) => s.name === serviceType);
    const durationMinutes = service?.durationMinutes ?? DEFAULT_SLOT_MINUTES;

    const candidates = generateCandidateTimes(dayHours.opens, dayHours.closes, durationMinutes);

    const dayStart = zonedTimeToUtc(date, "00:00", business.timezone);
    const dayEnd = zonedTimeToUtc(date, "23:59", business.timezone);
    const existing = await this.db.booking.findMany({
      where: {
        businessId,
        status: { in: [...ACTIVE_STATUSES] },
        startsAt: { gte: dayStart, lte: dayEnd },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots: Slot[] = [];
    for (const time of candidates) {
      const startsAt = zonedTimeToUtc(date, time, business.timezone);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
      const overlaps = existing.some((b) => startsAt < b.endsAt && endsAt > b.startsAt);
      if (!overlaps) {
        slots.push({ time, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
      }
    }
    return slots;
  }
}

function weekdayOf(dateStr: string, timeZone: string): Weekday {
  const d = new Date(`${dateStr}T12:00:00Z`); // noon UTC keeps this clear of any zone's day boundary
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(d).toLowerCase();
  return name as Weekday;
}

function generateCandidateTimes(opens: string, closes: string, stepMinutes: number): string[] {
  const [openH, openM] = opens.split(":").map(Number);
  const [closeH, closeM] = closes.split(":").map(Number);
  const openMinutes = openH! * 60 + openM!;
  const closeMinutes = closeH! * 60 + closeM!;

  const times: string[] = [];
  for (let m = openMinutes; m + stepMinutes <= closeMinutes; m += stepMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    times.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return times;
}
