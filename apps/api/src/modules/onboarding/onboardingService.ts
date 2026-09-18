import type { PrismaClient, OnboardingSource as DbOnboardingSource, Blueprint as DbBlueprint } from "@gracesoft/db";
import type { Prisma } from "@gracesoft/db";
import type {
  Blueprint,
  BlueprintContentInput,
  OnboardingSource,
} from "@gracesoft/shared-types";
import { extractTextFromDocument, extractTextFromUrl } from "./textExtraction.js";
import type { LlmProvider } from "./llmProvider.js";

export class NoSourcesError extends Error {
  constructor() {
    super("No onboarding sources with extracted text yet — submit a URL or document first.");
    this.name = "NoSourcesError";
  }
}

/**
 * Phase 1 onboarding wizard: input step (submit URL/doc) -> auto-draft (LLM extraction)
 * -> human-in-the-loop review/edit -> publish. One Blueprint per business; sources are
 * append-only history of what was fed into the drafting step.
 */
export class OnboardingService {
  constructor(
    private readonly db: PrismaClient,
    private readonly llm: LlmProvider,
  ) {}

  async submitUrlSource(businessId: string, url: string): Promise<OnboardingSource> {
    const source = await this.db.onboardingSource.create({
      data: { businessId, type: "url", url, status: "pending" },
    });

    try {
      const text = await extractTextFromUrl(url);
      const updated = await this.db.onboardingSource.update({
        where: { id: source.id },
        data: { extractedText: text, status: "processed" },
      });
      return toSourceDto(updated);
    } catch (err) {
      const failed = await this.db.onboardingSource.update({
        where: { id: source.id },
        data: { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) },
      });
      return toSourceDto(failed);
    }
  }

  async submitDocumentSource(
    businessId: string,
    file: { fileName: string; mimeType: string; buffer: Buffer },
  ): Promise<OnboardingSource> {
    const source = await this.db.onboardingSource.create({
      data: {
        businessId,
        type: "document",
        fileName: file.fileName,
        mimeType: file.mimeType,
        status: "pending",
      },
    });

    try {
      const text = extractTextFromDocument(file.buffer, file.mimeType);
      const updated = await this.db.onboardingSource.update({
        where: { id: source.id },
        data: { extractedText: text, status: "processed" },
      });
      return toSourceDto(updated);
    } catch (err) {
      const failed = await this.db.onboardingSource.update({
        where: { id: source.id },
        data: { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) },
      });
      return toSourceDto(failed);
    }
  }

  async listSources(businessId: string): Promise<OnboardingSource[]> {
    const sources = await this.db.onboardingSource.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
    return sources.map(toSourceDto);
  }

  /** Auto-draft step: gathers all successfully-extracted source text and asks the LLM to
   * turn it into structured blueprint content, overwriting the current draft. */
  async generateDraft(businessId: string): Promise<Blueprint> {
    const business = await this.db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { name: true },
    });

    const sources = await this.db.onboardingSource.findMany({
      where: { businessId, status: "processed", extractedText: { not: null } },
    });
    const sourceTexts = sources.map((s) => s.extractedText!).filter(Boolean);
    if (sourceTexts.length === 0) {
      throw new NoSourcesError();
    }

    const content = await this.llm.extractBlueprint({
      businessName: business.name,
      sourceTexts,
    });

    const blueprint = await this.db.blueprint.upsert({
      where: { businessId },
      create: {
        businessId,
        status: "draft",
        services: toJson(content.services),
        hours: toJson(content.hours),
        faqs: toJson(content.faqs),
        generatedByLlm: true,
      },
      update: {
        status: "draft",
        services: toJson(content.services),
        hours: toJson(content.hours),
        faqs: toJson(content.faqs),
        generatedByLlm: true,
        publishedAt: null,
        publishedByStaffId: null,
      },
    });
    return toBlueprintDto(blueprint);
  }

  async getBlueprint(businessId: string): Promise<Blueprint | null> {
    const blueprint = await this.db.blueprint.findUnique({ where: { businessId } });
    return blueprint ? toBlueprintDto(blueprint) : null;
  }

  /** Human-in-the-loop review/edit step: an owner hand-edits the (possibly LLM-drafted)
   * content before it can be published. */
  async updateContent(businessId: string, content: BlueprintContentInput): Promise<Blueprint> {
    const blueprint = await this.db.blueprint.upsert({
      where: { businessId },
      create: {
        businessId,
        status: "draft",
        services: toJson(content.services),
        hours: toJson(content.hours),
        faqs: toJson(content.faqs),
        generatedByLlm: false,
      },
      update: {
        status: "draft",
        services: toJson(content.services),
        hours: toJson(content.hours),
        faqs: toJson(content.faqs),
        generatedByLlm: false,
        publishedAt: null,
        publishedByStaffId: null,
      },
    });
    return toBlueprintDto(blueprint);
  }

  /** Go-live: an owner has reviewed the draft and approves it. */
  async publish(businessId: string, publishedByStaffId: string): Promise<Blueprint> {
    const blueprint = await this.db.blueprint.update({
      where: { businessId },
      data: { status: "published", publishedAt: new Date(), publishedByStaffId },
    });
    return toBlueprintDto(blueprint);
  }
}

/** Prisma's generated Json input type resolves to an object-shaped overload for these
 * fields, which rejects a plain array at the type level even though it's valid JSON at
 * runtime — routed through `unknown` to sidestep that, not because the value is unsafe. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toSourceDto(source: DbOnboardingSource): OnboardingSource {
  return {
    id: source.id,
    businessId: source.businessId,
    type: source.type,
    url: source.url,
    fileName: source.fileName,
    mimeType: source.mimeType,
    status: source.status,
    errorMessage: source.errorMessage,
    createdAt: source.createdAt.toISOString(),
  };
}

function toBlueprintDto(blueprint: DbBlueprint): Blueprint {
  return {
    businessId: blueprint.businessId,
    status: blueprint.status,
    services: blueprint.services as unknown as Blueprint["services"],
    hours: blueprint.hours as unknown as Blueprint["hours"],
    faqs: blueprint.faqs as unknown as Blueprint["faqs"],
    generatedByLlm: blueprint.generatedByLlm,
    publishedAt: blueprint.publishedAt?.toISOString() ?? null,
    publishedByStaffId: blueprint.publishedByStaffId,
    createdAt: blueprint.createdAt.toISOString(),
    updatedAt: blueprint.updatedAt.toISOString(),
  };
}
