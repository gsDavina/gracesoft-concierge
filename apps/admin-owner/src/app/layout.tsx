import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { NavBar } from "./NavBar";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-montserrat",
  display: "swap",
});

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source-code-pro",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GraceSoft Atrium — Owner Dashboard",
  description: "Bookings, identity audit log, and settings.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${sourceCodePro.variable}`}>
      <body>
        <NavBar />
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px" }}>{children}</div>
      </body>
    </html>
  );
}
