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
    default: "RollReady by SYNNR: equipment test tracking for oilfield service yards",
    template: "%s",
  },
  description:
    "RollReady keeps every piece of iron in an oilfield service yard on one list, with its serial, which truck it's on, and when its next test is due. A yard map, load-out scans, QR and NFC tags, and a warning before anything lapses. $500 per yard, per month. Never per-seat.",
  keywords: [
    "RollReady", "SYNNR", "iron tracking", "pressure iron tracking", "flow iron recertification", "treating iron", "equipment test tracking",
    "QR equipment tags", "NDT recertification tracking", "equipment tracking", "where is my equipment", "oilfield service software",
    "wireline", "coil tubing", "cementing", "BOP testing", "BOP recertification", "lubricator pressure test", "DOT inspection",
    "Permian Basin", "Midland", "Odessa", "service shop operations", "oilfield compliance",
  ],
  openGraph: {
    type: "website",
    siteName: "RollReady by SYNNR",
    title: "RollReady by SYNNR: equipment test tracking for oilfield service yards",
    description:
      "Every piece of iron in your yard on one list, with its serial, where it is, and its next test. A warning before anything lapses. $500 per yard, per month.",
    url: "https://www.synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "RollReady by SYNNR: equipment test tracking for oilfield service yards",
    description:
      "Every piece of iron in your yard on one list, with its serial, where it is, and its next test. A warning before anything lapses. $500 per yard, per month.",
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
                "Equipment test tracking for oilfield service yards. Every piece of iron on one list with its serial, location, and next test, QR tags, and a warning before anything lapses.",
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
