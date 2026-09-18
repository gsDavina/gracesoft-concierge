import { describe, expect, it } from "vitest";
import { BookingService, HolidayBlockedError } from "../bookingService.js";
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
function makeFakeDb(seed: { businesses: FakeBusiness[]; bookings: FakeBooking[] }) {
  let counter = 0;
  const db = {
    business: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        seed.businesses.find((b) => b.id === where.id) ?? null,
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
