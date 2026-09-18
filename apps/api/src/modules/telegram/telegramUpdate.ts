/** Minimal subset of the Telegram Bot API's Update object — only what this bot uses. */
export interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    message?: { chat: { id: number } };
    data?: string;
  };
}
