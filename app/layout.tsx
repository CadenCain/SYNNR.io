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
    default: "SYNNR — Revenue Intelligence for Field Operations",
    template: "%s",
  },
  description:
    "SYNNR is the self-serve intelligence system that finds lost revenue, cleans job packets, validates pricing, and helps field service companies get paid faster.",
  keywords: [
    "revenue intelligence", "field service", "billing assurance", "revenue recovery",
    "oilfield", "industrial contractor", "invoice audit", "MSA compliance",
  ],
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR — Revenue Intelligence for Field Operations",
    description:
      "Find missed charges before the invoice goes out. SYNNR turns scattered tickets, photos, pricing, and field notes into invoice-ready proof.",
    url: "https://synnr.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR — Revenue Intelligence for Field Operations",
    description:
      "The self-serve intelligence system that finds lost revenue between the field and the invoice.",
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
