import { getDb } from "@gracesoft/db";
import { buildApp } from "./app.js";
import { getEnv } from "./lib/env.js";
import { RetentionService } from "./modules/retention/retentionService.js";
import { scheduleRetentionJob } from "./modules/retention/cron.js";

async function main() {
  const env = getEnv();
  const app = await buildApp();

  const retentionService = new RetentionService(getDb());
  scheduleRetentionJob(retentionService, app.log);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
