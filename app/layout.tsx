import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SwRegister from "./sw-register";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#131110",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://synnr.io"),
  title: {
    default: "SYNNR — the rolling-ready system for oilfield service shops",
    template: "%s",
  },
  description:
    "Keep your crews rolling ready. Track every asset, cert, DOT item, and crew card — and run a pre-dispatch check that catches the miss before the truck leaves the yard. Get the text before anything expires.",
  keywords: [
    "equipment readiness", "cert tracking", "pre-dispatch check", "loadout check", "oilfield service", "wireline",
    "coil tubing", "cementing", "BOP testing", "crew certs", "H2S certification", "well control", "DOT inspection",
    "Permian", "service shop operations",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR — the rolling-ready system for oilfield service shops",
    description:
      "Catch the miss before the truck leaves the yard. Pre-dispatch loadout checks, cert/DOT/crew-card tracking with alerts, and shareable readiness-proof links.",
    url: "https://synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR — the rolling-ready system for oilfield service shops",
    description:
      "Catch the miss before the truck leaves the yard. Loadout checks, cert & crew-card tracking, alerts before anything expires, and readiness-proof links.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <Analytics />
        <SwRegister />
      </body>
    </html>
  );
}
