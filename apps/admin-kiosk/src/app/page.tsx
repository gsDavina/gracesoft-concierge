"use client";

import type { AuthenticatedActor, Booking } from "@gracesoft/shared-types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, checkIn, fetchTodaysQueue } from "@/lib/api";
import { clearDevSession, loadDevSession } from "@/lib/session";
import { Mark } from "@/brand/Mark";
import { BRAND } from "@/brand/config";

const POLL_INTERVAL_MS = 15_000;

export default function QueuePage() {
  const router = useRouter();
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkingInToken, setCheckingInToken] = useState<string | null>(null);

  useEffect(() => {
    const session = loadDevSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setActor(session);
  }, [router]);

  const refresh = useCallback(async (currentActor: AuthenticatedActor) => {
    try {
      const { bookings: fetched } = await fetchTodaysQueue(currentActor);
      setBookings(fetched.filter((b) => b.status === "confirmed" || b.status === "checked-in"));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearDevSession();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load queue");
    }
  }, [router]);

  useEffect(() => {
    if (!actor) return;
    refresh(actor);
    const interval = setInterval(() => refresh(actor), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [actor, refresh]);

  async function handleCheckIn(token: string) {
    if (!actor) return;
    setCheckingInToken(token);
    try {
      await checkIn(actor, token);
      await refresh(actor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setCheckingInToken(null);
    }
  }

  if (!actor) return null;

  const waiting = bookings.filter((b) => b.status === "confirmed");
  const arrived = bookings.filter((b) => b.status === "checked-in");

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Mark initials={BRAND.initials} size={34} />
        <span style={{ fontFamily: "var(--font-montserrat)", fontStyle: "italic", fontSize: 16 }}>
          <span style={{ fontWeight: 800, color: "var(--gs-wordmark-grace)" }}>Grace</span>
          <span style={{ fontWeight: 600 }}>Soft</span> {BRAND.productName}
        </span>
      </div>
      <h1 style={{ fontSize: 32, marginBottom: 4 }}>Today&apos;s check-in queue</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {new Date().toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      {error && (
        <p role="alert" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <section>
        <h2 style={{ fontSize: 22 }}>Waiting ({waiting.length})</h2>
        {waiting.length === 0 && <p style={{ color: "var(--muted)" }}>No one waiting.</p>}
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {waiting.map((booking) => (
            <li key={booking.id} style={cardStyle}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{formatTime(booking.startsAt)}</div>
                <div style={{ color: "var(--muted)" }}>{booking.serviceType}</div>
                <div style={{ fontFamily: "monospace", fontSize: 14, color: "var(--muted)" }}>
                  Token: {booking.token}
                </div>
              </div>
              <button
                onClick={() => handleCheckIn(booking.token)}
                disabled={checkingInToken === booking.token}
                style={checkInButtonStyle}
              >
                {checkingInToken === booking.token ? "Checking in…" : "Check in"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Arrived ({arrived.length})</h2>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {arrived.map((booking) => (
            <li key={booking.id} style={{ ...cardStyle, opacity: 0.7 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{formatTime(booking.startsAt)}</div>
                <div style={{ color: "var(--muted)" }}>{booking.serviceType}</div>
              </div>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓ Arrived</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const cardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
};

const checkInButtonStyle: React.CSSProperties = {
  padding: "18px 28px",
  fontSize: 20,
  fontWeight: 700,
  background: "var(--accent-solid)",
  color: "var(--accent-contrast)",
  border: "none",
  borderRadius: 10,
  minWidth: 160,
};
