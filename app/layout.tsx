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
    default: "SYNNR — Purpose-built software for oilfield service companies",
    template: "%s",
  },
  description:
    "SYNNR builds software for oilfield service companies — the boring operational stuff, finally done right. Start with TallyShot: photograph a handwritten tally sheet and get clean Excel back, every shaky digit flagged for review.",
  keywords: [
    "oilfield software", "tally sheet to excel", "TallyShot", "field operations software", "wireline",
    "coil tubing", "handwriting to spreadsheet", "oilfield service software", "digitize tally sheets",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR — Purpose-built software for oilfield service companies",
    description:
      "TallyShot: photograph a handwritten tally sheet, get clean Excel back with every shaky digit flagged. The boring operational stuff, finally done right.",
    url: "https://synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR — Purpose-built software for oilfield service companies",
    description:
      "TallyShot turns a photo of a handwritten tally sheet into clean Excel — shaky digits flagged for review. Priced for a service shop.",
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
        <SwRegister />
      </body>
    </html>
  );
}
