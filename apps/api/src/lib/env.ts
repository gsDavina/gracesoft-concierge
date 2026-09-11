import { z } from "zod";

/**
 * Fails fast at boot if required config is missing, instead of surfacing as a runtime
 * error deep inside a webhook handler or encryption call.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Per-business encryption keys (Phase 0). In production these are resolved from the
  // platform secrets manager via Business.encryptionKeyId; GRACESOFT_DEV_ENCRYPTION_KEYS
  // is a local/dev-only stand-in — see modules/identity/keyProvider.ts.
  GRACESOFT_DEV_ENCRYPTION_KEYS: z.string().optional(),

  // Meta WhatsApp Cloud API (Phase 1+ wiring; not required for Phase 0 to boot).
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),

  // Telegram Bot API (Phase 4).
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}
