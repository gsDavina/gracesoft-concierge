import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concierge — Privacy-first booking, in 30 seconds",
  description:
    "See exactly what a booking bot needs to know versus what ends up on a shared calendar.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
