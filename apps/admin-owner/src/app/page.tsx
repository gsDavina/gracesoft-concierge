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

const STATUS_BADGE: Record<Booking["status"], string> = {
  pending: "badge-warning",
  confirmed: "badge-accent",
  "checked-in": "badge-success",
  cancelled: "badge-danger",
  completed: "badge-neutral",
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

  const count = (status: Booking["status"]) => bookings.filter((b) => b.status === status).length;
  const stats = [
    { label: "Total bookings", value: bookings.length, tone: "stat-neutral" },
    { label: "Pending", value: count("pending"), tone: "stat-warning" },
    { label: "Confirmed", value: count("confirmed"), tone: "stat-accent" },
    { label: "Checked in", value: count("checked-in"), tone: "stat-success" },
  ];

  return (
    <main>
      <header className="page-header">
        <div>
          <div className="eyebrow">Overview</div>
          <h1 className="page-title">Bookings</h1>
          <p className="page-subtitle">Every booking across channels, identified by token only.</p>
        </div>
      </header>

      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}

      <div className="stats">
        {stats.map((stat) => (
          <div key={stat.label} className={`stat ${stat.tone}`}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{loading || error ? "—" : stat.value}</div>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">All bookings</h2>
            <p className="card-description">Upcoming and past appointments.</p>
          </div>
        </div>
        {loading && (
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ width: `${90 - i * 15}%` }} />
            ))}
          </div>
        )}
        {!loading && !error && bookings.length === 0 && (
          <div className="empty">
            <div className="empty-title">No bookings yet</div>
            New bookings from any channel will appear here.
          </div>
        )}
        {bookings.length > 0 && (
          <div className="table-wrap">
            <table className="table">
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
                    <td>{formatDateTime(booking.startsAt)}</td>
                    <td>{booking.serviceType}</td>
                    <td>
                      <span className="token">{booking.token}</span>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{booking.channel}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[booking.status]}`}>
                        {STATUS_LABELS[booking.status]}
                      </span>
                    </td>
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
