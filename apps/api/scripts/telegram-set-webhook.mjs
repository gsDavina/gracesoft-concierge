/**
 * One-time setup: registers this deployment's public URL as the Telegram webhook for
 * TELEGRAM_BOT_TOKEN. Run once per environment (or whenever the public URL changes).
 *
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... node scripts/telegram-set-webhook.mjs https://your-api.example.com
 *
 * The URL must be publicly reachable over HTTPS — for local dev, use a tunnel (ngrok,
 * cloudflared) and pass its https:// URL here.
 */
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const publicUrl = process.argv[2];

if (!botToken || !webhookSecret) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in the environment first.");
  process.exit(1);
}
if (!publicUrl) {
  console.error("Usage: node scripts/telegram-set-webhook.mjs https://your-api.example.com");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `${publicUrl.replace(/\/$/, "")}/webhooks/telegram`,
    secret_token: webhookSecret,
  }),
});

const body = await res.json();
console.log(JSON.stringify(body, null, 2));
if (!res.ok || !body.ok) {
  process.exit(1);
}
