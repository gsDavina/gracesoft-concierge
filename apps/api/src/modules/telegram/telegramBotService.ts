import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@gracesoft/db";
import type { AvailabilityService } from "../booking/availabilityService.js";
import { HolidayBlockedError, type BookingService } from "../booking/bookingService.js";
import type { IdentityService } from "../identity/identityService.js";
import type { InlineKeyboardButton, TelegramClient } from "./telegramClient.js";
import type { TelegramUpdate } from "./telegramUpdate.js";

type SessionState =
  | { step: "idle" }
  | { step: "service" }
  | { step: "date"; serviceType: string }
  | { step: "time"; serviceType: string; date: string }
  | { step: "awaiting_name"; serviceType: string; date: string; time: string }
  | { step: "awaiting_phone"; serviceType: string; date: string; time: string; name: string };

const IDLE_STATE: SessionState = { step: "idle" };

/**
 * Phase 4 (Telegram Expansion): the actual booking conversation. A stateless webhook
 * handler calls `handleUpdate` per incoming Telegram update; per-chat progress through
 * the flow is persisted in `TelegramSession` (see packages/db/prisma/schema.prisma) so
 * it survives across the request boundary.
 *
 * Single-tenant per bot: one Telegram bot (and its token) serves exactly one business —
 * see TELEGRAM_BUSINESS_ID in apps/api/src/lib/env.ts. Routing one bot across many
 * businesses would need a different webhook-per-business or bot-command-based business
 * selection, out of scope for this pilot-scale wedge feature.
 */
export class TelegramBotService {
  constructor(
    private readonly db: PrismaClient,
    private readonly businessId: string,
    private readonly identityService: IdentityService,
    private readonly bookingService: BookingService,
    private readonly availability: AvailabilityService,
    private readonly telegram: TelegramClient,
    private readonly onError: (err: unknown) => void = () => {},
  ) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.handleCallback(update.callback_query);
      return;
    }
    if (update.message?.text) {
      await this.handleMessage(String(update.message.chat.id), update.message.text.trim());
    }
  }

  private async handleMessage(chatId: string, text: string): Promise<void> {
    const lower = text.toLowerCase();
    if (lower === "/start" || lower === "/book") {
      await this.setState(chatId, { step: "service" });
      await this.promptService(chatId);
      return;
    }
    if (lower === "/cancel") {
      await this.setState(chatId, IDLE_STATE);
      await this.telegram.sendMessage(chatId, "Okay, cancelled. Type /book to start a new booking.");
      return;
    }

    const state = await this.getState(chatId);
    if (state.step === "awaiting_name") {
      if (!text) {
        await this.telegram.sendMessage(chatId, "Please enter your name.");
        return;
      }
      await this.setState(chatId, { ...state, step: "awaiting_phone", name: text });
      await this.telegram.sendMessage(chatId, "And your phone number?");
      return;
    }
    if (state.step === "awaiting_phone") {
      if (!text) {
        await this.telegram.sendMessage(chatId, "Please enter your phone number.");
        return;
      }
      await this.completeNewBookerBooking(chatId, state, text);
      return;
    }

    await this.telegram.sendMessage(chatId, "Type /book to book an appointment.");
  }

  private async handleCallback(
    callbackQuery: NonNullable<TelegramUpdate["callback_query"]>,
  ): Promise<void> {
    await this.telegram.answerCallbackQuery(callbackQuery.id);
    const chatId = callbackQuery.message ? String(callbackQuery.message.chat.id) : undefined;
    const data = callbackQuery.data;
    if (!chatId || !data) return;

    const [kind, ...rest] = data.split(":");
    const value = rest.join(":");

    if (kind === "svc") {
      await this.setState(chatId, { step: "date", serviceType: value });
      await this.promptDate(chatId, value);
      return;
    }
    if (kind === "date") {
      const state = await this.getState(chatId);
      if (state.step !== "date") return;
      await this.setState(chatId, { step: "time", serviceType: state.serviceType, date: value });
      await this.promptTime(chatId, state.serviceType, value);
      return;
    }
    if (kind === "time") {
      const state = await this.getState(chatId);
      if (state.step !== "time") return;
      await this.handleTimeChosen(chatId, state.serviceType, state.date, value);
    }
  }

  private async promptService(chatId: string): Promise<void> {
    const services = await this.availability.listPublishedServices(this.businessId);
    if (services.length === 0) {
      await this.setState(chatId, IDLE_STATE);
      await this.telegram.sendMessage(
        chatId,
        "Sorry, online booking isn't set up for this business yet. Please call us directly.",
      );
      return;
    }
    const buttons: InlineKeyboardButton[][] = services.map((s) => [
      { text: s.name, callbackData: `svc:${s.name}` },
    ]);
    await this.telegram.sendMessage(chatId, "Which service would you like to book?", buttons);
  }

  private async promptDate(chatId: string, serviceType: string): Promise<void> {
    const dates = await this.availability.listOpenDates(this.businessId);
    if (dates.length === 0) {
      await this.setState(chatId, IDLE_STATE);
      await this.telegram.sendMessage(chatId, "Sorry, there are no open dates in the next week. Please try again later.");
      return;
    }
    const buttons: InlineKeyboardButton[][] = dates.map((d) => [{ text: d, callbackData: `date:${d}` }]);
    await this.telegram.sendMessage(chatId, `Great, ${serviceType}. Which date works for you?`, buttons);
  }

  private async promptTime(chatId: string, serviceType: string, date: string): Promise<void> {
    const slots = await this.availability.listSlots(this.businessId, serviceType, date);
    if (slots.length === 0) {
      await this.setState(chatId, { step: "date", serviceType });
      await this.telegram.sendMessage(chatId, "No times are free that day — please pick another date.");
      await this.promptDate(chatId, serviceType);
      return;
    }
    const buttons: InlineKeyboardButton[][] = slots.map((s) => [{ text: s.time, callbackData: `time:${s.time}` }]);
    await this.telegram.sendMessage(chatId, `${date} — what time?`, buttons);
  }

  private async handleTimeChosen(chatId: string, serviceType: string, date: string, time: string): Promise<void> {
    const channelIdentity = await this.db.channelIdentity.findUnique({
      where: { businessId_channel_channelUserId: { businessId: this.businessId, channel: "telegram", channelUserId: chatId } },
    });

    if (channelIdentity) {
      await this.finalizeBooking(chatId, serviceType, date, time, channelIdentity.token);
      return;
    }

    await this.setState(chatId, { step: "awaiting_name", serviceType, date, time });
    await this.telegram.sendMessage(chatId, "First time booking with us here — what's your name?");
  }

  private async completeNewBookerBooking(
    chatId: string,
    state: Extract<SessionState, { step: "awaiting_phone" }>,
    phone: string,
  ): Promise<void> {
    const token = `tok_${randomBytes(8).toString("hex")}`;
    await this.identityService.create({ businessId: this.businessId, token, name: state.name, phone });
    await this.db.channelIdentity.create({
      data: { businessId: this.businessId, channel: "telegram", channelUserId: chatId, token },
    });
    await this.finalizeBooking(chatId, state.serviceType, state.date, state.time, token);
  }

  private async finalizeBooking(
    chatId: string,
    serviceType: string,
    date: string,
    time: string,
    token: string,
  ): Promise<void> {
    const slots = await this.availability.listSlots(this.businessId, serviceType, date);
    const slot = slots.find((s) => s.time === time);
    if (!slot) {
      await this.setState(chatId, { step: "date", serviceType });
      await this.telegram.sendMessage(chatId, "Sorry, that time was just taken — please pick another date.");
      await this.promptDate(chatId, serviceType);
      return;
    }

    try {
      await this.bookingService.create({
        businessId: this.businessId,
        token,
        serviceType,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        channel: "telegram",
      });
      await this.setState(chatId, IDLE_STATE);
      await this.telegram.sendMessage(
        chatId,
        `You're booked: ${serviceType} on ${date} at ${time}. We'll see you then! Type /book to make another booking.`,
      );
    } catch (err) {
      await this.setState(chatId, IDLE_STATE);
      if (!(err instanceof HolidayBlockedError)) {
        this.onError(err);
      }
      const message =
        err instanceof HolidayBlockedError
          ? "Sorry, that date turned out to be a public holiday. Type /book to try another date."
          : "Sorry, something went wrong booking that slot. Type /book to try again.";
      await this.telegram.sendMessage(chatId, message);
    }
  }

  private async getState(chatId: string): Promise<SessionState> {
    const session = await this.db.telegramSession.findUnique({ where: { chatId } });
    return (session?.state as SessionState | undefined) ?? IDLE_STATE;
  }

  private async setState(chatId: string, state: SessionState): Promise<void> {
    await this.db.telegramSession.upsert({
      where: { chatId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { chatId, businessId: this.businessId, state: state as any },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: { state: state as any },
    });
  }
}
