import type {
  AuthenticatedActor,
  CheckInRequest,
  CheckInResponse,
  ListBookingsResponse,
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
      // Fastify's JSON body parser rejects an empty body sent with this header, so only
      // set it when there's actually a body to parse.
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

export function fetchTodaysQueue(actor: AuthenticatedActor): Promise<ListBookingsResponse> {
  const today = new Date().toISOString().slice(0, 10);
  return request<ListBookingsResponse>(
    `/bookings?businessId=${encodeURIComponent(actor.businessId)}&date=${today}`,
    actor,
  );
}

export function checkIn(actor: AuthenticatedActor, token: string): Promise<CheckInResponse> {
  const payload: CheckInRequest = { businessId: actor.businessId, token };
  return request<CheckInResponse>("/bookings/check-in", actor, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
