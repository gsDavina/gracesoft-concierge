import type { AuthenticatedActor, Role } from "@gracesoft/shared-types";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws unless the actor holds one of `allowed`. Use at the top of any protected handler. */
export function requireRole(actor: AuthenticatedActor, allowed: Role[]): void {
  if (!allowed.includes(actor.role)) {
    throw new ForbiddenError(
      `Role "${actor.role}" is not permitted; requires one of: ${allowed.join(", ")}`,
    );
  }
}

/** Owner-only actions: billing, blueprint editing, audit log access. */
export function requireOwner(actor: AuthenticatedActor): void {
  requireRole(actor, ["owner"]);
}

/** Front-desk can do everything owner can except the actions gated by requireOwner. */
export function requireStaff(actor: AuthenticatedActor): void {
  requireRole(actor, ["owner", "front-desk"]);
}
