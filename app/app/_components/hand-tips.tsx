import { ScanLine, PackageCheck, OctagonX } from "lucide-react";
import { Card } from "@/components/ui/card";

/** A hand's first look: the whole job in three lines. Gone after their first load-out. */
export default function HandTips({ name, company }: { name: string; company: string }) {
  const steps = [
    { icon: ScanLine, title: "Loading a truck", body: "Tap Start load-out on the truck, pick the job's package, then scan each piece as it goes on: tap its tag or scan its QR code. Hit Done loading." },
    { icon: OctagonX, title: "Red means don't load it", body: "Out of test, red-tagged, or not on the list gets called out right then. Anything missing or bad makes the truck NOT READY. Only a manager can roll it anyway." },
    { icon: PackageCheck, title: "Back from a job", body: "Tap Check in on the truck and scan what came back: back on the truck, or into the yard at a rack." },
  ];
  return (
    <Card className="flex flex-col gap-3 border-bone/40 p-5">
      <div>
        <h2 className="text-lg font-semibold">Welcome to {company}, {name.split(" ")[0]}</h2>
        <p className="mt-0.5 text-sm text-ink-dim">Everything you scan has your name on it. Here&apos;s the whole job:</p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bone/10 text-bone"><s.icon className="h-5 w-5" /></span>
            <div><div className="font-semibold">{s.title}</div><p className="text-sm text-ink-dim">{s.body}</p></div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
