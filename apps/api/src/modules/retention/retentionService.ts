import type { PrismaClient } from "@gracesoft/db";

/**
 * Grace period between an Identity being marked for deletion and it actually being
 * purged, so a booker who returns just after the retention window still has continuity
 * rather than being silently re-created as a stranger.
 */
const DELETION_GRACE_PERIOD_DAYS = 7;

export interface RetentionRunSummary {
  identitiesScheduled: number;
  identitiesPurged: number;
  auditEntriesPurged: number;
}

/**
 * Implements "Retention/deletion policy written and implemented as an actual scheduled
 * job" (01-milestones.md Phase 0). Three passes, each independently idempotent:
 *   1. schedule  — mark identities past their business's retention window for deletion
 *   2. purge     — hard-delete identities whose grace period has elapsed
 *   3. purgeAudit — drop audit log rows past the business's audit retention window
 *
 * `now` is injected (not `new Date()` internally) so runs are deterministic in tests and
 * so a single job execution is consistent across all three passes.
 */
export class RetentionService {
  constructor(private readonly db: PrismaClient) {}

  async run(now: Date = new Date()): Promise<RetentionRunSummary> {
    const identitiesScheduled = await this.scheduleDeletions(now);
    const identitiesPurged = await this.purgeScheduledIdentities(now);
    const auditEntriesPurged = await this.purgeExpiredAuditEntries(now);
    return { identitiesScheduled, identitiesPurged, auditEntriesPurged };
  }

  /**
   * Marks identities for deletion when every booking under their token is in a terminal
   * state and the most recent one ended further back than the business's
   * `identityRetentionDays`. Identities with no bookings at all fall back to their own
   * `createdAt`. Already-scheduled identities are left untouched (idempotent).
   */
  async scheduleDeletions(now: Date): Promise<number> {
    const policies = await this.db.retentionPolicy.findMany();
    let scheduledCount = 0;

    for (const policy of policies) {
      const cutoff = daysBefore(now, policy.identityRetentionDays);

      const candidates = await this.db.identity.findMany({
        where: {
          businessId: policy.businessId,
          scheduledDeletionAt: null,
        },
        select: { id: true, token: true, createdAt: true },
      });

      for (const candidate of candidates) {
        const lastActivity = await this.lastBookingActivity(policy.businessId, candidate.token);
        const referenceDate = lastActivity ?? candidate.createdAt;

        if (referenceDate > cutoff) continue;
        if (lastActivity !== null && (await this.hasOpenBooking(policy.businessId, candidate.token))) {
          continue;
        }

        await this.db.identity.update({
          where: { id: candidate.id },
          data: { scheduledDeletionAt: addDays(now, DELETION_GRACE_PERIOD_DAYS) },
        });
        scheduledCount += 1;
      }
    }

    return scheduledCount;
  }

  async purgeScheduledIdentities(now: Date): Promise<number> {
    const result = await this.db.identity.deleteMany({
      where: { scheduledDeletionAt: { lte: now } },
    });
    return result.count;
  }

  async purgeExpiredAuditEntries(now: Date): Promise<number> {
    const policies = await this.db.retentionPolicy.findMany();
    let purgedCount = 0;

    for (const policy of policies) {
      const cutoff = daysBefore(now, policy.auditLogRetentionDays);
      const result = await this.db.tokenLookupAudit.deleteMany({
        where: { businessId: policy.businessId, lookedUpAt: { lt: cutoff } },
      });
      purgedCount += result.count;
    }

    return purgedCount;
  }

  private async lastBookingActivity(businessId: string, token: string): Promise<Date | null> {
    const latest = await this.db.booking.findFirst({
      where: { businessId, token },
      orderBy: { endsAt: "desc" },
      select: { endsAt: true },
    });
    return latest?.endsAt ?? null;
  }

  private async hasOpenBooking(businessId: string, token: string): Promise<boolean> {
    const openBooking = await this.db.booking.findFirst({
      where: {
        businessId,
        token,
        status: { in: ["pending", "confirmed", "checked_in"] },
      },
      select: { id: true },
    });
    return openBooking !== null;
  }
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
