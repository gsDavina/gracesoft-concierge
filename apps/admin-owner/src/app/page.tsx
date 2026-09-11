"use client";

import type { Booking } from "@gracesoft/shared-types";
import { useEffect, useState } from "react";
import { ApiError, fetchBookings } from "@/lib/api";
import { clearDevSession } from "@/lib/session";
import { useRequireSession } from "@/lib/useRequireSession";
import { useRouter } from "next/navigation";

const STATUS_LABELS: Record<Booking["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  "checked-in": "Checked in",
  cancelled: "Cancelled",
  completed: "Completed",
};

export default function BookingsPage() {
  const actor = useRequireSession();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor) return;
    fetchBookings(actor)
      .then(({ bookings: fetched }) => setBookings(fetched))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearDevSession();
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load bookings");
      })
      .finally(() => setLoading(false));
  }, [actor, router]);

  if (!actor) return null;

  return (
    <main>
      <h1>Bookings</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {!loading && bookings.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No bookings yet.</p>
      )}
      {bookings.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Starts</th>
              <th>Service</th>
              <th>Token</th>
              <th>Channel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td>{new Date(booking.startsAt).toLocaleString()}</td>
                <td>{booking.serviceType}</td>
                <td style={{ fontFamily: "monospace" }}>{booking.token}</td>
                <td>{booking.channel}</td>
                <td>{STATUS_LABELS[booking.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
