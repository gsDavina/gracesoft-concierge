import type { FastifyInstance } from "fastify";
import type { TelegramBotService } from "../modules/telegram/telegramBotService.js";
import type { TelegramUpdate } from "../modules/telegram/telegramUpdate.js";

export interface TelegramWebhookRoutesOptions {
  telegramBotService: TelegramBotService | null;
  webhookSecret: string | undefined;
}

/**
 * Phase 4 (Telegram Expansion). Public, unauthenticated by design (Telegram calls this
 * directly) — protected instead by the secret token Telegram echoes back in
 * `X-Telegram-Bot-Api-Secret-Token`, set when registering the webhook URL with Telegram
 * (see apps/api/scripts/telegram-set-webhook.mjs). Refuses all traffic if
 * TELEGRAM_WEBHOOK_SECRET isn't configured, or if the bot isn't wired up (no
 * TELEGRAM_BUSINESS_ID) — safer than silently accepting unverified webhook calls.
 *
 * Always replies 200 quickly: Telegram retries (and eventually gives up on) a webhook
 * that doesn't ack fast, and a transient error handling one update shouldn't cause
 * Telegram to keep hammering the same update.
 */
export default async function telegramWebhookRoutes(
  fastify: FastifyInstance,
  opts: TelegramWebhookRoutesOptions,
) {
  fastify.post<{ Body: TelegramUpdate }>("/webhooks/telegram", async (request, reply) => {
    if (!opts.webhookSecret || !opts.telegramBotService) {
      return reply.status(404).send();
    }

    const secret = request.headers["x-telegram-bot-api-secret-token"];
    if (secret !== opts.webhookSecret) {
      return reply.status(401).send();
    }

    try {
      await opts.telegramBotService.handleUpdate(request.body);
    } catch (err) {
      request.log.error({ err }, "telegram update handling failed");
    }
    return reply.status(200).send({ ok: true });
  });
}
