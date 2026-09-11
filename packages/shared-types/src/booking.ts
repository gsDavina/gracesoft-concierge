/**
 * Booking-side types only. Per the Phase 0 privacy layer, a booking record — and the
 * calendar event derived from it — never carries name, phone, or notes. Those live only
 * in the separate, encrypted identity store (see identity.ts) and are joined via `token`.
 */
export type BookingStatus = "pending" | "confirmed" | "checked-in" | "cancelled" | "completed";

export type BookingChannel = "whatsapp" | "telegram" | "admin";

export interface Booking {
  id: string;
  businessId: string;
  /** Opaque booker token. The only link back to identity — never a name or phone number. */
  token: string;
  serviceType: string;
  startsAt: string; // ISO 8601
  endsAt: string; // ISO 8601
  status: BookingStatus;
  channel: BookingChannel;
  calendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingInput {
  businessId: string;
  token: string;
  serviceType: string;
  startsAt: string;
  endsAt: string;
  channel: BookingChannel;
}
