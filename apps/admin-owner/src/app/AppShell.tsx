"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { AuthenticatedActor } from "@gracesoft/shared-types";
import { clearDevSession, loadDevSession } from "@/lib/session";
import Image from "next/image";
import { BRAND } from "@/brand/config";

const links = [
  { href: "/", label: "Bookings", icon: <CalendarIcon /> },
  { href: "/blueprint", label: "Blueprint", icon: <LayersIcon /> },
  { href: "/audit-log", label: "Audit log", icon: <ShieldIcon /> },
];

/** Sidebar console chrome around every page except /login, which renders full-bleed. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Read localStorage in an effect, not at render time: reading it during render makes
  // the client's first render diverge from the server-rendered HTML (which always has no
  // session), which is what was causing a hydration error on every page.
  const [session, setSession] = useState<AuthenticatedActor | null>(null);
  useEffect(() => {
    setSession(loadDevSession());
  }, [pathname]);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Image src="/brand/wm-a-w.svg" alt={BRAND.fullName} width={180} height={47} unoptimized priority />
        </div>
        <div className="sidebar-section">Manage</div>
        <nav className="nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>
        {session && (
          <div className="sidebar-footer">
            <div className="avatar" aria-hidden="true">
              {session.userId.slice(0, 1).toUpperCase()}
            </div>
            <div className="sidebar-user">
              <strong title={session.userId}>{session.userId}</strong>
              <span>Owner</span>
            </div>
            <button
              type="button"
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => {
                clearDevSession();
                router.push("/login");
              }}
            >
              <SignOutIcon />
            </button>
          </div>
        )}
      </aside>
      <div className="content">
        <div className="content-inner">{children}</div>
      </div>
    </div>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3 2.5 8 12 13l9.5-5L12 3Z" />
      <path d="m2.5 12.5 9.5 5 9.5-5M2.5 16.5l9.5 5 9.5-5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg {...iconProps}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
    </svg>
  );
}
