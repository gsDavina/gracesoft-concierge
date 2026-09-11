import type { Booking, BookingChannel, CreateBookingInput } from "./booking.js";

/** API contract types shared between apps/api and both admin frontends. */
export interface ApiErrorBody {
  error: string;
  message: string;
}

export interface CreateBookingRequest extends CreateBookingInput {}
export interface CreateBookingResponse {
  booking: Booking;
}

export interface ListBookingsQuery {
  businessId: string;
  date?: string; // YYYY-MM-DD
  channel?: BookingChannel;
}
export interface ListBookingsResponse {
  bookings: Booking[];
}

export interface CheckInRequest {
  businessId: string;
  token: string;
}
export interface CheckInResponse {
  booking: Booking;
}

export interface TokenLookupRequest {
  businessId: string;
  token: string;
  reason: string;
}
export interface TokenLookupResponse {
  name: string;
  phone: string;
  notes: string | null;
}
