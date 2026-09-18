import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UnsupportedDocumentFormatError,
  UrlFetchError,
  extractTextFromDocument,
  extractTextFromUrl,
} from "../textExtraction.js";

describe("extractTextFromDocument", () => {
  it("extracts and normalizes plain text", () => {
    const buffer = Buffer.from("Line one\n\n  Line two with   spaces  \n\nLine three\n");
    expect(extractTextFromDocument(buffer, "text/plain")).toBe("Line one\nLine two with spaces\nLine three");
  });

  it("accepts markdown as plain text", () => {
    const buffer = Buffer.from("# Heading\nSome body text");
    expect(extractTextFromDocument(buffer, "text/markdown")).toBe("# Heading\nSome body text");
  });

  it("rejects unsupported formats like PDF", () => {
    expect(() => extractTextFromDocument(Buffer.from("%PDF-1.4"), "application/pdf")).toThrow(
      UnsupportedDocumentFormatError,
    );
  });
});

describe("extractTextFromUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strips HTML tags/scripts/styles down to visible text", async () => {
    const html = `<html><head><style>.a{}</style></head><body>
      <script>alert('x')</script>
      <h1>Welcome</h1>
      <p>Open <strong>Mon-Fri</strong> 9am-5pm.</p>
    </body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => html } as Response),
    );

    const text = await extractTextFromUrl("https://example.com");
    expect(text).toContain("Welcome");
    expect(text).toContain("Open Mon-Fri 9am-5pm.");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("<");
  });

  it("throws UrlFetchError on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response));
    await expect(extractTextFromUrl("https://example.com/missing")).rejects.toBeInstanceOf(UrlFetchError);
  });

  it("throws UrlFetchError when the network request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")),
    );
    await expect(extractTextFromUrl("https://unreachable.example")).rejects.toBeInstanceOf(UrlFetchError);
  });
});
