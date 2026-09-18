import { describe, expect, it } from "vitest";
import { HeuristicLlmProvider } from "../llmProvider.js";

describe("HeuristicLlmProvider", () => {
  const provider = new HeuristicLlmProvider();

  it("extracts hours from a weekday + time-range line", async () => {
    const result = await provider.extractBlueprint({
      businessName: "Test Clinic",
      sourceTexts: ["Open Mon 9am-5pm", "Open Sat 9am-1pm"],
    });

    expect(result.hours).toContainEqual({ day: "monday", opens: "09:00", closes: "17:00" });
    expect(result.hours).toContainEqual({ day: "saturday", opens: "09:00", closes: "13:00" });
  });

  it("extracts a FAQ from a question line followed by an answer line", async () => {
    const result = await provider.extractBlueprint({
      businessName: "Test Clinic",
      sourceTexts: ["Do you accept walk-ins?", "Yes, subject to availability."],
    });

    expect(result.faqs).toContainEqual({
      question: "Do you accept walk-ins?",
      answer: "Yes, subject to availability.",
    });
  });

  it("extracts a service from a recognizable listing line", async () => {
    const result = await provider.extractBlueprint({
      businessName: "Test Clinic",
      sourceTexts: ["Consultation - general checkup"],
    });

    expect(result.services).toContainEqual({ name: "Consultation - general checkup" });
  });

  it("returns empty arrays for text with no recognizable structure", async () => {
    const result = await provider.extractBlueprint({
      businessName: "Test Clinic",
      sourceTexts: ["Lorem ipsum dolor sit amet."],
    });

    expect(result).toEqual({ services: [], hours: [], faqs: [] });
  });
});
