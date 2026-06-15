import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
    default: "SYNNR — Custom Operating Systems for Oilfield Service Companies",
    template: "%s",
  },
  description:
    "SYNNR is an AI automation & operations agency for oilfield service companies. We build custom operating systems — AI ingestion, digital yard twins, intelligent ticketing — deployed on your cloud and owned by you. No monthly seat licenses.",
  keywords: [
    "oilfield software", "AI automation agency", "custom field operations software", "wireline",
    "coil tubing", "digital yard twin", "intelligent ticketing", "operations audit",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR — Custom Operating Systems for Oilfield Service Companies",
    description:
      "Stop paying monthly for software that doesn't talk to each other. We build custom operating systems, deploy them on your cloud, and hand you the keys.",
    url: "https://synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR — Custom Operating Systems for Oilfield Service Companies",
    description:
      "AI automation & ops agency for oilfield service. Build & Transfer — own your software, no monthly seat licenses.",
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
      </body>
    </html>
  );
}
