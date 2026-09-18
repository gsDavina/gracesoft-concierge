"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveDevSession } from "@/lib/session";
import { Wordmark } from "@/brand/Wordmark";
import { BRAND } from "@/brand/config";

/**
 * DEV ONLY sign-in. Stands in for a real Clerk/Auth.js login screen (03-project-structure.md)
 * until that provider account exists — see apps/api/src/plugins/auth.ts DevSessionProvider.
 */
export default function LoginPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState("");
  const [userId, setUserId] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId.trim() || !userId.trim()) return;
    saveDevSession({ businessId: businessId.trim(), userId: userId.trim(), role: "owner" });
    router.push("/");
  }

  return (
    <main style={{ maxWidth: 480, margin: "10vh auto", padding: "0 24px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        <Wordmark product={BRAND.productName} width={180} />
      </div>
      <h1 style={{ fontSize: 28 }}>Owner sign-in (dev)</h1>
      <p style={{ color: "var(--muted)" }}>
        Placeholder for real staff auth. Enter the business and staff ids to seed an owner
        session.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
        <label style={{ display: "grid", gap: 8 }}>
          Business ID
          <input
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 8 }}>
          Staff auth subject (StaffUser.authSubject)
          <input value={userId} onChange={(e) => setUserId(e.target.value)} style={inputStyle} />
        </label>
        <button type="submit" style={buttonStyle}>
          Sign in
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 12,
  fontSize: 16,
  border: "1px solid var(--border)",
  borderRadius: 8,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 20px",
  fontSize: 16,
  background: "var(--accent-solid)",
  color: "var(--accent-contrast)",
  border: "none",
  borderRadius: 8,
};
