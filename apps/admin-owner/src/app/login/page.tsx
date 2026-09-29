"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveDevSession } from "@/lib/session";
import Image from "next/image";
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
    <main className="auth">
      <section className="auth-brand">
        <Image src="/brand/wm-a-w.svg" alt={BRAND.fullName} width={240} height={63} unoptimized priority />
        <div>
          <span className="auth-restricted">
            <LockIcon /> Owners only
          </span>
          <h2>Run your front of house from one console.</h2>
          <ul className="auth-features">
            <li>
              <strong>Bookings</strong>
              <span>Every appointment across channels, by token only.</span>
            </li>
            <li>
              <strong>Blueprint</strong>
              <span>Services, opening hours and FAQs your concierge answers with.</span>
            </li>
            <li>
              <strong>Audit log</strong>
              <span>Reveal who is behind a token — every lookup recorded.</span>
            </li>
          </ul>
        </div>
        <p className="auth-footnote">GraceSoft Concierge Admin · Owner console</p>
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

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10.5" width="16" height="10.5" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}
