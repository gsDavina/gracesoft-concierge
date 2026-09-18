import type { Booking, BookingChannel, CreateBookingInput } from "./booking.js";
import type { Holiday } from "./holiday.js";
import type { Blueprint, BlueprintContentInput, OnboardingSource } from "./blueprint.js";

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

export interface AuditLogEntry {
  id: string;
  token: string;
  reason: string;
  lookedUpAt: string;
  actorAuthSubject: string;
}
export interface AuditLogResponse {
  entries: AuditLogEntry[];
}

export interface ListHolidaysQuery {
  businessId: string;
  year: number;
}
export interface ListHolidaysResponse {
  holidays: Holiday[];
}

export interface SubmitUrlSourceRequest {
  businessId: string;
  url: string;
}
export interface SubmitSourceResponse {
  source: OnboardingSource;
}

export interface ListSourcesResponse {
  sources: OnboardingSource[];
}

export interface GenerateDraftRequest {
  businessId: string;
}
export interface GenerateDraftResponse {
  blueprint: Blueprint;
}

export interface GetBlueprintResponse {
  blueprint: Blueprint | null;
}

export interface UpdateBlueprintRequest extends BlueprintContentInput {
  businessId: string;
}
export interface UpdateBlueprintResponse {
  blueprint: Blueprint;
}

export interface PublishBlueprintRequest {
  businessId: string;
}
export interface PublishBlueprintResponse {
  blueprint: Blueprint;
}

export type VerticalTemplateName = "clinic";
export interface GetVerticalTemplateResponse {
  template: BlueprintContentInput;
}
