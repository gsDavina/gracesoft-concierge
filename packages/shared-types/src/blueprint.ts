/**
 * Phase 1 onboarding wizard (01-milestones.md): a business submits raw material (website
 * URL / uploaded docs), an LLM drafts structured content from it, and an owner reviews/
 * edits before it goes live. This file is the structured shape of that content — kept
 * separate from booking/identity types since it has nothing to do with the privacy layer.
 */

export type OnboardingSourceType = "url" | "document";
export type OnboardingSourceStatus = "pending" | "processed" | "failed";

export interface OnboardingSource {
  id: string;
  businessId: string;
  type: OnboardingSourceType;
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
  status: OnboardingSourceStatus;
  errorMessage: string | null;
  createdAt: string;
}

export type BlueprintStatus = "draft" | "published";

export interface BlueprintService {
  name: string;
  description?: string;
  durationMinutes?: number;
}

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** One bookable time range within a day, e.g. 09:00–12:00. "HH:mm", 24-hour, business-local. */
export interface BlueprintTimeSlot {
  opens: string;
  closes: string;
}

export interface BlueprintHours {
  day: Weekday;
  /**
   * Bookable ranges for this day, e.g. a clinic closed for lunch has two: 09:00–12:00 and
   * 14:00–17:00. A booking must fit entirely inside one range (start >= opens, end <= closes).
   */
  slots?: BlueprintTimeSlot[];
  /**
   * Legacy single-range form — still accepted (LLM drafts, templates, blueprints saved
   * before `slots` existed) and read as one slot when `slots` is absent.
   */
  opens?: string;
  closes?: string;
  closed?: boolean;
}

export interface BlueprintFaq {
  question: string;
  answer: string;
}

export interface Blueprint {
  businessId: string;
  status: BlueprintStatus;
  services: BlueprintService[];
  hours: BlueprintHours[];
  faqs: BlueprintFaq[];
  generatedByLlm: boolean;
  publishedAt: string | null;
  publishedByStaffId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Owner-editable subset — id/status/timestamps are server-controlled. */
export interface BlueprintContentInput {
  services: BlueprintService[];
  hours: BlueprintHours[];
  faqs: BlueprintFaq[];
}
