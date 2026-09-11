import type {
  AuditLogResponse,
  AuthenticatedActor,
  ListBookingsResponse,
  TokenLookupResponse,
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
      "Content-Type": "application/json",
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
