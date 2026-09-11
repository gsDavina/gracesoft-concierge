import type { PrismaClient } from "@gracesoft/db";
import type { AuthenticatedActor } from "@gracesoft/shared-types";
import { decryptField, encryptField } from "../../lib/crypto.js";
import type { KeyProvider } from "./keyProvider.js";

export interface CreateIdentityInput {
  businessId: string;
  token: string;
  name: string;
  phone: string;
  notes?: string;
}

export interface LookedUpIdentity {
  name: string;
  phone: string;
  notes: string | null;
}

/**
 * Owns the one boundary in the system that ever turns a token back into a name/phone/notes.
 * Every read goes through `lookup`, which requires an authenticated actor and a stated
 * reason, and always writes a TokenLookupAudit row *before* returning decrypted data —
 * satisfies "Token-lookup flow: authenticated, logged" in 01-milestones.md Phase 0.
 */
export class IdentityService {
  constructor(
    private readonly db: PrismaClient,
    private readonly keyProvider: KeyProvider,
  ) {}

  async create(input: CreateIdentityInput): Promise<{ id: string }> {
    const business = await this.db.business.findUniqueOrThrow({
      where: { id: input.businessId },
      select: { encryptionKeyId: true },
    });
    const key = await this.keyProvider.getKey(business.encryptionKeyId);

    const identity = await this.db.identity.create({
      data: {
        businessId: input.businessId,
        token: input.token,
        encryptedName: encryptField(input.name, key),
        encryptedPhone: encryptField(input.phone, key),
        encryptedNotes: input.notes ? encryptField(input.notes, key) : null,
      },
      select: { id: true },
    });

    return identity;
  }

  /**
   * Decrypts and returns a booker's identity, but only for an authenticated actor scoped
   * to the same business, and only after recording who looked up what and why. The audit
   * write and the decrypt happen in the same call so there is no path to one without the
   * other.
   */
  async lookup(
    actor: AuthenticatedActor,
    token: string,
    reason: string,
  ): Promise<LookedUpIdentity> {
    if (!reason.trim()) {
      throw new Error("A reason is required for every identity lookup");
    }

    const identity = await this.db.identity.findUniqueOrThrow({
      where: { businessId_token: { businessId: actor.businessId, token } },
      include: { business: { select: { encryptionKeyId: true } } },
    });

    const staffUser = await this.db.staffUser.findUniqueOrThrow({
      where: { authSubject: actor.userId },
      select: { id: true },
    });

    await this.db.tokenLookupAudit.create({
      data: {
        businessId: actor.businessId,
        actorUserId: staffUser.id,
        identityId: identity.id,
        token,
        reason,
      },
    });

    const key = await this.keyProvider.getKey(identity.business.encryptionKeyId);
    return {
      name: decryptField(identity.encryptedName, key),
      phone: decryptField(identity.encryptedPhone, key),
      notes: identity.encryptedNotes ? decryptField(identity.encryptedNotes, key) : null,
    };
  }
}
