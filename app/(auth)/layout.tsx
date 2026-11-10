import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

// Centered shell for /login, /signup, and getting started (/onboarding).
// The app's dark look. noindex.
export const metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="saas flex min-h-dvh flex-col bg-coal text-ink antialiased">
      <header className="flex items-center justify-center px-4 py-8">
        <Link href="/" aria-label="SYNNR home"><Wordmark /></Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
