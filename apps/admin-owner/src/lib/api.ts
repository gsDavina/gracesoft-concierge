import type {
  AuditLogResponse,
  AuthenticatedActor,
  BlueprintContentInput,
  GenerateDraftResponse,
  GetBlueprintResponse,
  ListBookingsResponse,
  ListHolidaysResponse,
  ListSourcesResponse,
  PublishBlueprintResponse,
  SubmitSourceResponse,
  TokenLookupResponse,
  UpdateBlueprintResponse,
} from "@gracesoft/shared-types";
import { getBearerToken } from "./session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, actor: AuthenticatedActor, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      // Fastify's JSON body parser rejects an empty body sent with this header (e.g. the
      // no-body POSTs below), so only set it when there's actually a body to parse.
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${getBearerToken(actor)}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export function fetchBookings(actor: AuthenticatedActor): Promise<ListBookingsResponse> {
  return request<ListBookingsResponse>(
    `/bookings?businessId=${encodeURIComponent(actor.businessId)}`,
    actor,
  );
}

export function fetchAuditLog(actor: AuthenticatedActor): Promise<AuditLogResponse> {
  return request<AuditLogResponse>(
    `/businesses/${encodeURIComponent(actor.businessId)}/audit-log`,
    actor,
  );
}

export function lookupIdentity(
  actor: AuthenticatedActor,
  token: string,
  reason: string,
): Promise<TokenLookupResponse> {
  return request<TokenLookupResponse>(
    `/businesses/${encodeURIComponent(actor.businessId)}/identities/${encodeURIComponent(token)}/lookup`,
    actor,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export function fetchHolidays(actor: AuthenticatedActor, year: number): Promise<ListHolidaysResponse> {
  return request<ListHolidaysResponse>(
    `/businesses/${encodeURIComponent(actor.businessId)}/holidays?year=${year}`,
    actor,
  );
}

// --- Phase 1 onboarding wizard --------------------------------------------------------

export function fetchOnboardingSources(actor: AuthenticatedActor): Promise<ListSourcesResponse> {
  return request<ListSourcesResponse>(
    `/businesses/${encodeURIComponent(actor.businessId)}/onboarding/sources`,
    actor,
  );
}

export function submitUrlSource(actor: AuthenticatedActor, url: string): Promise<SubmitSourceResponse> {
  return request<SubmitSourceResponse>(
    `/businesses/${encodeURIComponent(actor.businessId)}/onboarding/sources/url`,
    actor,
    { method: "POST", body: JSON.stringify({ url }) },
  );
}

/** Multipart upload — deliberately bypasses `request()`'s JSON content-type so the
 * browser can set its own multipart boundary. */
export async function submitDocumentSource(
  actor: AuthenticatedActor,
  file: File,
): Promise<SubmitSourceResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(
    `${API_URL}/businesses/${encodeURIComponent(actor.businessId)}/onboarding/sources/document`,
    { method: "POST", headers: { Authorization: `Bearer ${getBearerToken(actor)}` }, body: form },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Upload failed");
  }
  return res.json() as Promise<SubmitSourceResponse>;
}

export function generateBlueprintDraft(actor: AuthenticatedActor): Promise<GenerateDraftResponse> {
  return request<GenerateDraftResponse>(
    `/businesses/${encodeURIComponent(actor.businessId)}/onboarding/draft`,
    actor,
    { method: "POST" },
  );
}

export function fetchBlueprint(actor: AuthenticatedActor): Promise<GetBlueprintResponse> {
  return request<GetBlueprintResponse>(`/businesses/${encodeURIComponent(actor.businessId)}/blueprint`, actor);
}

export function updateBlueprint(
  actor: AuthenticatedActor,
  content: BlueprintContentInput,
): Promise<UpdateBlueprintResponse> {
  return request<UpdateBlueprintResponse>(
    `/businesses/${encodeURIComponent(actor.businessId)}/blueprint`,
    actor,
    { method: "PATCH", body: JSON.stringify(content) },
  );
}

export function publishBlueprint(actor: AuthenticatedActor): Promise<PublishBlueprintResponse> {
  return request<PublishBlueprintResponse>(
    `/businesses/${encodeURIComponent(actor.businessId)}/blueprint/publish`,
    actor,
    { method: "POST" },
  );
}
