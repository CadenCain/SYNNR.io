import Link from "next/link";
import { Upload, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

/**
 * The first thing a new shop sees after paying: they're in, their yards are
 * there, and the two things that make it useful (their iron, their crew) are
 * one tap away. Nothing to fill out before they can look around.
 */
export default function WelcomeCard({ justPaid, yards, manager }: { justPaid: boolean; yards: string[]; manager: boolean }) {
  return (
    <Card className="flex flex-col gap-3 border-bone/40 p-5">
      <div>
        <h2 className="text-lg font-semibold">{justPaid ? "You're in." : "Get your iron in"}</h2>
        <p className="mt-1 text-sm text-ink-dim">
          {yards.length ? `${yards.length === 1 ? "Your yard is" : `Your ${yards.length} yards are`} set up: ${yards.join(", ")}. ` : ""}
          Next, load your iron and bring your crew in. Look around first if you want; nothing here is required.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {manager ? <Link href="/app/import" className={buttonClass("default", "lg")}><Upload className="h-5 w-5" /> Upload your iron list</Link> : null}
        {manager ? <Link href="/app/settings/team" className={buttonClass("outline", "lg")}><UserPlus className="h-5 w-5" /> Invite your crew</Link> : null}
        <Link href="/app/welcome" className={buttonClass("ghost", "lg")}>Full setup checklist</Link>
      </div>
      <p className="text-sm text-ink-faint">
        Rather hand the list off? Email it in any format to cadencain@synnr.io, or call or text <a href={OWNER_PHONE_TEL} className="underline underline-offset-2">{OWNER_PHONE}</a>. Setup is free for the first 10 yards.
      </p>
    </Card>
  );
}
