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
      <header className="page-header">
        <div>
          <div className="eyebrow">Restricted · Owner only</div>
          <h1 className="page-title">Identity lookup &amp; audit log</h1>
          <p className="page-subtitle">
            Reveal who is behind a booking token when you have a reason to. Every lookup is recorded
            permanently.
          </p>
        </div>
      </header>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Look up a token</h2>
            <p className="card-description">
              A reason is required and is logged before the result is shown.
            </p>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleLookup} className="form-row">
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              <span className="label">Booker token</span>
              <input
                className="input mono"
                placeholder="tok_…"
                value={lookupToken}
                onChange={(e) => setLookupToken(e.target.value)}
              />
            </label>
            <label className="field" style={{ flex: 2, minWidth: 260 }}>
              <span className="label">Reason</span>
              <input
                className="input"
                placeholder="Why do you need this person's details?"
                value={lookupReason}
                onChange={(e) => setLookupReason(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!lookupToken.trim() || !lookupReason.trim()}
            >
              Look up
            </button>
          </form>
          {lookupError && (
            <div role="alert" className="alert alert-danger" style={{ marginTop: 16, marginBottom: 0 }}>
              {lookupError}
            </div>
          )}
          {lookupResult && (
            <div className="alert alert-warning" style={{ marginTop: 16, marginBottom: 0 }}>
              <div>
                <strong>Identity revealed:</strong> {lookupResult}
                <div className="hint" style={{ color: "inherit", marginTop: 2 }}>
                  This lookup has been added to the audit log below.
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Audit trail</h2>
            <p className="card-description">Who looked up which token, when, and why.</p>
          </div>
          {entries.length > 0 && <span className="badge badge-neutral">{entries.length} entries</span>}
        </div>
        {entries.length === 0 && !error && (
          <div className="empty">
            <div className="empty-title">No lookups yet</div>
            Identity lookups will be recorded here.
          </div>
        )}
        {entries.length > 0 && (
          <div className="table-wrap">
            <table className="table">
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
                    <td>
                      <span className="token">{entry.token}</span>
                    </td>
                    <td className="wrap">{entry.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
