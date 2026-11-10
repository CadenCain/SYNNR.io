import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { THEME_SCRIPT } from "@/components/theme";

export const viewport: Viewport = {
  themeColor: "#07090c",
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
    default: "RollReady | Every Truck Leaves the Yard With the Right Gear",
    template: "%s",
  },
  description:
    "A load-out check a tired hand can do in under a minute. Tap what's on the truck, take one photo, tap Ready. Anything missing reads NOT READY, and you keep a locked record of who cleared the truck. Built for Permian service yards.",
  keywords: [
    "oilfield load out checklist", "truck load out app", "oilfield truck checklist", "prevent hotshots oilfield",
    "who loaded the truck", "load-out record", "setting tool tracking", "RollReady",
    "wireline", "coil tubing", "Permian Basin", "Midland", "Odessa",
  ],
  openGraph: {
    type: "website",
    siteName: "RollReady by SYNNR",
    title: "RollReady | Make sure the right stuff goes out",
    description:
      "A check at the truck in under a minute. Anything missing reads NOT READY and says what, and you always know who cleared the truck.",
    url: "https://www.synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "RollReady | Make sure the right stuff goes out",
    description:
      "A check at the truck in under a minute. Anything missing reads NOT READY and says what, and you always know who cleared the truck.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Light or dark before the first paint (app and sign-in pages only). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
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
                "A load-out check for oilfield service yards. The hand taps what's on the truck, takes one photo, and taps Ready in under a minute. Anything missing reads NOT READY, with a locked record of who cleared the truck.",
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
