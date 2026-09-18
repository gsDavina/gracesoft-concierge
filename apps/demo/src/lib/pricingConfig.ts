/**
 * Phase 3 (01-milestones.md, Trust Surface + Pricing): "Pricing page: flat platform fee +
 * itemized estimated Meta pass-through cost."
 *
 * EVERY NUMBER BELOW IS A PLACEHOLDER. Nothing here is a real, decided price — edit this
 * file with actual figures before the /pricing page is shown to a real prospect. This
 * file exists so the page itself doesn't need editing when the numbers are finalized.
 *
 * Meta's WhatsApp Business Platform per-conversation rates vary by country and
 * conversation category (marketing/utility/authentication/service) and change over
 * time — pull the current rate for the target market from Meta's own pricing
 * calculator (business.whatsapp.com/products/platform-pricing) rather than trusting a
 * hardcoded number here, which will go stale.
 */
export const PRICING_CONFIG = {
  /** Flat monthly platform fee, in the given currency. TBD — business decision. */
  platformFee: {
    amount: 0,
    currency: "SGD",
    isPlaceholder: true,
  },

  /** Itemized estimate of Meta's per-conversation pass-through cost. TBD on every field. */
  metaPassThrough: {
    /** "utility" is the typical category for booking confirmations/reminders. */
    conversationCategory: "utility" as const,
    /** Per-conversation rate in the given currency — pull current rate from Meta. */
    ratePerConversation: 0,
    currency: "SGD",
    /** Illustrative volume assumption — replace with a real pilot-clinic estimate. */
    assumedMonthlyConversations: 0,
    isPlaceholder: true,
  },
} as const;

export function estimatedMonthlyMetaCost(): number {
  return PRICING_CONFIG.metaPassThrough.ratePerConversation * PRICING_CONFIG.metaPassThrough.assumedMonthlyConversations;
}
