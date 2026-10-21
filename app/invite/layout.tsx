import { ThemeSync } from "@/components/theme";

/** Joining a crew: same light or dark as the app. */
export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <><ThemeSync />{children}</>;
}
