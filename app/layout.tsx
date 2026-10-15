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
    default: "RollReady by SYNNR: load-out readiness for oilfield service yards",
    template: "%s",
  },
  description:
    "RollReady checks every piece of iron as it goes on the truck. Anything out of test, red-tagged, or missing gets caught in the yard, not at the gate, and you keep a record of what left that nobody can edit. $500 per yard, per month. Never per-seat.",
  keywords: [
    "RollReady", "SYNNR", "load-out readiness", "load out scan", "iron tracking", "pressure iron tracking", "flow iron recertification", "treating iron", "equipment test tracking",
    "QR equipment tags", "NDT recertification tracking", "equipment tracking", "where is my equipment", "oilfield service software",
    "wireline", "coil tubing", "cementing", "BOP testing", "BOP recertification", "lubricator pressure test", "DOT inspection",
    "Permian Basin", "Midland", "Odessa", "service shop operations", "oilfield compliance",
  ],
  openGraph: {
    type: "website",
    siteName: "RollReady by SYNNR",
    title: "RollReady by SYNNR: load-out readiness for oilfield service yards",
    description:
      "Nothing out of test goes on the truck. Scan every piece at load-out, catch it in the yard, and keep the record of what left. $500 per yard, per month.",
    url: "https://www.synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "RollReady by SYNNR: load-out readiness for oilfield service yards",
    description:
      "Nothing out of test goes on the truck. Scan every piece at load-out, catch it in the yard, and keep the record of what left. $500 per yard, per month.",
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
                "Load-out readiness for oilfield service yards. Every piece of iron gets scanned as it goes on the truck; anything out of test gets caught in the yard, with a record of what left.",
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
