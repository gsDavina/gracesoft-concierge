import { describe, expect, it } from "vitest";
import { BookingService, HolidayBlockedError, OutsideOpeningHoursError } from "../bookingService.js";
import { InMemoryCalendarAdapter } from "../calendarAdapter.js";
import { StaticHolidayProvider } from "../../holiday/holidayProvider.js";

interface FakeBusiness {
  id: string;
  region: string;
  timezone: string;
}

interface FakeBooking {
  id: string;
  businessId: string;
  token: string;
  serviceType: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  channel: string;
  calendarEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal in-memory stand-in for the slice of PrismaClient BookingService calls. */
interface FakeBlueprint {
  businessId: string;
  status: "draft" | "published";
  hours: unknown;
}

function makeFakeDb(seed: { businesses: FakeBusiness[]; bookings: FakeBooking[]; blueprints?: FakeBlueprint[] }) {
  let counter = 0;
  const db = {
    business: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        seed.businesses.find((b) => b.id === where.id) ?? null,
    },
    blueprint: {
      findFirst: async ({ where }: { where: { businessId: string; status: string } }) =>
        (seed.blueprints ?? []).find((bp) => bp.businessId === where.businessId && bp.status === where.status) ??
        null,
    },
    booking: {
      create: async ({ data }: { data: Omit<FakeBooking, "id" | "createdAt" | "updatedAt" | "calendarEventId"> }) => {
        const booking: FakeBooking = {
          ...data,
          id: `bk-${++counter}`,
          calendarEventId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        seed.bookings.push(booking);
        return booking;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeBooking> }) => {
        const booking = seed.bookings.find((b) => b.id === where.id)!;
        Object.assign(booking, data);
        return booking;
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { db, seed };
}

describe("BookingService — public-holiday auto-blocking", () => {
  it("blocks a booking that falls on a public holiday for the business's region", async () => {
    const { db } = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      bookings: [],
    });
    const holidays = new StaticHolidayProvider({
      "SG:2026": [{ date: "2026-01-01", name: "New Year's Day" }],
    });
    const service = new BookingService(db, new InMemoryCalendarAdapter(), holidays);

    await expect(
      service.create({
        businessId: "biz-1",
        token: "tok-1",
        serviceType: "consult",
        startsAt: "2026-01-01T02:00:00.000Z", // 10:00 SGT on New Year's Day
        endsAt: "2026-01-01T02:30:00.000Z",
        channel: "admin",
      }),
    ).rejects.toBeInstanceOf(HolidayBlockedError);
  });

  it("allows a booking on a non-holiday date", async () => {
    const { db, seed } = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      bookings: [],
    });
    const holidays = new StaticHolidayProvider({
      "SG:2026": [{ date: "2026-01-01", name: "New Year's Day" }],
    });
    const service = new BookingService(db, new InMemoryCalendarAdapter(), holidays);

    const booking = await service.create({
      businessId: "biz-1",
      token: "tok-1",
      serviceType: "consult",
      startsAt: "2026-01-02T02:00:00.000Z",
      endsAt: "2026-01-02T02:30:00.000Z",
      channel: "admin",
    });

    expect(booking.status).toBe("confirmed");
    expect(seed.bookings).toHaveLength(1);
  });

  it("resolves the holiday date in the business's local timezone, not UTC", async () => {
    const { db } = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      bookings: [],
    });
    // 2026-01-01 00:30 SGT is 2025-12-31 16:30 UTC — a naive UTC-date check would miss this.
    const holidays = new StaticHolidayProvider({
      "SG:2026": [{ date: "2026-01-01", name: "New Year's Day" }],
    });
    const service = new BookingService(db, new InMemoryCalendarAdapter(), holidays);

    await expect(
      service.create({
        businessId: "biz-1",
        token: "tok-1",
        serviceType: "consult",
        startsAt: "2025-12-31T16:30:00.000Z",
        endsAt: "2025-12-31T17:00:00.000Z",
        channel: "admin",
      }),
    ).rejects.toBeInstanceOf(HolidayBlockedError);
  });
});

describe("BookingService — opening-hours enforcement", () => {
  // 2026-01-05 is a Monday; Asia/Singapore is UTC+8, so 09:00 SGT = 01:00Z.
  const sgt = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(Date.UTC(2026, 0, 5, h! - 8, m!)).toISOString();
  };

  function serviceWithHours(hours: unknown) {
    const { db, seed } = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      bookings: [],
      blueprints: [{ businessId: "biz-1", status: "published", hours }],
    });
    return { service: new BookingService(db, new InMemoryCalendarAdapter(), new StaticHolidayProvider()), seed };
  }

  const book = (service: BookingService, start: string, end: string) =>
    service.create({
      businessId: "biz-1",
      token: "tok-1",
      serviceType: "consult",
      startsAt: sgt(start),
      endsAt: sgt(end),
      channel: "admin",
    });

  const MONDAY_9_TO_5 = [{ day: "monday", slots: [{ opens: "09:00", closes: "17:00" }] }];

  it("allows 1-hour bookings from 09:00 through a 16:00 start in a 09:00–17:00 slot", async () => {
    const { service, seed } = serviceWithHours(MONDAY_9_TO_5);
    await book(service, "09:00", "10:00");
    await book(service, "16:00", "17:00");
    expect(seed.bookings).toHaveLength(2);
  });

  it("rejects a booking that starts before the slot opens", async () => {
    const { service } = serviceWithHours(MONDAY_9_TO_5);
    await expect(book(service, "08:00", "09:00")).rejects.toBeInstanceOf(OutsideOpeningHoursError);
  });

  it("rejects a 1-hour booking starting after 16:00, since it would run past 17:00", async () => {
    const { service } = serviceWithHours(MONDAY_9_TO_5);
    await expect(book(service, "16:30", "17:30")).rejects.toBeInstanceOf(OutsideOpeningHoursError);
  });

  it("rejects a booking that straddles the gap between two slots", async () => {
    const { service } = serviceWithHours([
      {
        day: "monday",
        slots: [
          { opens: "09:00", closes: "12:00" },
          { opens: "14:00", closes: "17:00" },
        ],
      },
    ]);
    await expect(book(service, "11:30", "12:30")).rejects.toBeInstanceOf(OutsideOpeningHoursError);
    await expect(book(service, "12:30", "13:30")).rejects.toBeInstanceOf(OutsideOpeningHoursError);
    await expect(book(service, "14:00", "15:00")).resolves.toMatchObject({ status: "confirmed" });
  });

  it("rejects any booking on a day that is closed or not configured", async () => {
    const { service } = serviceWithHours([{ day: "monday", closed: true }]);
    await expect(book(service, "10:00", "11:00")).rejects.toThrow("closed on that day");

    const { service: unconfigured } = serviceWithHours([{ day: "tuesday", slots: [{ opens: "09:00", closes: "17:00" }] }]);
    await expect(book(unconfigured, "10:00", "11:00")).rejects.toBeInstanceOf(OutsideOpeningHoursError);
  });

  it("still enforces legacy single opens/closes hours", async () => {
    const { service } = serviceWithHours([{ day: "monday", opens: "09:00", closes: "17:00" }]);
    await expect(book(service, "17:00", "18:00")).rejects.toBeInstanceOf(OutsideOpeningHoursError);
    await expect(book(service, "09:00", "10:00")).resolves.toMatchObject({ status: "confirmed" });
  });

  it("rejects a booking that ends before it starts", async () => {
    const { service } = serviceWithHours(MONDAY_9_TO_5);
    await expect(book(service, "10:00", "09:30")).rejects.toBeInstanceOf(OutsideOpeningHoursError);
  });
});
