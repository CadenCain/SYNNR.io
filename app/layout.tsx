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
    default: "SYNNR | Tell it the job. It tells you what to take.",
    template: "%s",
  },
  description:
    "SYNNR is an operations AI for wireline. Say what you're running. It gives your crew what the job takes with the critical pieces first, a checklist to load by with photo proof, and a plain READY or NOT READY before the truck rolls. Early access.",
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR | Tell it the job. It tells you what to take.",
    description:
      "Operations AI for wireline. What the job takes with the critical pieces first, a checklist to load by, and a plain READY or NOT READY before the truck rolls. Early access.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR | Tell it the job. It tells you what to take.",
    description:
      "Operations AI for wireline. What the job takes with the critical pieces first, a checklist to load by, and a plain READY or NOT READY before the truck rolls. Early access.",
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
                "Operations AI for wireline service companies. Tell it the job and it gives the crew what to take, a checklist to load by, and a ready check before the truck rolls.",
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
