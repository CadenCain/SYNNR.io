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
    default: "SYNNR — Loadout + Job Readiness for Field Operations",
    template: "%s",
  },
  description:
    "SYNNR verifies the crew, truck, tools, certs, inventory, paperwork, and billing backup are ready before a job moves forward — field-operations readiness for service companies.",
  keywords: [
    "job readiness", "field operations", "loadout checklist", "certification tracking",
    "oilfield", "industrial contractor", "job packet", "dispatch readiness",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR — Loadout + Job Readiness for Field Operations",
    description:
      "Stop job failures before they happen. SYNNR checks crew, truck, tools, certs, paperwork, and billing backup before the job moves forward.",
    url: "https://synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR — Loadout + Job Readiness for Field Operations",
    description:
      "Field-operations readiness software — every job verified Ready, At Risk, or Blocked before it rolls.",
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
