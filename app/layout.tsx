import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
    default: "RollReady – Oilfield Load-Out Software | Stop Gate Turnarounds",
    template: "%s",
  },
  description:
    "Make sure the right iron, in date, leaves your yard every time. Scan at load-out, block expired or missing equipment, and keep a locked record of who loaded what. Built for Permian service companies.",
  keywords: [
    "oilfield load out software", "equipment readiness oilfield", "prevent gate turnaround oilfield",
    "oilfield cert tracking loadout", "truck readiness software oilfield",
    "RollReady", "load-out scan", "pressure iron recertification", "NFC iron tags",
    "coil tubing", "wireline", "BOP test", "lubricator cert", "Permian Basin", "Midland", "Odessa",
  ],
  openGraph: {
    type: "website",
    siteName: "RollReady by SYNNR",
    title: "RollReady – Oilfield Load-Out Software | Stop Gate Turnarounds",
    description:
      "Stop costly load-out mistakes. Scan iron as it goes on the truck, block anything missing, expired, or red-tagged, and keep a locked record of who loaded what.",
    url: "https://www.synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "RollReady – Oilfield Load-Out Software | Stop Gate Turnarounds",
    description:
      "Stop costly load-out mistakes. Scan iron as it goes on the truck, block anything missing, expired, or red-tagged, and keep a locked record of who loaded what.",
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
        {/* Structured data for a "RollReady" / "SYNNR" brand search. */}
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
                "Oilfield load-out software. Hands scan each piece of iron as it goes on the truck; anything missing, expired, or red-tagged blocks the truck in the yard, with a locked record of who loaded what.",
              offers: { "@type": "Offer", price: "500", priceCurrency: "USD", description: "Per yard, per month" },
              publisher: {
                "@type": "Organization",
                name: "RollReady",
                url: "https://www.synnr.io",
                areaServed: "Permian Basin, West Texas",
              },
            }),
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
