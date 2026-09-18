import { describe, expect, it } from "vitest";
import { CLINIC_BLUEPRINT_TEMPLATE } from "../verticalTemplates.js";
import { blueprintContentSchema } from "../llmProvider.js";

describe("CLINIC_BLUEPRINT_TEMPLATE", () => {
  it("matches the shape the onboarding routes/UI expect", () => {
    expect(blueprintContentSchema.safeParse(CLINIC_BLUEPRINT_TEMPLATE).success).toBe(true);
  });

  it("has at least one service, one open day, and covers confidentiality/no-diagnosis FAQs", () => {
    expect(CLINIC_BLUEPRINT_TEMPLATE.services.length).toBeGreaterThan(0);
    expect(CLINIC_BLUEPRINT_TEMPLATE.hours.some((h) => !h.closed)).toBe(true);

    const questions = CLINIC_BLUEPRINT_TEMPLATE.faqs.map((f) => f.question.toLowerCase());
    expect(questions.some((q) => q.includes("confidential"))).toBe(true);
    expect(questions.some((q) => q.includes("diagnosis"))).toBe(true);
  });
});
