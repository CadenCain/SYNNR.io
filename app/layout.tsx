import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#08090a",
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
  // www is the primary host in Vercel (apex 308s to it): canonical URLs must
  // point at the serving host so search engines get one consistent signal.
  metadataBase: new URL("https://www.synnr.io"),
  title: {
    default: "SYNNR | Ask your company anything",
    template: "%s",
  },
  description:
    "SYNNR is an AI that learns your service company: what you charge, what your contracts say, how your crews do the job, what's on every truck. Then anybody on the crew can ask it. Built for oilfield service companies, wireline first. Early access.",
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR | Ask your company anything",
    description:
      "An AI that learns your service company, then answers your crew from the office or the truck. Wireline first. Early access.",
    url: "https://www.synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR | Ask your company anything",
    description:
      "An AI that learns your service company, then answers your crew from the office or the truck. Wireline first. Early access.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        {/* Structured data for a "SYNNR" brand search. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "SYNNR",
              url: "https://www.synnr.io",
              description:
                "An AI that learns an oilfield service company's prices, contracts, procedures, trucks and tools, and answers the crew's questions. Wireline first.",
              areaServed: "Permian Basin, West Texas",
            }),
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
