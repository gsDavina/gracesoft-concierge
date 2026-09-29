"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { saveDevSession } from "@/lib/session";
import { BRAND } from "@/brand/config";

/**
 * DEV ONLY sign-in. Stands in for a real Clerk/Auth.js login screen (03-project-structure.md)
 * until that provider account exists — see apps/api/src/plugins/auth.ts DevSessionProvider.
 */
export default function LoginPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState("");
  const [userId, setUserId] = useState("");
  const now = useClientNow();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId.trim() || !userId.trim()) return;
    saveDevSession({ businessId: businessId.trim(), userId: userId.trim(), role: "front_desk" });
    router.push("/");
  }

  return (
    <main className="auth">
      <header className="auth-top">
        <Image src="/brand/wm-k-w.svg" alt={BRAND.fullName} width={220} height={58} unoptimized priority />
        <span className="auth-device">Front desk device</span>
      </header>

      <div className="auth-stage">
        <div className="auth-clock" aria-live="off">
          <div className="auth-clock-time">
            {now ? now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : " "}
          </div>
          <div className="auth-clock-date">
            {now
              ? now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
              : " "}
          </div>
        </div>

        <div className="auth-card">
          <h1 className="auth-title">Start the front desk</h1>
          <p className="auth-subtitle">Sign in to open today&apos;s check-in queue on this device.</p>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20, marginTop: 28 }}>
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
              style={{ width: "100%", marginTop: 8 }}
            >
              Open check-in
            </button>
          </form>
          <p style={{ marginTop: 24, textAlign: "center" }}>
            <span className="dev-note">Dev sign-in · StaffUser.authSubject</span>
          </p>
        </div>
      </div>
    </main>
  );
}

/** Current time, set only after mount so the server render (no clock) matches the first client render. */
function useClientNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);
  return now;
}
