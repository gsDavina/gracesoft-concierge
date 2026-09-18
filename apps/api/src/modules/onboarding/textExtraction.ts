/**
 * Phase 1 onboarding wizard, input step: turns a submitted website URL or uploaded
 * document into plain text for the LLM auto-draft step. Deliberately dependency-light —
 * only formats extractable without adding a heavy parser library are supported today;
 * everything else fails with a clear, catchable error rather than silently producing junk.
 */

export class UnsupportedDocumentFormatError extends Error {
  constructor(public readonly mimeType: string) {
    super(
      `Unsupported document format "${mimeType}". Only plain text and Markdown are ` +
        "supported today — PDF/Word support needs a parser library (pdf-parse/mammoth) " +
        "not yet installed.",
    );
    this.name = "UnsupportedDocumentFormatError";
  }
}

export class UrlFetchError extends Error {
  constructor(url: string, cause: string) {
    super(`Could not fetch "${url}": ${cause}`);
    this.name = "UrlFetchError";
  }
}

const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/x-markdown"]);

export function extractTextFromDocument(buffer: Buffer, mimeType: string): string {
  if (!TEXT_MIME_TYPES.has(mimeType)) {
    throw new UnsupportedDocumentFormatError(mimeType);
  }
  return normalizeWhitespace(buffer.toString("utf-8"));
}

/** Fetches a URL and strips it down to visible text — no cheerio/jsdom dependency needed. */
export async function extractTextFromUrl(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (err) {
    throw new UrlFetchError(url, err instanceof Error ? err.message : String(err));
  }
  if (!res.ok) {
    throw new UrlFetchError(url, `HTTP ${res.status}`);
  }
  const html = await res.text();
  return normalizeWhitespace(htmlToText(html));
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}
