import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import { getDb, type PrismaClient } from "@gracesoft/db";
import Fastify, { type FastifyInstance } from "fastify";
import { getEnv } from "./lib/env.js";
import { registerErrorHandler } from "./lib/errorHandler.js";
import authPlugin, { DevSessionProvider } from "./plugins/auth.js";
import type { SessionProvider } from "@gracesoft/auth";
import { EnvKeyProvider, type KeyProvider } from "./modules/identity/keyProvider.js";
import { IdentityService } from "./modules/identity/identityService.js";
import { InMemoryCalendarAdapter, type CalendarAdapter } from "./modules/booking/calendarAdapter.js";
import { BookingService } from "./modules/booking/bookingService.js";
import { NagerDateHolidayProvider, type HolidayProvider } from "./modules/holiday/holidayProvider.js";
import { AnthropicLlmProvider, HeuristicLlmProvider, type LlmProvider } from "./modules/onboarding/llmProvider.js";
import { OnboardingService } from "./modules/onboarding/onboardingService.js";
import identityRoutes from "./routes/identity.js";
import bookingRoutes from "./routes/bookings.js";
import holidayRoutes from "./routes/holidays.js";
import onboardingRoutes from "./routes/onboarding.js";
import healthRoutes from "./routes/health.js";

export interface BuildAppOptions {
  db?: PrismaClient;
  sessionProvider?: SessionProvider;
  keyProvider?: KeyProvider;
  calendarAdapter?: CalendarAdapter;
  holidayProvider?: HolidayProvider;
  llmProvider?: LlmProvider;
}

/**
 * Assembles the Fastify instance with all dependencies explicit and overridable, so
 * routes are testable against fakes without touching env/DB/network — see
 * `sessionProvider`/`keyProvider`/`calendarAdapter` above.
 */
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = getEnv();
  const db = opts.db ?? getDb();
  const sessionProvider = opts.sessionProvider ?? new DevSessionProvider();
  const keyProvider = opts.keyProvider ?? new EnvKeyProvider(env.GRACESOFT_DEV_ENCRYPTION_KEYS);
  const calendarAdapter = opts.calendarAdapter ?? new InMemoryCalendarAdapter();

  const app = Fastify({ logger: true });
  registerErrorHandler(app);

  const holidayProvider =
    opts.holidayProvider ??
    new NagerDateHolidayProvider(undefined, (err) => app.log.warn({ err }, "holiday lookup failed"));
  const llmProvider =
    opts.llmProvider ?? (env.ANTHROPIC_API_KEY ? new AnthropicLlmProvider(env.ANTHROPIC_API_KEY) : new HeuristicLlmProvider());
  if (!opts.llmProvider && !env.ANTHROPIC_API_KEY) {
    app.log.warn(
      "ANTHROPIC_API_KEY not set — onboarding auto-draft is using HeuristicLlmProvider (low-quality, non-LLM extraction)",
    );
  }

  await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true });
  await app.register(sensible);
  await app.register(multipart);
  await app.register(authPlugin, { sessionProvider });

  const identityService = new IdentityService(db, keyProvider);
  const bookingService = new BookingService(db, calendarAdapter, holidayProvider);
  const onboardingService = new OnboardingService(db, llmProvider);

  await app.register(healthRoutes);
  await app.register(identityRoutes, { identityService });
  await app.register(bookingRoutes, { bookingService });
  await app.register(holidayRoutes, { db, holidayProvider });
  await app.register(onboardingRoutes, { db, onboardingService });

  return app;
}
