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
  // www is the primary host in Vercel (apex 308s to it) — canonical URLs must
  // point at the serving host so search engines get one consistent signal.
  metadataBase: new URL("https://www.synnr.io"),
  title: {
    default: "RollReady by SYNNR — yard readiness for oilfield service shops",
    template: "%s",
  },
  description:
    "RollReady keeps up with every asset, cert, DOT item, and crew card in your yard, and texts you before anything lapses. Run a readiness check on the phone before a truck rolls. $500 per yard, per month. Built by SYNNR.",
  keywords: [
    "RollReady", "SYNNR", "yard readiness", "equipment readiness", "cert tracking", "cert expiration alerts",
    "crew card tracking", "oilfield service software", "wireline", "coil tubing", "cementing", "BOP testing",
    "BOP recertification", "crew certs", "H2S certification", "well control", "DOT inspection",
    "Permian Basin", "Midland", "Odessa", "service shop operations", "oilfield compliance",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "RollReady — catch the miss before the truck leaves the yard",
    description:
      "Yard readiness for oilfield service shops. Cert, DOT, and crew-card tracking with alerts before anything lapses, plus shareable readiness-proof links. $500 per yard. By SYNNR.",
    url: "https://www.synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "RollReady — catch the miss before the truck leaves the yard",
    description:
      "Yard readiness for oilfield service shops. Cert & crew-card tracking, alerts before anything expires, readiness checks, proof links. $500 per yard. By SYNNR.",
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
              url: "https://www.synnr.io",
              description:
                "Yard readiness for oilfield service shops. Keeps up with every cert, DOT item, and crew card, and flags what's lapsed or lapsing before a truck leaves with it.",
              offers: { "@type": "Offer", price: "500", priceCurrency: "USD", description: "Per yard, per month" },
              publisher: {
                "@type": "Organization",
                name: "SYNNR",
                url: "https://www.synnr.io",
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
