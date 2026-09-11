import type { AuthenticatedActor } from "@gracesoft/shared-types";

/**
 * Provider-agnostic session verification. 03-project-structure.md names Clerk or Auth.js
 * as the intended provider; this interface lets apps/api depend on a stable shape while
 * the concrete driver (clerkSessionProvider, authjsSessionProvider, ...) is swapped in via
 * env config once real provider credentials exist. No provider SDK is wired in yet.
 */
export interface SessionProvider {
  /** Verifies a bearer/session token and resolves it to an actor, or returns null. */
  verify(token: string): Promise<AuthenticatedActor | null>;
}

export class UnauthenticatedError extends Error {
  constructor(message = "Unauthenticated") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export function bearerTokenFromHeader(authorizationHeader: string | undefined): string {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new UnauthenticatedError("Missing or malformed Authorization header");
  }
  return authorizationHeader.slice("Bearer ".length);
}
