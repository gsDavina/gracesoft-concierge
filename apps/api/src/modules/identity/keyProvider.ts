/**
 * Resolves a business's AES-256 key by `encryptionKeyId` (see Business.encryptionKeyId
 * in packages/db/prisma/schema.prisma). Never the same key across businesses.
 *
 * Swap the provider used in production for one backed by the actual secrets manager
 * (Railway secrets / Infisical, per 03-project-structure.md) once that account exists —
 * everything downstream only depends on this interface.
 */
export interface KeyProvider {
  getKey(encryptionKeyId: string): Promise<Buffer>;
}

/**
 * Local/dev/test stand-in: reads a JSON map of `{ [encryptionKeyId]: base64Key }` from
 * GRACESOFT_DEV_ENCRYPTION_KEYS. Not suitable for production — keys would sit in plain
 * env config rather than a secrets manager with access logging and rotation.
 */
export class EnvKeyProvider implements KeyProvider {
  private readonly keys: Map<string, Buffer>;

  constructor(rawJson: string | undefined) {
    this.keys = new Map();
    if (!rawJson) return;
    const parsed = JSON.parse(rawJson) as Record<string, string>;
    for (const [keyId, base64Key] of Object.entries(parsed)) {
      this.keys.set(keyId, Buffer.from(base64Key, "base64"));
    }
  }

  async getKey(encryptionKeyId: string): Promise<Buffer> {
    const key = this.keys.get(encryptionKeyId);
    if (!key) {
      throw new Error(`No encryption key configured for encryptionKeyId "${encryptionKeyId}"`);
    }
    return key;
  }
}
