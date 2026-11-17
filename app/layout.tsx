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
    "SYNNR is for oilfield service companies. Say what you're running. It gives your crew what the job takes, has them prove the critical pieces with a photo, and tells you READY or NOT READY before the truck rolls. After the job, they prove the gear was put away right. Early access.",
  openGraph: {
    type: "website",
    siteName: "SYNNR",
    title: "SYNNR | Tell it the job. It tells you what to take.",
    description:
      "For oilfield service companies. What the job takes, photo proof of the critical pieces, READY or NOT READY before the truck rolls, and proof the gear was put away right. Early access.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SYNNR | Tell it the job. It tells you what to take.",
    description:
      "For oilfield service companies. What the job takes, photo proof of the critical pieces, READY or NOT READY before the truck rolls, and proof the gear was put away right. Early access.",
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
                "Software for oilfield service companies. Tell it the job and it gives the crew what to take, a checklist to load by with photo proof, and a ready check before the truck rolls.",
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
