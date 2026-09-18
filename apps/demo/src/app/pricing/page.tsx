import Link from "next/link";
import { estimatedMonthlyMetaCost, PRICING_CONFIG } from "@/lib/pricingConfig";
import { Wordmark } from "@/brand/Wordmark";
import { BRAND } from "@/brand/config";

export const metadata = {
  title: "GraceSoft Window — Pricing (draft)",
};

/**
 * Phase 3 (01-milestones.md): flat platform fee + itemized estimated Meta pass-through
 * cost. Figures come from src/lib/pricingConfig.ts, which is entirely placeholder values
 * pending a real pricing decision — see that file's comment before showing this page to
 * a prospect, and remove the draft banner below once real numbers are in.
 */
export default function PricingPage() {
  const { platformFee, metaPassThrough } = PRICING_CONFIG;
  const isDraft = platformFee.isPlaceholder || metaPassThrough.isPlaceholder;
  const metaCost = estimatedMonthlyMetaCost();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 96px" }}>
      {isDraft && (
        <div
          style={{
            background: "#fff3cd",
            border: "1px solid #d4a72c",
            color: "#664d03",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 32,
            fontSize: 14,
          }}
        >
          <strong>Draft — not for external use.</strong> Every figure on this page is a
          placeholder (see <code>apps/demo/src/lib/pricingConfig.ts</code>). Replace them
          with real numbers before sending this page to a prospect.
        </div>
      )}

      <header style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <Wordmark product={BRAND.productName} width={180} />
        </div>
        <p style={{ color: "var(--accent)", fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>
          PRICING
        </p>
        <h1 className="gs-display" style={{ fontSize: 34, fontWeight: 700, margin: "0 0 12px" }}>
          Simple, itemized pricing
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 16, maxWidth: 560, margin: "0 auto" }}>
          One flat platform fee. The only variable cost is what Meta charges per WhatsApp
          conversation, passed through at cost — no markup.
        </p>
      </header>

      <section style={cardStyle}>
        <h2 style={rowTitleStyle}>Platform fee</h2>
        <div style={rowStyle}>
          <span style={{ color: "var(--muted)" }}>Flat monthly fee</span>
          <strong style={{ fontSize: 20 }}>
            {platformFee.isPlaceholder ? "TBD" : formatMoney(platformFee.amount, platformFee.currency)}
            <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}> / month</span>
          </strong>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
          Covers the booking bot, calendar integration, admin dashboard, and the privacy
          architecture described in the <Link href="/">interactive demo</Link>.
        </p>
      </section>

      <section style={{ ...cardStyle, marginTop: 20 }}>
        <h2 style={rowTitleStyle}>Estimated Meta pass-through cost</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: -4, marginBottom: 16 }}>
          Meta bills per WhatsApp conversation opened; we pass this through at cost — the
          rate below depends on the conversation category and country.
        </p>
        <div style={rowStyle}>
          <span style={{ color: "var(--muted)" }}>Conversation category</span>
          <span>{metaPassThrough.conversationCategory}</span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: "var(--muted)" }}>Rate per conversation</span>
          <span>
            {metaPassThrough.isPlaceholder
              ? "TBD (see Meta's platform pricing calculator)"
              : formatMoney(metaPassThrough.ratePerConversation, metaPassThrough.currency)}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: "var(--muted)" }}>Assumed monthly conversations</span>
          <span>{metaPassThrough.isPlaceholder ? "TBD" : metaPassThrough.assumedMonthlyConversations}</span>
        </div>
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />
        <div style={rowStyle}>
          <span style={{ fontWeight: 600 }}>Estimated monthly total</span>
          <strong style={{ fontSize: 18 }}>
            {metaPassThrough.isPlaceholder ? "TBD" : formatMoney(metaCost, metaPassThrough.currency)}
          </strong>
        </div>
      </section>

      <p style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" style={{ color: "var(--accent)" }}>
          ← Back to the demo
        </Link>
      </p>
    </main>
  );
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency }).format(amount);
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 24,
};
const rowTitleStyle: React.CSSProperties = { fontSize: 17, margin: "0 0 12px" };
const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  fontSize: 15,
};
