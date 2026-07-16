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
    default: "RollReady by SYNNR — yard readiness for oilfield service shops",
    template: "%s",
  },
  description:
    "RollReady tracks every asset, cert, DOT item, and crew card and runs a pre-dispatch check that catches the miss before the truck leaves the yard. Get the text before anything expires. $500 per yard, per month. Built by SYNNR.",
  keywords: [
    "RollReady", "SYNNR", "yard readiness", "equipment readiness", "cert tracking", "pre-dispatch check",
    "loadout check", "oilfield service software", "wireline", "coil tubing", "cementing", "BOP testing",
    "BOP recertification", "crew certs", "H2S certification", "well control", "DOT inspection",
    "Permian Basin", "Midland", "Odessa", "service shop operations", "oilfield compliance",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "RollReady — catch the miss before the truck leaves the yard",
    description:
      "Yard readiness for oilfield service shops. Pre-dispatch checks, cert/DOT/crew-card tracking with alerts, and shareable readiness-proof links. $500 per yard. By SYNNR.",
    url: "https://synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "RollReady — catch the miss before the truck leaves the yard",
    description:
      "Yard readiness for oilfield service shops. Loadout checks, cert & crew-card tracking, alerts before anything expires, readiness-proof links. $500 per yard. By SYNNR.",
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
        {/* Structured data — helps Google understand the product + company on a
            "RollReady" or "SYNNR" brand search. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "RollReady",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: "https://synnr.io",
              description:
                "Yard readiness for oilfield service shops. Tracks every cert, DOT item, and crew card and runs a pre-dispatch check that catches the miss before the truck leaves the yard.",
              offers: { "@type": "Offer", price: "500", priceCurrency: "USD", description: "Per yard, per month" },
              publisher: {
                "@type": "Organization",
                name: "SYNNR",
                url: "https://synnr.io",
                areaServed: "Permian Basin, West Texas",
              },
            }),
          }}
        />
        {children}
        <Analytics />
        <SwRegister />
      </body>
    </html>
  );
}
