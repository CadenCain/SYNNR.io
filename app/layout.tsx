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
    default: "SYNNR — operations partner for oilfield service shops",
    template: "%s",
  },
  description:
    "Your jobs leak money in the boring stuff — missing tools, wrong trucks, cert misses, kicked-back invoices. SYNNR finds where your operation bleeds, builds the system that stops it, and runs it for you every week. Free Readiness Call first.",
  keywords: [
    "oilfield operations partner", "managed operations service", "wireline", "coil tubing", "cementing",
    "field operations", "readiness", "Permian", "service shop operations", "loadout cert tracking",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR — operations partner for oilfield service shops",
    description:
      "We find where your jobs leak money — missing tools, cert misses, kicked-back invoices — build the system that stops it, and run it for you. Free Readiness Call first.",
    url: "https://synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR — operations partner for oilfield service shops",
    description:
      "Your jobs are leaking money in the boring stuff. SYNNR finds it, builds the fix, and runs it for you. Free Readiness Call.",
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
