import { afterEach, describe, expect, it, vi } from "vitest";
import { NoSourcesError, OnboardingService } from "../onboardingService.js";
import type { LlmProvider } from "../llmProvider.js";
import type { BlueprintContentInput } from "@gracesoft/shared-types";

interface FakeSource {
  id: string;
  businessId: string;
  type: "url" | "document";
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
  extractedText: string | null;
  status: "pending" | "processed" | "failed";
  errorMessage: string | null;
  createdAt: Date;
}

interface FakeBlueprint {
  businessId: string;
  status: "draft" | "published";
  services: unknown;
  hours: unknown;
  faqs: unknown;
  generatedByLlm: boolean;
  publishedAt: Date | null;
  publishedByStaffId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeFakeDb(seed: {
  businesses: { id: string; name: string }[];
  sources: FakeSource[];
  blueprints: FakeBlueprint[];
}) {
  let counter = 0;
  const db = {
    business: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const business = seed.businesses.find((b) => b.id === where.id);
        if (!business) throw new Error("not found");
        return business;
      },
    },
    onboardingSource: {
      create: async ({ data }: { data: Omit<FakeSource, "id" | "createdAt" | "extractedText" | "errorMessage"> }) => {
        const source: FakeSource = {
          ...data,
          id: `src-${++counter}`,
          extractedText: null,
          errorMessage: null,
          createdAt: new Date(),
        };
        seed.sources.push(source);
        return source;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeSource> }) => {
        const source = seed.sources.find((s) => s.id === where.id)!;
        Object.assign(source, data);
        return source;
      },
      findMany: async ({ where }: { where: { businessId: string; status?: string } }) =>
        seed.sources.filter(
          (s) => s.businessId === where.businessId && (!where.status || s.status === where.status),
        ),
    },
    blueprint: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { businessId: string };
        create: Omit<FakeBlueprint, "createdAt" | "updatedAt" | "publishedAt" | "publishedByStaffId"> & {
          publishedAt?: Date | null;
          publishedByStaffId?: string | null;
        };
        update: Partial<FakeBlueprint>;
      }) => {
        let blueprint = seed.blueprints.find((b) => b.businessId === where.businessId);
        if (!blueprint) {
          blueprint = {
            ...create,
            publishedAt: create.publishedAt ?? null,
            publishedByStaffId: create.publishedByStaffId ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          seed.blueprints.push(blueprint);
        } else {
          Object.assign(blueprint, update, { updatedAt: new Date() });
        }
        return blueprint;
      },
      findUnique: async ({ where }: { where: { businessId: string } }) =>
        seed.blueprints.find((b) => b.businessId === where.businessId) ?? null,
      update: async ({ where, data }: { where: { businessId: string }; data: Partial<FakeBlueprint> }) => {
        const blueprint = seed.blueprints.find((b) => b.businessId === where.businessId)!;
        Object.assign(blueprint, data);
        return blueprint;
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { db, seed };
}

function fakeLlm(result: BlueprintContentInput = { services: [], hours: [], faqs: [] }): LlmProvider {
  return { extractBlueprint: vi.fn().mockResolvedValue(result) };
}

describe("OnboardingService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submitUrlSource marks the source processed when extraction succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "<p>Open Mon-Fri 9am-5pm</p>" } as Response),
    );
    const { db } = makeFakeDb({ businesses: [], sources: [], blueprints: [] });
    const service = new OnboardingService(db, fakeLlm());

    const source = await service.submitUrlSource("biz-1", "https://example.com");

    expect(source.status).toBe("processed");
  });

  it("submitUrlSource marks the source failed when the fetch fails, without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response));
    const { db } = makeFakeDb({ businesses: [], sources: [], blueprints: [] });
    const service = new OnboardingService(db, fakeLlm());

    const source = await service.submitUrlSource("biz-1", "https://example.com");

    expect(source.status).toBe("failed");
    expect(source.errorMessage).toBeTruthy();
  });

  it("submitDocumentSource rejects an unsupported format as a failed source, not a thrown error", async () => {
    const { db } = makeFakeDb({ businesses: [], sources: [], blueprints: [] });
    const service = new OnboardingService(db, fakeLlm());

    const source = await service.submitDocumentSource("biz-1", {
      fileName: "menu.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF"),
    });

    expect(source.status).toBe("failed");
  });

  it("generateDraft throws NoSourcesError when there is no extracted text yet", async () => {
    const { db } = makeFakeDb({
      businesses: [{ id: "biz-1", name: "Test Clinic" }],
      sources: [],
      blueprints: [],
    });
    const service = new OnboardingService(db, fakeLlm());

    await expect(service.generateDraft("biz-1")).rejects.toBeInstanceOf(NoSourcesError);
  });

  it("generateDraft feeds processed source text to the LLM and stores the draft", async () => {
    const llm = fakeLlm({
      services: [{ name: "Consultation" }],
      hours: [],
      faqs: [],
    });
    const { db } = makeFakeDb({
      businesses: [{ id: "biz-1", name: "Test Clinic" }],
      sources: [
        {
          id: "src-1",
          businessId: "biz-1",
          type: "url",
          url: "https://example.com",
          fileName: null,
          mimeType: null,
          extractedText: "We offer consultations.",
          status: "processed",
          errorMessage: null,
          createdAt: new Date(),
        },
      ],
      blueprints: [],
    });
    const service = new OnboardingService(db, llm);

    const blueprint = await service.generateDraft("biz-1");

    expect(llm.extractBlueprint).toHaveBeenCalledWith({
      businessName: "Test Clinic",
      sourceTexts: ["We offer consultations."],
    });
    expect(blueprint.status).toBe("draft");
    expect(blueprint.generatedByLlm).toBe(true);
    expect(blueprint.services).toEqual([{ name: "Consultation" }]);
  });

  it("updateContent marks the blueprint as hand-edited (not LLM-generated) and clears publish state", async () => {
    const { db } = makeFakeDb({
      businesses: [],
      sources: [],
      blueprints: [
        {
          businessId: "biz-1",
          status: "published",
          services: [],
          hours: [],
          faqs: [],
          generatedByLlm: true,
          publishedAt: new Date(),
          publishedByStaffId: "staff-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const service = new OnboardingService(db, fakeLlm());

    const blueprint = await service.updateContent("biz-1", {
      services: [{ name: "Edited service" }],
      hours: [],
      faqs: [],
    });

    expect(blueprint.status).toBe("draft");
    expect(blueprint.generatedByLlm).toBe(false);
    expect(blueprint.publishedAt).toBeNull();
    expect(blueprint.services).toEqual([{ name: "Edited service" }]);
  });

  it("publish sets status, publishedAt, and the publishing staff member", async () => {
    const { db } = makeFakeDb({
      businesses: [],
      sources: [],
      blueprints: [
        {
          businessId: "biz-1",
          status: "draft",
          services: [],
          hours: [],
          faqs: [],
          generatedByLlm: false,
          publishedAt: null,
          publishedByStaffId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const service = new OnboardingService(db, fakeLlm());

    const blueprint = await service.publish("biz-1", "staff-1");

    expect(blueprint.status).toBe("published");
    expect(blueprint.publishedByStaffId).toBe("staff-1");
    expect(blueprint.publishedAt).not.toBeNull();
  });
});
