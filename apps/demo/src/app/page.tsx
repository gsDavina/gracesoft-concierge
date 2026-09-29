"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BRAND } from "@/brand/config";

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
 * calendar event with token instead of name." The booking itself is illustrative and
 * never leaves the browser — nothing typed here is sent or persisted. The only request
 * is a read of the demo business's published services, open dates and free times
 * (apps/api's /public availability routes), so the form follows the same opening hours
 * the owner set in Admin. The calendar-event shape mirrors `CalendarEventInput`.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const DEMO_BUSINESS_ID = process.env.NEXT_PUBLIC_DEMO_BUSINESS_ID ?? "dev-business-1";

interface PublicService {
  name: string;
  durationMinutes: number;
}

interface BookingOptions {
  timezone: string;
  services: PublicService[];
  dates: string[];
}

interface Slot {
  time: string;
  startsAt: string;
  endsAt: string;
}

interface DemoBooking {
  name: string;
  phone: string;
  service: string;
  slot: Slot;
  token: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/public/businesses/${encodeURIComponent(DEMO_BUSINESS_ID)}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
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

/** "2026-10-05" -> "Mon, 5 Oct", read as a calendar date in the clinic's timezone. */
function formatDate(date: string, timeZone?: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timeZone ?? "UTC",
  });
}

function formatDateTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export default function DemoPage() {
  const [name, setName] = useState("Alex Tan");
  const [phone, setPhone] = useState("+65 9123 4567");
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [service, setService] = useState("");
  const [date, setDate] = useState("");
  const dateChosenByUser = useRef(false);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotStart, setSlotStart] = useState("");
  const [booking, setBooking] = useState<DemoBooking | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const loadOptions = useCallback(async () => {
    setOptionsError(null);
    try {
      const loaded = await getJson<BookingOptions>("/booking-options?days=14");
      setOptions(loaded);
      setService((current) => current || loaded.services[0]?.name || "");
      setDate((current) => current || loaded.dates[0] || "");
    } catch {
      setOptionsError("Couldn't load the clinic's opening hours.");
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Free times for the chosen service + date, straight from the published opening hours.
  useEffect(() => {
    if (!service || !date) return;
    let cancelled = false;
    setSlots(null);
    setSlotsError(null);
    getJson<{ slots: Slot[] }>(`/slots?service=${encodeURIComponent(service)}&date=${date}`)
      .then(({ slots: loaded }) => {
        if (cancelled) return;
        // The date was picked for them (e.g. today, late in the evening) and it has nothing
        // left: move on to the next open date rather than opening on an empty day.
        const nextDate = options?.dates[options.dates.indexOf(date) + 1];
        if (loaded.length === 0 && !dateChosenByUser.current && nextDate) {
          setDate(nextDate);
          return;
        }
        setSlots(loaded);
        setSlotStart(loaded[0]?.startsAt ?? "");
      })
      .catch(() => !cancelled && setSlotsError("Couldn't load times for that day."));
    return () => {
      cancelled = true;
    };
  }, [service, date, options]);

  const timezone = options?.timezone;
  const selectedSlot = slots?.find((s) => s.startsAt === slotStart) ?? null;

  const calendarEvent: CalendarEventInput | null = useMemo(() => {
    if (!booking) return null;
    return {
      token: booking.token,
      serviceType: booking.service,
      startsAt: booking.slot.startsAt,
      endsAt: booking.slot.endsAt,
    };
  }, [booking]);

  function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setBooking({ name, phone, service, slot: selectedSlot, token: makeToken() });
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
          <Image src="/brand/wm-d-w.svg" alt={BRAND.fullName} width={280} height={73} unoptimized priority />
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
          you type here is sent anywhere or stored — only the clinic&rsquo;s open times are
          fetched, so you can only book when it&rsquo;s actually open.
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
          {optionsError && (
            <div role="alert" style={noticeStyle}>
              {optionsError}{" "}
              <button type="button" onClick={loadOptions} style={linkButtonStyle}>
                Try again
              </button>
            </div>
          )}
          {!options && !optionsError && <p style={{ color: "var(--muted)", margin: 0 }}>Loading opening hours…</p>}
          {options && (options.services.length === 0 || options.dates.length === 0) && (
            <div style={noticeStyle}>
              The clinic hasn&rsquo;t published any bookable hours for the next two weeks yet.
            </div>
          )}
          {options && options.services.length > 0 && options.dates.length > 0 && (
            <>
              <div>
                <label style={labelStyle} htmlFor="demo-service">
                  Service
                </label>
                <select
                  id="demo-service"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  style={inputStyle}
                >
                  {options.services.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.durationMinutes} min)
                    </option>
                  ))}
                </select>
              </div>
              <div className="demo-date-time">
                <div>
                  <label style={labelStyle} htmlFor="demo-date">
                    Date
                  </label>
                  <select
                    id="demo-date"
                    value={date}
                    onChange={(e) => {
                      dateChosenByUser.current = true;
                      setDate(e.target.value);
                    }}
                    style={inputStyle}
                  >
                    {options.dates.map((d) => (
                      <option key={d} value={d}>
                        {formatDate(d, timezone)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="demo-time">
                    Time
                  </label>
                  <select
                    id="demo-time"
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    style={inputStyle}
                    disabled={!slots || slots.length === 0}
                  >
                    {!slots && !slotsError && <option value="">Loading…</option>}
                    {slots?.length === 0 && <option value="">No times left</option>}
                    {slots?.map((s) => (
                      <option key={s.startsAt} value={s.startsAt}>
                        {s.time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {slotsError && (
                <p role="alert" style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>
                  {slotsError}
                </p>
              )}
              {slots?.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                  No times left on this day — pick another date.
                </p>
              )}
              <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
                Only dates and times inside the clinic&rsquo;s published opening hours are offered
                {timezone ? ` (times in ${timezone})` : ""}.
              </p>
            </>
          )}
          <button
            type="submit"
            style={{ ...primaryButtonStyle, opacity: selectedSlot ? 1 : 0.5, cursor: selectedSlot ? "pointer" : "not-allowed" }}
            disabled={!selectedSlot}
          >
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
                <dt>When</dt>
                <dd>{formatDateTime(booking.slot.startsAt, timezone)}</dd>
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
        <p>This is an illustrative demo — nothing you enter is sent to a server or stored anywhere.</p>
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
const noticeStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--bg)",
  color: "var(--muted)",
  fontSize: 14,
};
const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--accent)",
  fontWeight: 600,
  cursor: "pointer",
};
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
