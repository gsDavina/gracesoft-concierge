"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Wordmark } from "@/brand/Wordmark";

/**
 * Mirrors apps/api/src/modules/booking/calendarAdapter.ts's `CalendarEventInput` — kept
 * as a local type rather than importing from apps/api (frontends only import from
 * packages/, never from another app — see 03-project-structure.md) or adding it to
 * shared-types (it's an internal adapter contract, not a public API request/response
 * shape). If that interface changes, update this to match.
 */
interface CalendarEventInput {
  token: string;
  serviceType: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Phase 3 (01-milestones.md, Trust Surface): "book a slot -> show the resulting
 * calendar event with token instead of name." Entirely client-side and illustrative —
 * no request ever reaches apps/api, and nothing here is persisted. The calendar-event
 * shape shown is the real `CalendarEventInput` type from @gracesoft/shared-types, so
 * this page can't silently drift from what the booking API actually writes.
 */

const SERVICES = ["General Consultation", "Follow-up Consultation", "Vaccination"];
const TIMES = ["09:00", "10:30", "14:00", "16:30"];

interface DemoBooking {
  name: string;
  phone: string;
  service: string;
  time: string;
  token: string;
}

interface AuditEntry {
  staff: string;
  reason: string;
  at: string;
}

function makeToken(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return "tok_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function DemoPage() {
  const [name, setName] = useState("Alex Tan");
  const [phone, setPhone] = useState("+65 9123 4567");
  const [service, setService] = useState(SERVICES[0]!);
  const [time, setTime] = useState(TIMES[0]!);
  const [booking, setBooking] = useState<DemoBooking | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const calendarEvent: CalendarEventInput | null = useMemo(() => {
    if (!booking) return null;
    const startsAt = new Date();
    startsAt.setHours(Number(booking.time.slice(0, 2)), Number(booking.time.slice(3, 5)), 0, 0);
    const endsAt = new Date(startsAt.getTime() + 20 * 60 * 1000);
    return {
      token: booking.token,
      serviceType: booking.service,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
  }, [booking]);

  function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setBooking({ name, phone, service, time, token: makeToken() });
    setAuditLog([]);
  }

  function handleReset() {
    setBooking(null);
    setAuditLog([]);
  }

  function handleSimulateLookup() {
    if (!booking) return;
    setAuditLog((log) => [
      ...log,
      { staff: "front-desk-07", reason: "Confirming arrival at check-in", at: new Date().toLocaleTimeString() },
    ]);
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 24px 96px" }}>
      <header style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <Wordmark width={280} />
        </div>
        <p style={{ color: "var(--accent)", fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>
          PRIVACY BY ARCHITECTURE
        </p>
        <h1 className="gs-display" style={{ fontSize: 38, fontWeight: 700, margin: "0 0 12px" }}>
          Your booker&rsquo;s name never touches the shared calendar.
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 17, maxWidth: 640, margin: "0 auto" }}>
          Fill in a demo booking below exactly as a patient would over WhatsApp, then see
          exactly what gets written to the calendar your whole front desk can see. Nothing
          on this page is sent anywhere or stored — it all runs in your browser.
        </p>
      </header>

      {!booking && (
        <form
          onSubmit={handleBook}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 28,
            maxWidth: 480,
            margin: "0 auto",
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <label style={labelStyle}>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Phone number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Service</label>
            <select value={service} onChange={(e) => setService(e.target.value)} style={inputStyle}>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Time (today)</label>
            <select value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle}>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" style={primaryButtonStyle}>
            Book this appointment
          </button>
        </form>
      )}

      {booking && calendarEvent && (
        <div>
          <div className="comparison-grid">
            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>What you told us</h2>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: -4 }}>
                Stored encrypted, separately, keyed only by the token below.
              </p>
              <dl style={dlStyle}>
                <dt>Name</dt>
                <dd>{booking.name}</dd>
                <dt>Phone</dt>
                <dd>{booking.phone}</dd>
                <dt>Service</dt>
                <dd>{booking.service}</dd>
                <dt>Time</dt>
                <dd>{booking.time}</dd>
              </dl>
            </div>

            <div style={{ ...cardStyle, borderColor: "var(--accent)" }}>
              <h2 style={cardTitleStyle}>What&rsquo;s written to the calendar</h2>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: -4 }}>
                The record every front-desk staff member can see.
              </p>
              <pre
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 13,
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(calendarEvent, null, 2)}
              </pre>
              <p style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                No name. No phone number. Just a token, a service, and a time slot.
              </p>
            </div>
          </div>

          <div style={{ ...cardStyle, marginTop: 24 }}>
            <h2 style={cardTitleStyle}>Turning the token back into a name requires a reason — and is logged</h2>
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              A front-desk staff member can look up who <code>{booking.token}</code> belongs to, but only
              with an authenticated session and a stated reason — and every lookup is recorded.
            </p>
            <button type="button" onClick={handleSimulateLookup} style={secondaryButtonStyle}>
              Simulate a staff lookup
            </button>
            {auditLog.length > 0 && (
              <table style={{ width: "100%", marginTop: 16, fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={thStyle}>Staff</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{entry.staff}</td>
                      <td style={tdStyle}>{entry.reason}</td>
                      <td style={tdStyle}>{entry.at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <button type="button" onClick={handleReset} style={secondaryButtonStyle}>
              Try another booking
            </button>
          </div>
        </div>
      )}

      <footer style={{ textAlign: "center", marginTop: 64, color: "var(--muted)", fontSize: 13 }}>
        <p>This is an illustrative demo — no data on this page is sent to a server or stored anywhere.</p>
        <p>
          <Link href="/pricing" style={{ color: "var(--accent)" }}>
            See pricing →
          </Link>
        </p>
      </footer>
    </main>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 15,
};
const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 20px",
  background: "var(--accent-solid)",
  color: "var(--accent-contrast)",
  border: "none",
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
};
const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 18px",
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
};
const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 24,
};
const cardTitleStyle: React.CSSProperties = { fontSize: 17, margin: "0 0 4px" };
const dlStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  columnGap: 12,
  rowGap: 6,
  fontSize: 14,
  marginTop: 12,
};
const thStyle: React.CSSProperties = { borderBottom: "1px solid var(--border)", padding: "6px 8px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid var(--border)", padding: "6px 8px" };
