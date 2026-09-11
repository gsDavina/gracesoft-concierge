import { describe, expect, it } from "vitest";
import { RetentionService } from "../retentionService.js";

interface FakeIdentity {
  id: string;
  businessId: string;
  token: string;
  createdAt: Date;
  scheduledDeletionAt: Date | null;
}

interface FakeBooking {
  id: string;
  businessId: string;
  token: string;
  status: "pending" | "confirmed" | "checked_in" | "cancelled" | "completed";
  endsAt: Date;
}

interface FakeAudit {
  id: string;
  businessId: string;
  lookedUpAt: Date;
}

interface FakePolicy {
  businessId: string;
  identityRetentionDays: number;
  auditLogRetentionDays: number;
}

/** Minimal in-memory stand-in for the slice of PrismaClient RetentionService calls. */
function makeFakeDb(seed: {
  identities: FakeIdentity[];
  bookings: FakeBooking[];
  audits: FakeAudit[];
  policies: FakePolicy[];
}) {
  const db = {
    retentionPolicy: {
      findMany: async () => seed.policies,
    },
    identity: {
      findMany: async ({ where }: { where: { businessId: string; scheduledDeletionAt: null } }) =>
        seed.identities.filter(
          (i) => i.businessId === where.businessId && i.scheduledDeletionAt === null,
        ),
      update: async ({ where, data }: { where: { id: string }; data: { scheduledDeletionAt: Date } }) => {
        const identity = seed.identities.find((i) => i.id === where.id);
        if (identity) identity.scheduledDeletionAt = data.scheduledDeletionAt;
        return identity;
      },
      deleteMany: async ({ where }: { where: { scheduledDeletionAt: { lte: Date } } }) => {
        const before = seed.identities.length;
        seed.identities = seed.identities.filter(
          (i) => !(i.scheduledDeletionAt && i.scheduledDeletionAt <= where.scheduledDeletionAt.lte),
        );
        return { count: before - seed.identities.length };
      },
    },
    booking: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: { businessId: string; token: string; status?: { in: string[] } };
        orderBy?: { endsAt: "desc" };
      }) => {
        let matches = seed.bookings.filter(
          (b) => b.businessId === where.businessId && b.token === where.token,
        );
        if (where.status) {
          matches = matches.filter((b) => where.status!.in.includes(b.status));
        }
        if (orderBy) {
          matches = [...matches].sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
        }
        return matches[0] ?? null;
      },
    },
    tokenLookupAudit: {
      deleteMany: async ({ where }: { where: { businessId: string; lookedUpAt: { lt: Date } } }) => {
        const before = seed.audits.length;
        seed.audits = seed.audits.filter(
          (a) => !(a.businessId === where.businessId && a.lookedUpAt < where.lookedUpAt.lt),
        );
        return { count: before - seed.audits.length };
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { db, seed };
}

describe("RetentionService", () => {
  const now = new Date("2026-09-11T00:00:00Z");

  it("schedules deletion for an identity whose last booking is past the retention window", async () => {
    const { db } = makeFakeDb({
      identities: [
        {
          id: "id-1",
          businessId: "biz-1",
          token: "tok-1",
          createdAt: new Date("2024-01-01"),
          scheduledDeletionAt: null,
        },
      ],
      bookings: [
        {
          id: "bk-1",
          businessId: "biz-1",
          token: "tok-1",
          status: "completed",
          endsAt: new Date("2025-01-01"), // ~8 months before `now`
        },
      ],
      audits: [],
      policies: [{ businessId: "biz-1", identityRetentionDays: 180, auditLogRetentionDays: 730 }],
    });

    const service = new RetentionService(db);
    const scheduled = await service.scheduleDeletions(now);

    expect(scheduled).toBe(1);
  });

  it("does not schedule deletion for an identity with an open booking", async () => {
    const { db } = makeFakeDb({
      identities: [
        {
          id: "id-1",
          businessId: "biz-1",
          token: "tok-1",
          createdAt: new Date("2024-01-01"),
          scheduledDeletionAt: null,
        },
      ],
      bookings: [
        {
          id: "bk-1",
          businessId: "biz-1",
          token: "tok-1",
          status: "confirmed",
          endsAt: new Date("2025-01-01"),
        },
      ],
      audits: [],
      policies: [{ businessId: "biz-1", identityRetentionDays: 180, auditLogRetentionDays: 730 }],
    });

    const service = new RetentionService(db);
    const scheduled = await service.scheduleDeletions(now);

    expect(scheduled).toBe(0);
  });

  it("does not schedule deletion for a recently active identity", async () => {
    const { db } = makeFakeDb({
      identities: [
        {
          id: "id-1",
          businessId: "biz-1",
          token: "tok-1",
          createdAt: new Date("2026-08-01"),
          scheduledDeletionAt: null,
        },
      ],
      bookings: [
        {
          id: "bk-1",
          businessId: "biz-1",
          token: "tok-1",
          status: "completed",
          endsAt: new Date("2026-08-15"),
        },
      ],
      audits: [],
      policies: [{ businessId: "biz-1", identityRetentionDays: 180, auditLogRetentionDays: 730 }],
    });

    const service = new RetentionService(db);
    const scheduled = await service.scheduleDeletions(now);

    expect(scheduled).toBe(0);
  });

  it("purges identities whose grace period has elapsed, and leaves others alone", async () => {
    const { db, seed } = makeFakeDb({
      identities: [
        {
          id: "due",
          businessId: "biz-1",
          token: "tok-1",
          createdAt: new Date("2024-01-01"),
          scheduledDeletionAt: new Date("2026-09-01"),
        },
        {
          id: "not-due",
          businessId: "biz-1",
          token: "tok-2",
          createdAt: new Date("2024-01-01"),
          scheduledDeletionAt: new Date("2026-12-01"),
        },
      ],
      bookings: [],
      audits: [],
      policies: [],
    });

    const service = new RetentionService(db);
    const purged = await service.purgeScheduledIdentities(now);

    expect(purged).toBe(1);
    expect(seed.identities.map((i) => i.id)).toEqual(["not-due"]);
  });

  it("purges audit entries older than the business's audit retention window", async () => {
    const { db } = makeFakeDb({
      identities: [],
      bookings: [],
      audits: [
        { id: "old", businessId: "biz-1", lookedUpAt: new Date("2020-01-01") },
        { id: "recent", businessId: "biz-1", lookedUpAt: new Date("2026-08-01") },
      ],
      policies: [{ businessId: "biz-1", identityRetentionDays: 180, auditLogRetentionDays: 730 }],
    });

    const service = new RetentionService(db);
    const purged = await service.purgeExpiredAuditEntries(now);

    expect(purged).toBe(1);
  });
});
