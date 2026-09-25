"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthenticatedActor } from "@gracesoft/shared-types";
import { clearDevSession, loadDevSession } from "@/lib/session";
import { Mark } from "@/brand/Mark";
import { BRAND } from "@/brand/config";

const links = [
  { href: "/", label: "Bookings" },
  { href: "/blueprint", label: "Blueprint" },
  { href: "/audit-log", label: "Audit log" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  // Read localStorage in an effect, not at render time: reading it during render makes
  // the client's first render diverge from the server-rendered HTML (which always has no
  // session), which is what was causing a hydration error on every page.
  const [session, setSession] = useState<AuthenticatedActor | null>(null);
  useEffect(() => {
    setSession(loadDevSession());
  }, [pathname]);

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
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Mark size={30} />
          <span style={{ fontFamily: "var(--font-montserrat)", fontStyle: "italic", fontSize: 15 }}>
            <span style={{ fontWeight: 800, color: "var(--gs-brand-grace)" }}>Grace</span>
            <span style={{ fontWeight: 600 }}>Soft</span> Concierge{" "}
            <span style={{ color: "var(--gs-brand-product)" }}>{BRAND.productName}</span>
          </span>
        </div>
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
