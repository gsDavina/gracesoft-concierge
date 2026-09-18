import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramBotService } from "../telegramBotService.js";
import type { InlineKeyboardButton, TelegramClient } from "../telegramClient.js";
import { AvailabilityService } from "../../booking/availabilityService.js";
import { BookingService } from "../../booking/bookingService.js";
import { InMemoryCalendarAdapter } from "../../booking/calendarAdapter.js";
import { StaticHolidayProvider } from "../../holiday/holidayProvider.js";
import { IdentityService } from "../../identity/identityService.js";
import { EnvKeyProvider } from "../../identity/keyProvider.js";

interface FakeSession {
  chatId: string;
  businessId: string;
  state: unknown;
}
interface FakeChannelIdentity {
  businessId: string;
  channel: string;
  channelUserId: string;
  token: string;
}
interface FakeBooking {
  id: string;
  businessId: string;
  token: string;
  serviceType: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  channel: string;
  calendarEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
interface FakeIdentity {
  id: string;
  businessId: string;
  token: string;
  encryptedName: string;
  encryptedPhone: string;
  encryptedNotes: string | null;
}

const PUBLISHED_BLUEPRINT = {
  businessId: "biz-1",
  status: "published",
  services: [{ name: "Consultation", durationMinutes: 30 }],
  hours: [{ day: "monday", opens: "09:00", closes: "10:00" }],
  faqs: [
    { question: "Is my information confidential?", answer: "Yes, it's encrypted and kept separate." },
    { question: "Can I get a diagnosis here?", answer: "No, this bot only handles bookings." },
  ],
};

function makeFakeDb() {
  const sessions: FakeSession[] = [];
  const channelIdentities: FakeChannelIdentity[] = [];
  const bookings: FakeBooking[] = [];
  const identities: FakeIdentity[] = [];
  let bookingCounter = 0;
  let identityCounter = 0;

  const db = {
    business: {
      findUniqueOrThrow: async () => ({
        id: "biz-1",
        region: "SG",
        timezone: "Asia/Singapore",
        encryptionKeyId: "test-key",
      }),
      findUnique: async () => ({ region: "SG", timezone: "Asia/Singapore", encryptionKeyId: "test-key" }),
    },
    blueprint: {
      findFirst: async () => PUBLISHED_BLUEPRINT,
    },
    booking: {
      findMany: async () => bookings.filter((b) => b.status !== "cancelled"),
      create: async ({ data }: { data: Omit<FakeBooking, "id" | "calendarEventId" | "createdAt" | "updatedAt"> }) => {
        const booking: FakeBooking = {
          ...data,
          id: `bk-${++bookingCounter}`,
          calendarEventId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        bookings.push(booking);
        return booking;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeBooking> }) => {
        const booking = bookings.find((b) => b.id === where.id)!;
        Object.assign(booking, data);
        return booking;
      },
    },
    identity: {
      create: async ({ data }: { data: Omit<FakeIdentity, "id"> }) => {
        const identity: FakeIdentity = { ...data, id: `id-${++identityCounter}` };
        identities.push(identity);
        return identity;
      },
    },
    channelIdentity: {
      findUnique: async ({
        where,
      }: {
        where: { businessId_channel_channelUserId: { businessId: string; channel: string; channelUserId: string } };
      }) => {
        const key = where.businessId_channel_channelUserId;
        return (
          channelIdentities.find(
            (c) => c.businessId === key.businessId && c.channel === key.channel && c.channelUserId === key.channelUserId,
          ) ?? null
        );
      },
      create: async ({ data }: { data: FakeChannelIdentity }) => {
        channelIdentities.push(data);
        return data;
      },
    },
    telegramSession: {
      findUnique: async ({ where }: { where: { chatId: string } }) =>
        sessions.find((s) => s.chatId === where.chatId) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { chatId: string };
        create: FakeSession;
        update: { state: unknown };
      }) => {
        const existing = sessions.find((s) => s.chatId === where.chatId);
        if (existing) {
          existing.state = update.state;
          return existing;
        }
        sessions.push(create);
        return create;
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { db, bookings, identities, channelIdentities };
}

function makeFakeTelegramClient() {
  const sent: { chatId: string; text: string; buttons?: InlineKeyboardButton[][] }[] = [];
  const client: TelegramClient = {
    async sendMessage(chatId, text, buttons) {
      sent.push({ chatId, text, buttons });
    },
    async answerCallbackQuery() {},
  };
  return { client, sent };
}

describe("TelegramBotService — full booking conversation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-01-05 is a Monday.
    vi.setSystemTime(new Date("2026-01-05T01:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeService(db: ReturnType<typeof makeFakeDb>["db"], telegram: TelegramClient) {
    const keyProvider = new EnvKeyProvider('{"test-key":"' + Buffer.alloc(32, 1).toString("base64") + '"}');
    const identityService = new IdentityService(db, keyProvider);
    const bookingService = new BookingService(db, new InMemoryCalendarAdapter(), new StaticHolidayProvider());
    const availabilityService = new AvailabilityService(db, new StaticHolidayProvider());
    return new TelegramBotService(db, "biz-1", identityService, bookingService, availabilityService, telegram);
  }

  it("walks a brand-new booker through service -> date -> time -> name -> phone -> confirmed booking", async () => {
    const { db, bookings, identities, channelIdentities } = makeFakeDb();
    const { client, sent } = makeFakeTelegramClient();
    const bot = makeService(db, client);
    const chatId = "12345";

    await bot.handleUpdate({ message: { chat: { id: 12345 }, text: "/book" } });
    expect(sent.at(-1)?.buttons?.[0]?.[0]).toEqual({ text: "Consultation", callbackData: "svc:Consultation" });

    await bot.handleUpdate({
      callback_query: { id: "cb1", message: { chat: { id: 12345 } }, data: "svc:Consultation" },
    });
    expect(sent.at(-1)?.buttons?.[0]?.[0]?.callbackData).toBe("date:2026-01-05");

    await bot.handleUpdate({
      callback_query: { id: "cb2", message: { chat: { id: 12345 } }, data: "date:2026-01-05" },
    });
    expect(sent.at(-1)?.buttons?.[0]?.[0]).toEqual({ text: "09:00", callbackData: "time:09:00" });

    await bot.handleUpdate({
      callback_query: { id: "cb3", message: { chat: { id: 12345 } }, data: "time:09:00" },
    });
    expect(sent.at(-1)?.text).toMatch(/what's your name/i);

    await bot.handleUpdate({ message: { chat: { id: 12345 }, text: "Alex Tan" } });
    expect(sent.at(-1)?.text).toMatch(/phone number/i);

    await bot.handleUpdate({ message: { chat: { id: 12345 }, text: "+65 9123 4567" } });
    expect(sent.at(-1)?.text).toMatch(/you're booked/i);

    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ businessId: "biz-1", serviceType: "Consultation", channel: "telegram" });
    expect(identities).toHaveLength(1);
    expect(channelIdentities).toEqual([
      { businessId: "biz-1", channel: "telegram", channelUserId: chatId, token: bookings[0]!.token },
    ]);
  });

  it("skips the name/phone prompts for a returning booker with an existing ChannelIdentity", async () => {
    const { db, bookings } = makeFakeDb();
    db.channelIdentity.create({
      data: { businessId: "biz-1", channel: "telegram", channelUserId: "999", token: "tok_existing" },
    });
    const { client, sent } = makeFakeTelegramClient();
    const bot = makeService(db, client);

    await bot.handleUpdate({ message: { chat: { id: 999 }, text: "/book" } });
    await bot.handleUpdate({ callback_query: { id: "cb1", message: { chat: { id: 999 } }, data: "svc:Consultation" } });
    await bot.handleUpdate({ callback_query: { id: "cb2", message: { chat: { id: 999 } }, data: "date:2026-01-05" } });
    await bot.handleUpdate({ callback_query: { id: "cb3", message: { chat: { id: 999 } }, data: "time:09:00" } });

    expect(sent.at(-1)?.text).toMatch(/you're booked/i);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]?.token).toBe("tok_existing");
  });

  it("/cancel resets the conversation", async () => {
    const { db } = makeFakeDb();
    const { client, sent } = makeFakeTelegramClient();
    const bot = makeService(db, client);

    await bot.handleUpdate({ message: { chat: { id: 1 }, text: "/book" } });
    await bot.handleUpdate({ callback_query: { id: "cb1", message: { chat: { id: 1 } }, data: "svc:Consultation" } });
    await bot.handleUpdate({ message: { chat: { id: 1 }, text: "/cancel" } });

    expect(sent.at(-1)?.text).toMatch(/cancelled/i);

    // A stray message after cancelling should get the generic prompt, not be treated
    // as mid-flow input.
    await bot.handleUpdate({ message: { chat: { id: 1 }, text: "hello" } });
    expect(sent.at(-1)?.text).toMatch(/type \/book/i);
  });

  it("/faq lists the business's published FAQs and answers the one tapped", async () => {
    const { db } = makeFakeDb();
    const { client, sent } = makeFakeTelegramClient();
    const bot = makeService(db, client);

    await bot.handleUpdate({ message: { chat: { id: 2 }, text: "/faq" } });
    expect(sent.at(-1)?.buttons?.[1]?.[0]).toEqual({
      text: "Can I get a diagnosis here?",
      callbackData: "faq:1",
    });

    await bot.handleUpdate({ callback_query: { id: "cb1", message: { chat: { id: 2 } }, data: "faq:1" } });
    expect(sent.at(-1)?.text).toContain("No, this bot only handles bookings.");
  });

  it("/faq does not disturb an in-progress booking's session state", async () => {
    const { db, bookings } = makeFakeDb();
    const { client } = makeFakeTelegramClient();
    const bot = makeService(db, client);

    await bot.handleUpdate({ message: { chat: { id: 3 }, text: "/book" } });
    await bot.handleUpdate({ callback_query: { id: "cb1", message: { chat: { id: 3 } }, data: "svc:Consultation" } });
    await bot.handleUpdate({ message: { chat: { id: 3 }, text: "/faq" } });
    // Resume the booking flow right where it left off (date selection).
    await bot.handleUpdate({ callback_query: { id: "cb2", message: { chat: { id: 3 } }, data: "date:2026-01-05" } });
    await bot.handleUpdate({ callback_query: { id: "cb3", message: { chat: { id: 3 } }, data: "time:09:00" } });
    await bot.handleUpdate({ message: { chat: { id: 3 }, text: "Alex" } });
    await bot.handleUpdate({ message: { chat: { id: 3 }, text: "+65 9000 0000" } });

    expect(bookings).toHaveLength(1);
  });
});
