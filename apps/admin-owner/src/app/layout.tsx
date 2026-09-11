import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { NavBar } from "./NavBar";

export const metadata: Metadata = {
  title: "Concierge — Owner Dashboard",
  description: "Bookings, identity audit log, and settings.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px" }}>{children}</div>
      </body>
    </html>
  );
}
