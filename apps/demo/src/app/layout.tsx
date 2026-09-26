import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat, Playfair_Display, Source_Code_Pro } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-montserrat",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source-code-pro",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GraceSoft Concierge Demo — Privacy-first booking, in 30 seconds",
  description:
    "See exactly what a booking bot needs to know versus what ends up on a shared calendar.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${playfairDisplay.variable} ${sourceCodePro.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
