"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { saveName, savePassword, saveCompanyName } from "./actions";

const field = "h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone";

function Note({ r }: { r: { ok: boolean; message: string } | null }) {
  if (!r) return null;
  return <p role="status" className={r.ok ? "text-sm text-emerald-400" : "text-sm text-red-400"}>{r.message}</p>;
}

export default function AccountForms({ name, email, companyName, canRename, emailBy }: { name: string; email: string; companyName: string; canRename: boolean; emailBy?: "manager" | "owner" | null }) {
  const [nameR, nameAction, namePending] = useActionState(saveName, null);
  const [passR, passAction, passPending] = useActionState(savePassword, null);
  const [coR, coAction, coPending] = useActionState(saveCompanyName, null);
  const [show, setShow] = useState(false);
  return (
    <>
      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="font-semibold">Your name</h2>
          <p className="text-sm text-ink-dim">It goes on every load-out, check-in, sign-out, and override you make.</p>
        </div>
        <form action={nameAction} className="flex flex-col gap-2 sm:flex-row">
          <input name="full_name" defaultValue={name} required minLength={2} maxLength={80} autoComplete="name" aria-label="Your name" className={field} />
          <button type="submit" disabled={namePending} className={buttonClass("default", "lg", "h-12 shrink-0")}>{namePending ? "Saving…" : "Save"}</button>
        </form>
        <Note r={nameR} />
        <p className="text-[13px] text-ink-faint">You log in with {email}. To change that email, {emailBy === "manager" ? "ask a manager. They can fix it under Settings, Team." : emailBy === "owner" ? "ask the account owner. They can fix it under Settings, Team." : "ask Caden at cadencain@synnr.io."}</p>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-semibold">Password</h2>
        <form action={passAction} className="flex flex-col gap-2">
          <input name="password" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="New password, at least 8 characters" aria-label="New password" className={field} />
          <label className="flex items-center gap-2 text-sm text-ink-dim">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-5 w-5 accent-bone" /> Show password
          </label>
          <button type="submit" disabled={passPending} className={buttonClass("outline", "lg", "h-12 self-start")}>{passPending ? "Saving…" : "Change password"}</button>
        </form>
        <Note r={passR} />
      </Card>

      {canRename ? (
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-semibold">Company name</h2>
            <p className="text-sm text-ink-dim">It shows on every proof link and email the operator sees.</p>
          </div>
          <form action={coAction} className="flex flex-col gap-2 sm:flex-row">
            <input name="company_name" defaultValue={companyName} required minLength={2} maxLength={120} autoComplete="organization" aria-label="Company name" className={field} />
            <button type="submit" disabled={coPending} className={buttonClass("default", "lg", "h-12 shrink-0")}>{coPending ? "Saving…" : "Save"}</button>
          </form>
          <Note r={coR} />
        </Card>
      ) : null}
    </>
  );
}
