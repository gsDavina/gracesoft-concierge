import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client. Only apps/api should ever import this — the identity/PII
 * boundary in 03-project-structure.md means no frontend should be able to reach the DB
 * (or bundle a client capable of it) directly.
 */
let client: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

export * from "@prisma/client";
