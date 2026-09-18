import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { BlueprintContentInput } from "@gracesoft/shared-types";

/**
 * Phase 1 onboarding wizard, auto-draft step: turns raw extracted text (from submitted
 * URLs/docs) into structured blueprint content. Same swappable-seam pattern as
 * CalendarAdapter/HolidayProvider — OnboardingService only ever depends on this interface.
 */
export interface LlmProvider {
  extractBlueprint(input: { businessName: string; sourceTexts: string[] }): Promise<BlueprintContentInput>;
}

export const blueprintContentSchema = z.object({
  services: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      durationMinutes: z.number().int().positive().optional(),
    }),
  ),
  hours: z.array(
    z.object({
      day: z.enum([
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ]),
      opens: z.string().optional(),
      closes: z.string().optional(),
      closed: z.boolean().optional(),
    }),
  ),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
}) satisfies z.ZodType<BlueprintContentInput>;

export class LlmExtractionError extends Error {
  constructor(cause: string) {
    super(`LLM blueprint extraction failed: ${cause}`);
    this.name = "LlmExtractionError";
  }
}

const SYSTEM_PROMPT = `You extract structured business information from raw website/document text for a booking bot's setup wizard. Respond with ONLY a single JSON object matching this shape, no prose, no markdown fences:
{
  "services": [{ "name": string, "description"?: string, "durationMinutes"?: number }],
  "hours": [{ "day": "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday", "opens"?: "HH:mm", "closes"?: "HH:mm", "closed"?: boolean }],
  "faqs": [{ "question": string, "answer": string }]
}
Only include information actually present or clearly implied in the source text. If nothing relevant is found for a section, return an empty array for it. Never invent services, hours, or FAQs that aren't supported by the text.`;

/**
 * Real auto-draft implementation. Needs ANTHROPIC_API_KEY (apps/api/.env.example) — the
 * app falls back to HeuristicLlmProvider below when it's unset, so onboarding stays
 * usable end-to-end without an API key, just with lower-quality drafts.
 */
export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model = "claude-sonnet-5",
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async extractBlueprint(input: {
    businessName: string;
    sourceTexts: string[];
  }): Promise<BlueprintContentInput> {
    const sourceBlock = input.sourceTexts
      .map((text, i) => `--- Source ${i + 1} ---\n${text}`)
      .join("\n\n");

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Business name: ${input.businessName}\n\n${sourceBlock}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new LlmExtractionError("model returned no text content");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonObject(textBlock.text));
    } catch (err) {
      throw new LlmExtractionError(
        `could not parse model output as JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const result = blueprintContentSchema.safeParse(parsed);
    if (!result.success) {
      throw new LlmExtractionError(`model output did not match expected shape: ${result.error.message}`);
    }
    return result.data;
  }
}

/** Strips markdown code fences if the model wraps its JSON despite instructions not to. */
function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenced ? (fenced[1] ?? trimmed) : trimmed;
}

const TIME_RANGE = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
const DAY_NAMES: Record<string, BlueprintContentInput["hours"][number]["day"]> = {
  mon: "monday",
  tue: "tuesday",
  tues: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};

/**
 * Dev/offline stand-in — no API key, no network call, deterministic. This is a genuine
 * (if crude) keyword-based extractor, not a mock: it looks for lines containing a "?"
 * (FAQs), lines naming a weekday plus a time range (hours), and short lines that look
 * like a service listing. Onboarding is fully usable with this alone; ANTHROPIC_API_KEY
 * upgrades draft quality, it isn't required for the feature to function.
 */
export class HeuristicLlmProvider implements LlmProvider {
  async extractBlueprint(input: {
    businessName: string;
    sourceTexts: string[];
  }): Promise<BlueprintContentInput> {
    const lines = input.sourceTexts.flatMap((text) => text.split("\n")).map((l) => l.trim());

    const hours: BlueprintContentInput["hours"] = [];
    const faqs: BlueprintContentInput["faqs"] = [];
    const services: BlueprintContentInput["services"] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const dayMatch = Object.keys(DAY_NAMES).find((abbr) =>
        new RegExp(`\\b${abbr}\\w*\\b`, "i").test(line),
      );
      const timeMatch = line.match(TIME_RANGE);
      if (dayMatch && timeMatch && timeMatch[1] && timeMatch[2]) {
        hours.push({
          day: DAY_NAMES[dayMatch]!,
          opens: normalizeTime(timeMatch[1]),
          closes: normalizeTime(timeMatch[2]),
        });
        continue;
      }

      if (line.includes("?") && line.length < 200) {
        const answer = lines[i + 1]?.trim();
        if (answer && !answer.includes("?")) {
          faqs.push({ question: line, answer });
        }
        continue;
      }

      if (/^(service|consult|appointment|check-?up|treatment)/i.test(line) && line.length < 100) {
        services.push({ name: line });
      }
    }

    return { services, hours, faqs };
  }
}

function normalizeTime(raw: string): string {
  const cleaned = raw.trim().toLowerCase();
  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return cleaned;
  let hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const meridiem = match[3];
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}
