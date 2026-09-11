"use client";

import type { AuthenticatedActor } from "@gracesoft/shared-types";

const STORAGE_KEY = "gracesoft-kiosk-dev-session";

/**
 * DEV ONLY: builds the same base64-JSON bearer token apps/api's DevSessionProvider
 * expects (see apps/api/src/plugins/auth.ts). Replace with real Clerk/Auth.js session
 * handling once that provider is wired in — nothing downstream of `getBearerToken`
 * should need to change shape-wise, since AuthenticatedActor is the stable contract.
 */
export function saveDevSession(actor: AuthenticatedActor): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actor));
}

export function loadDevSession(): AuthenticatedActor | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthenticatedActor;
  } catch {
    return null;
  }
}

export function clearDevSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getBearerToken(actor: AuthenticatedActor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(actor));
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return window.btoa(binary);
}
