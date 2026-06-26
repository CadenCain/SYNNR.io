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
    default: "SYNNR — equipment & cert readiness for oilfield service shops",
    template: "%s",
  },
  description:
    "Keep your crews rolling ready. Equipment & cert readiness tracking for oilfield service shops, done for you. Never miss an expiration or asset. Free readiness audit.",
  keywords: [
    "equipment readiness", "cert tracking", "oilfield service", "wireline", "coil tubing", "cementing",
    "BOP testing", "crew certs", "H2S certification", "well control", "Permian", "service shop operations",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR — equipment & cert readiness for oilfield service shops",
    description:
      "Keep your crews rolling ready. Track every asset and cert in your yard, get alerted before anything expires. Done for you. Free readiness audit.",
    url: "https://synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR — equipment & cert readiness for oilfield service shops",
    description:
      "Keep your crews rolling ready. Track every asset and cert. Get a free readiness audit — we'll show you what's expired, expiring, and missing.",
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
