/**
 * Phase 4 (Telegram Expansion): the outbound half of the bot — sending messages and
 * inline-keyboard prompts back to a chat. Same swappable-seam pattern as
 * CalendarAdapter/LlmProvider: TelegramBotService only ever depends on this interface.
 */
export interface InlineKeyboardButton {
  text: string;
  /** Echoed back on TelegramUpdate.callback_query.data when tapped. */
  callbackData: string;
}

export interface TelegramClient {
  sendMessage(chatId: string, text: string, buttons?: InlineKeyboardButton[][]): Promise<void>;
  /** Acknowledges a button tap so Telegram stops showing a loading spinner on it. */
  answerCallbackQuery(callbackQueryId: string): Promise<void>;
}

/**
 * Real implementation — the Telegram Bot API is plain HTTPS/JSON, no SDK needed. Needs
 * a real bot token from @BotFather (see apps/api/.env.example) — this environment
 * cannot create one (same kind of credentials gap as GoogleCalendarAdapter's Google
 * Cloud project). `buildApp()` falls back to `LoggingTelegramClient` below when
 * TELEGRAM_BOT_TOKEN is unset, so the conversation logic is fully exercisable without
 * a real token; wiring in a real one requires touching nothing else.
 */
export class TelegramBotApiClient implements TelegramClient {
  constructor(
    private readonly botToken: string,
    private readonly baseUrl = "https://api.telegram.org",
  ) {}

  async sendMessage(chatId: string, text: string, buttons?: InlineKeyboardButton[][]): Promise<void> {
    await this.call("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: buttons
        ? { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.callbackData }))) }
        : undefined,
    });
  }

  async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    await this.call("answerCallbackQuery", { callback_query_id: callbackQueryId });
  }

  private async call(method: string, body: unknown): Promise<void> {
    const res = await fetch(`${this.baseUrl}/bot${this.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Telegram API ${method} failed: HTTP ${res.status} — ${await res.text()}`);
    }
  }
}

/** Dev/no-token stand-in — logs instead of calling Telegram, so the bot is testable end
 * to end (including via a simulated webhook POST) without a real bot account. */
export class LoggingTelegramClient implements TelegramClient {
  constructor(private readonly log: (line: string) => void = console.log) {}

  async sendMessage(chatId: string, text: string, buttons?: InlineKeyboardButton[][]): Promise<void> {
    const buttonLines = (buttons ?? []).map((row) => row.map((b) => `[${b.text}]`).join(" ")).join("\n");
    this.log(`[telegram -> ${chatId}] ${text}${buttonLines ? `\n${buttonLines}` : ""}`);
  }

  async answerCallbackQuery(_callbackQueryId: string): Promise<void> {
    // no-op
  }
}
