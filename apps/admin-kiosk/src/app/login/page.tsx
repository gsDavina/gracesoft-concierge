"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveDevSession } from "@/lib/session";
import { Wordmark } from "@/brand/Wordmark";

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
    saveDevSession({ businessId: businessId.trim(), userId: userId.trim(), role: "front_desk" });
    router.push("/");
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <Wordmark width={280} />
        <h1 className="auth-title">Start the front desk</h1>
        <p className="auth-subtitle">
          Sign in to open today&apos;s check-in queue on this device.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20, marginTop: 32 }}>
          <label className="field">
            Business ID
            <input className="input" value={businessId} onChange={(e) => setBusinessId(e.target.value)} />
          </label>
          <label className="field">
            Staff ID
            <input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <button
            type="submit"
            className="check-in"
            disabled={!businessId.trim() || !userId.trim()}
            style={{ width: "100%", marginTop: 8, cursor: "pointer" }}
          >
            Open check-in
          </button>
        </form>
        <p style={{ marginTop: 24, textAlign: "center" }}>
          <span className="dev-note">Dev sign-in · StaffUser.authSubject</span>
        </p>
      </div>
    </main>
  );
}
