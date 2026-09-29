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
    saveDevSession({ businessId: businessId.trim(), userId: userId.trim(), role: "owner" });
    router.push("/");
  }

  return (
    <main className="auth">
      <section className="auth-brand">
        <Wordmark width={240} />
        <div>
          <h2>Run your front of house from one console.</h2>
          <p>Bookings, your business blueprint, and the restricted identity audit log — for owners only.</p>
        </div>
        <p style={{ fontSize: 12, color: "#a79fe4", margin: 0 }}>Owner console</p>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <span className="badge badge-warning" style={{ marginBottom: 16 }}>
            Development sign-in
          </span>
          <h1 className="page-title">Sign in to Admin</h1>
          <p className="page-subtitle" style={{ marginBottom: 28 }}>
            Placeholder for real staff auth. Enter the business and staff ids to start an owner session.
          </p>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
            <label className="field">
              <span className="label">Business ID</span>
              <input className="input mono" value={businessId} onChange={(e) => setBusinessId(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Staff auth subject</span>
              <input className="input mono" value={userId} onChange={(e) => setUserId(e.target.value)} />
              <span className="hint">StaffUser.authSubject</span>
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={!businessId.trim() || !userId.trim()}
              style={{ padding: "11px 16px", marginTop: 4 }}
            >
              Sign in
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
