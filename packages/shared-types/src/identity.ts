/**
 * Identity-side types only (shape, not the encryption/decryption logic — that lives in
 * apps/api, never in a package a frontend bundle could pull in). Kept separate from
 * booking.ts on purpose: these fields must never appear on a Booking or a calendar event.
 */
export interface Identity {
  id: string;
  businessId: string;
  token: string;
  /** Ciphertext — decrypted only by apps/api, only through an authenticated, logged lookup. */
  encryptedName: string;
  encryptedPhone: string;
  encryptedNotes: string | null;
  createdAt: string;
  /** Set by the retention/deletion job; null while the record is still within policy. */
  scheduledDeletionAt: string | null;
}

export interface TokenLookupAuditEntry {
  id: string;
  businessId: string;
  actorUserId: string;
  token: string;
  reason: string;
  lookedUpAt: string;
}
