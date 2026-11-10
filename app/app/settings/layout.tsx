/** Settings read like a document: one narrow column, room to breathe. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 md:px-8 md:py-14">{children}</div>;
}
