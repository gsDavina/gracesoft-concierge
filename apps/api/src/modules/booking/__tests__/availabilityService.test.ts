import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvailabilityService } from "../availabilityService.js";
import { StaticHolidayProvider } from "../../holiday/holidayProvider.js";

interface FakeBusiness {
  id: string;
  region: string;
  timezone: string;
}
interface FakeBlueprint {
  businessId: string;
  status: "draft" | "published";
  services: unknown;
  hours: unknown;
  faqs?: unknown;
}
interface FakeBooking {
  startsAt: Date;
  endsAt: Date;
  status: string;
}

function makeFakeDb(seed: { businesses: FakeBusiness[]; blueprints: FakeBlueprint[]; bookings: FakeBooking[] }) {
  const db = {
    business: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const b = seed.businesses.find((x) => x.id === where.id);
        if (!b) throw new Error("not found");
        return b;
      },
    },
    blueprint: {
      findFirst: async ({ where }: { where: { businessId: string; status: string } }) =>
        seed.blueprints.find((bp) => bp.businessId === where.businessId && bp.status === where.status) ?? null,
    },
    booking: {
      findMany: async ({
        where,
      }: {
        where: { businessId: string; status: { in: string[] }; startsAt: { gte: Date; lte: Date } };
      }) =>
        seed.bookings.filter(
          (b) =>
            where.status.in.includes(b.status) &&
            b.startsAt >= where.startsAt.gte &&
            b.startsAt <= where.startsAt.lte,
        ),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return db;
}

const PUBLISHED_BLUEPRINT: FakeBlueprint = {
  businessId: "biz-1",
  status: "published",
  services: [{ name: "Consultation", durationMinutes: 30 }],
  hours: [
    { day: "monday", opens: "09:00", closes: "11:00" },
    { day: "tuesday", closed: true },
  ],
  faqs: [{ question: "Is this confidential?", answer: "Yes." }],
};

describe("AvailabilityService.listPublishedFaqs", () => {
  it("returns the published blueprint's FAQs", async () => {
    const db = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      blueprints: [PUBLISHED_BLUEPRINT],
      bookings: [],
    });
    const service = new AvailabilityService(db, new StaticHolidayProvider());

    expect(await service.listPublishedFaqs("biz-1")).toEqual([{ question: "Is this confidential?", answer: "Yes." }]);
  });

  it("returns an empty list when there is no published blueprint", async () => {
    const db = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      blueprints: [],
      bookings: [],
    });
    const service = new AvailabilityService(db, new StaticHolidayProvider());

    expect(await service.listPublishedFaqs("biz-1")).toEqual([]);
  });
});

describe("AvailabilityService.listSlots", () => {
  it("generates 30-minute slots across the open window when nothing is booked", async () => {
    const db = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      blueprints: [PUBLISHED_BLUEPRINT],
      bookings: [],
    });
    const service = new AvailabilityService(db, new StaticHolidayProvider());

    // 2026-01-05 is a Monday.
    const slots = await service.listSlots("biz-1", "Consultation", "2026-01-05");

    expect(slots.map((s) => s.time)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("excludes a slot that overlaps an existing booking", async () => {
    const db = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      blueprints: [PUBLISHED_BLUEPRINT],
      bookings: [
        {
          // 09:30-10:00 SGT on 2026-01-05 = 01:30-02:00 UTC
          startsAt: new Date("2026-01-05T01:30:00.000Z"),
          endsAt: new Date("2026-01-05T02:00:00.000Z"),
          status: "confirmed",
        },
      ],
    });
    const service = new AvailabilityService(db, new StaticHolidayProvider());

    const slots = await service.listSlots("biz-1", "Consultation", "2026-01-05");

    expect(slots.map((s) => s.time)).toEqual(["09:00", "10:00", "10:30"]);
  });

  it("returns no slots on a day the business is closed", async () => {
    const db = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      blueprints: [PUBLISHED_BLUEPRINT],
      bookings: [],
    });
    const service = new AvailabilityService(db, new StaticHolidayProvider());

    // 2026-01-06 is a Tuesday (closed).
    const slots = await service.listSlots("biz-1", "Consultation", "2026-01-06");

    expect(slots).toEqual([]);
  });

  it("returns no slots when there is no published blueprint", async () => {
    const db = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      blueprints: [],
      bookings: [],
    });
    const service = new AvailabilityService(db, new StaticHolidayProvider());

    const slots = await service.listSlots("biz-1", "Consultation", "2026-01-05");

    expect(slots).toEqual([]);
  });
});

describe("AvailabilityService.listOpenDates", () => {
  beforeEach(() => {
    // 2026-01-05T01:00:00Z = 2026-01-05 09:00 SGT, a Monday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T01:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips closed weekdays and public holidays", async () => {
    const db = makeFakeDb({
      businesses: [{ id: "biz-1", region: "SG", timezone: "Asia/Singapore" }],
      blueprints: [
        {
          businessId: "biz-1",
          status: "published",
          services: [],
          hours: [
            { day: "monday", opens: "09:00", closes: "11:00" },
            { day: "tuesday", opens: "09:00", closes: "11:00" },
            { day: "wednesday", closed: true },
          ],
        },
      ],
      bookings: [],
    });
    const holidays = new StaticHolidayProvider({ "SG:2026": [{ date: "2026-01-06", name: "Test Holiday" }] });
    const service = new AvailabilityService(db, holidays);

    const dates = await service.listOpenDates("biz-1", 3);

    // Starting 2026-01-05 (Mon): Mon open, Tue is a holiday (excluded), Wed closed.
    expect(dates).toEqual(["2026-01-05"]);
  });
});
