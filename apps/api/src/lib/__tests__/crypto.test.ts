import { describe, expect, it } from "vitest";
import { decryptField, encryptField, generateBusinessKey } from "../crypto.js";

describe("field encryption", () => {
  it("round-trips a value with the same key", () => {
    const key = generateBusinessKey();
    const stored = encryptField("Jane Tan", key);
    expect(decryptField(stored, key)).toBe("Jane Tan");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const key = generateBusinessKey();
    const first = encryptField("+65 9123 4567", key);
    const second = encryptField("+65 9123 4567", key);
    expect(first).not.toBe(second);
  });

  it("fails to decrypt with the wrong business's key", () => {
    const keyA = generateBusinessKey();
    const keyB = generateBusinessKey();
    const stored = encryptField("Jane Tan", keyA);
    expect(() => decryptField(stored, keyB)).toThrow();
  });

  it("rejects a malformed stored value", () => {
    const key = generateBusinessKey();
    expect(() => decryptField("not-the-right-shape", key)).toThrow(/Malformed/);
  });

  it("rejects a key that is not 32 bytes", () => {
    const shortKey = Buffer.alloc(16);
    expect(() => encryptField("x", shortKey)).toThrow(/32-byte key/);
  });
});
