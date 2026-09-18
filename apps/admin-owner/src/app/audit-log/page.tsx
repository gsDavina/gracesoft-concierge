"use client";

import type { AuditLogEntry } from "@gracesoft/shared-types";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, fetchAuditLog, lookupIdentity } from "@/lib/api";
import { clearDevSession } from "@/lib/session";
import { useRequireSession } from "@/lib/useRequireSession";

/**
 * Owner-only per 03-project-structure.md ("Restricted identity/audit log"). Two things
 * live here: the audit trail itself (who looked up what, when — never decrypted data),
 * and the one form in this app that can actually perform a lookup, which always requires
 * a stated reason and always produces a new row in the log below.
 */
export default function AuditLogPage() {
  const actor = useRequireSession();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [lookupToken, setLookupToken] = useState("");
  const [lookupReason, setLookupReason] = useState("");
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!actor) return;
    try {
      const { entries: fetched } = await fetchAuditLog(actor);
      setEntries(fetched);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearDevSession();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    }
  }, [actor, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!actor || !lookupToken.trim() || !lookupReason.trim()) return;
    setLookupError(null);
    setLookupResult(null);
    try {
      const identity = await lookupIdentity(actor, lookupToken.trim(), lookupReason.trim());
      setLookupResult(`${identity.name} — ${identity.phone}${identity.notes ? ` — ${identity.notes}` : ""}`);
      setLookupToken("");
      setLookupReason("");
      await refresh();
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
    }
  }

  if (!actor) return null;

  return (
    <main>
      <h1>Identity lookup &amp; audit log</h1>

      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Look up a token</h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Every lookup requires a reason and is recorded below before the result is shown.
        </p>
        <form onSubmit={handleLookup} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            placeholder="Booker token"
            value={lookupToken}
            onChange={(e) => setLookupToken(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <input
            placeholder="Reason (required)"
            value={lookupReason}
            onChange={(e) => setLookupReason(e.target.value)}
            style={{ flex: 2, minWidth: 240, padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 18px",
              background: "var(--accent-solid)",
              color: "var(--accent-contrast)",
              border: "none",
              borderRadius: 8,
            }}
          >
            Look up
          </button>
        </form>
        {lookupError && <p style={{ color: "var(--danger)" }}>{lookupError}</p>}
        {lookupResult && <p>{lookupResult}</p>}
      </section>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {entries.length === 0 && !error && <p style={{ color: "var(--muted)" }}>No lookups yet.</p>}
      {entries.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Staff</th>
              <th>Token</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.lookedUpAt).toLocaleString()}</td>
                <td>{entry.actorAuthSubject}</td>
                <td style={{ fontFamily: "monospace" }}>{entry.token}</td>
                <td>{entry.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
