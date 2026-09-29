import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Self-hosted from @fontsource-variable rather than next/font/google: the Google loader
 * downloads fonts at build time, and in Next 14 it crashes when Google Fonts serves a
 * font URL without a file extension ("Cannot read properties of null (reading '1')"),
 * failing deploys. Bundled variable fonts cover every weight with no network needed.
 */
const montserrat = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

const sourceCodePro = localFont({
  src: "../../node_modules/@fontsource-variable/source-code-pro/files/source-code-pro-latin-wght-normal.woff2",
  weight: "200 900",
  variable: "--font-source-code-pro",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GraceSoft Concierge Kiosk — Check-in",
  description: "Front-desk check-in queue.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${sourceCodePro.variable}`}>
      <body>{children}</body>
    </html>
  );
}
