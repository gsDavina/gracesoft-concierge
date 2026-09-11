import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import type { RetentionService } from "./retentionService.js";

/** Runs the retention job once a day at 03:00 (low-traffic hours). */
const DAILY_SCHEDULE = "0 3 * * *";

export function scheduleRetentionJob(
  retentionService: RetentionService,
  logger: FastifyBaseLogger,
): cron.ScheduledTask {
  return cron.schedule(DAILY_SCHEDULE, async () => {
    try {
      const summary = await retentionService.run();
      logger.info({ summary }, "retention job completed");
    } catch (err) {
      logger.error({ err }, "retention job failed");
    }
  });
}
