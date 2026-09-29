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
    default: "SYNNR: cert tracking for oilfield service yards",
    template: "%s",
  },
  description:
    "SYNNR tracks every cert, DOT date, and crew card in an oilfield service yard and warns you before anything lapses, so a truck never gets turned around at the gate. $500 per yard, per month. Never per-seat.",
  keywords: [
    "SYNNR", "yard readiness", "equipment readiness", "cert tracking", "cert expiration alerts",
    "crew card tracking", "equipment tracking", "where is my equipment", "oilfield service software", "wireline", "coil tubing", "cementing", "BOP testing",
    "BOP recertification", "crew certs", "H2S certification", "well control", "DOT inspection",
    "Permian Basin", "Midland", "Odessa", "service shop operations", "oilfield compliance",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR: cert tracking for oilfield service yards",
    description:
      "Every cert, DOT date, and crew card in your yard on one list, with a warning before anything lapses. $500 per yard, per month.",
    url: "https://www.synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR: cert tracking for oilfield service yards",
    description:
      "Every cert, DOT date, and crew card in your yard on one list, with a warning before anything lapses. $500 per yard, per month.",
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
        {/* Structured data for a "SYNNR" brand search. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "SYNNR",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: "https://www.synnr.io",
              description:
                "Cert tracking for oilfield service yards. Every cert, DOT date, and crew card on one list, with a warning before anything lapses and a readiness check before a truck rolls.",
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
      </body>
    </html>
  );
}
