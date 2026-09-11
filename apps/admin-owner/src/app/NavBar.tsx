"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearDevSession, loadDevSession } from "@/lib/session";

const links = [
  { href: "/", label: "Bookings" },
  { href: "/audit-log", label: "Audit log" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = typeof window !== "undefined" ? loadDevSession() : null;

  if (pathname === "/login") return null;

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <strong>Concierge</strong>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{ color: pathname === link.href ? "var(--accent)" : "var(--muted)" }}
          >
            {link.label}
          </Link>
        ))}
      </div>
      {session && (
        <button
          onClick={() => {
            clearDevSession();
            router.push("/login");
          }}
          style={{ background: "none", border: "none", color: "var(--muted)" }}
        >
          Sign out
        </button>
      )}
    </nav>
  );
}
