import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM

/**
 * Encrypts a single field with the given business's key. Stored form is
 * "<iv>:<authTag>:<ciphertext>", each base64, so each field is independently decryptable
 * and there is no shared IV across fields or records.
 */
export function encryptField(plaintext: string, key: Buffer): string {
  assertKeyLength(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":",
  );
}

export function decryptField(stored: string, key: Buffer): string {
  assertKeyLength(key);
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted field: expected '<iv>:<authTag>:<ciphertext>'");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

function assertKeyLength(key: Buffer): void {
  if (key.length !== 32) {
    throw new Error(`AES-256-GCM requires a 32-byte key, got ${key.length} bytes`);
  }
}

export function generateBusinessKey(): Buffer {
  return randomBytes(32);
}
