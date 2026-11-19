import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteAnalytics } from "@/components/site-analytics";
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
    default: "SYNNR | The operating brain of your shop.",
    template: "%s",
  },
  description:
    "SYNNR is the operating brain for oilfield service companies. Your SOPs, MSAs, job knowledge, and pricing, where anyone on the crew can ask. It answers from your own documents and shows where it got it. If it isn't in there, it says so. Early access.",
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR | The operating brain of your shop.",
    description:
      "For oilfield service companies. Your SOPs, MSAs, job knowledge, and pricing, where anyone on the crew can ask. Grounded in your documents. Nothing invented. Early access.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR | The operating brain of your shop.",
    description:
      "For oilfield service companies. Your SOPs, MSAs, job knowledge, and pricing, where anyone on the crew can ask. Grounded in your documents. Nothing invented. Early access.",
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
                "Software for oilfield service companies. A shop puts in its own procedures, customer terms, and prices, and its crew asks questions that are answered from those documents, with the passage shown.",
              areaServed: "Permian Basin, West Texas",
            }),
          }}
        />
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
