import Link from "next/link";

// Centered auth shell for /login, /signup, /onboarding. Same dark zinc theme
// as the app. noindex.
export const metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="saas flex min-h-dvh flex-col bg-zinc-950 text-zinc-100 antialiased">
      <header className="flex items-center justify-center px-4 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden className="h-6 w-6">
            <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7" />
          </svg>
          <span className="font-semibold tracking-tight">SYNNR</span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
