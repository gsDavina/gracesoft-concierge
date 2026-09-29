"use client";

import type { AuthenticatedActor, Booking } from "@gracesoft/shared-types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, checkIn, fetchTodaysQueue } from "@/lib/api";
import { clearDevSession, loadDevSession } from "@/lib/session";
import Image from "next/image";
import { BRAND } from "@/brand/config";

const POLL_INTERVAL_MS = 15_000;

export default function QueuePage() {
  const router = useRouter();
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkingInToken, setCheckingInToken] = useState<string | null>(null);
  const now = useNow();

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
    <>
      <header className="band">
        <div className="band-top">
          <div className="band-brand">
            <Image src="/brand/wm-k-w.svg" alt={BRAND.fullName} width={200} height={52} unoptimized priority />
          </div>
          <button
            type="button"
            className="band-signout"
            onClick={() => {
              clearDevSession();
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
        <div className="band-hero">
          <div>
            <h1 className="band-title">Front desk check-in</h1>
            <p className="band-date">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="band-clock" aria-label="Current time">
            {formatTime(now.toISOString())}
          </div>
        </div>
      </header>

      <main className="board">
        <div className="stats">
          <div className="stat stat-waiting">
            <div className="stat-label">Waiting</div>
            <div className="stat-value">{waiting.length}</div>
          </div>
          <div className="stat stat-arrived">
            <div className="stat-label">Arrived</div>
            <div className="stat-value">{arrived.length}</div>
          </div>
          <div className="stat stat-next">
            <div className="stat-label">Next up</div>
            <div className="stat-value">{waiting[0] ? formatTime(waiting[0].startsAt) : "—"}</div>
          </div>
        </div>

        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}

        <div className="columns">
          <section>
            <h2 className="column-title">
              Waiting <span className="count">{waiting.length}</span>
            </h2>
            {waiting.length === 0 ? (
              <div className="empty">
                <strong>No one waiting</strong>
                New arrivals for today will appear here.
              </div>
            ) : (
              <ul className="queue">
                {waiting.map((booking, i) => (
                  <li key={booking.id} className={i === 0 ? "ticket ticket-next" : "ticket"}>
                    <div className="ticket-time">{formatTime(booking.startsAt)}</div>
                    <div className="ticket-body">
                      {i === 0 && <div className="next-tag">Next up</div>}
                      <div className="ticket-service">{booking.serviceType}</div>
                      <span className="ticket-token">{booking.token}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCheckIn(booking.token)}
                      disabled={checkingInToken === booking.token}
                      className="check-in"
                    >
                      {checkingInToken === booking.token ? "Checking in…" : "Check in"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="column-title">
              Arrived <span className="count count-arrived">{arrived.length}</span>
            </h2>
            {arrived.length === 0 ? (
              <div className="empty">Checked-in guests will be listed here.</div>
            ) : (
              <ul className="queue" style={{ gap: 10 }}>
                {arrived.map((booking) => (
                  <li key={booking.id} className="arrived">
                    <span className="arrived-check" aria-label="Arrived">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m5 12 5 5 9-10" />
                      </svg>
                    </span>
                    <div>
                      <div className="arrived-time">{formatTime(booking.startsAt)}</div>
                      <div className="arrived-service">{booking.serviceType}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

/** Ticks once every 30s — enough to keep the header clock's minute current. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
