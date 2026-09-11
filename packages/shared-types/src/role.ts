/**
 * Roles per 03-project-structure.md (packages/auth) and the admin-owner / admin-kiosk split.
 * No business logic here — just the shape.
 */
export type Role = "owner" | "front-desk";

export interface AuthenticatedActor {
  userId: string;
  businessId: string;
  role: Role;
}
