import { z } from "zod";

/**
 * Fails fast at boot if required config is missing, instead of surfacing as a runtime
 * error deep inside a webhook handler or encryption call.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Comma-separated origins allowed to call the API (the two admin frontends in dev/prod).
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3001,http://localhost:3002")
    .transform((value) => value.split(",").map((origin) => origin.trim())),

  // Per-business encryption keys (Phase 0). In production these are resolved from the
  // platform secrets manager via Business.encryptionKeyId; GRACESOFT_DEV_ENCRYPTION_KEYS
  // is a local/dev-only stand-in — see modules/identity/keyProvider.ts.
  GRACESOFT_DEV_ENCRYPTION_KEYS: z.string().optional(),

  // Meta WhatsApp Cloud API (Phase 1+ wiring; not required for Phase 0 to boot).
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),

  // Telegram Bot API (Phase 4). TELEGRAM_BOT_TOKEN is required to actually send
  // messages (from @BotFather); without it apps/api falls back to LoggingTelegramClient
  // (modules/telegram/telegramClient.ts), which logs instead of calling Telegram, so the
  // bot's conversation logic stays fully exercisable without a real bot account.
  // TELEGRAM_WEBHOOK_SECRET is the secret token Telegram echoes back in the
  // X-Telegram-Bot-Api-Secret-Token header on every webhook call — required to accept
  // any webhook traffic at all, since that endpoint is otherwise unauthenticated.
  // TELEGRAM_BUSINESS_ID is which business this bot instance serves — one bot per
  // business, see telegramBotService.ts.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_BUSINESS_ID: z.string().optional(),

  // Phase 1 onboarding wizard auto-draft step. Without this, the app falls back to
  // HeuristicLlmProvider (modules/onboarding/llmProvider.ts) — a real but low-quality
  // keyword-based extractor, so onboarding is still usable end-to-end in dev without an
  // API key, just not with LLM-quality drafts.
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}
