"use client";

import { useActionState } from "react";
import { inviteMember } from "./actions";

const initial: { ok?: true; error?: string } = {};

export default function InviteForm() {
  const [state, action, pending] = useActionState(
    async (_prev: typeof initial, fd: FormData) => inviteMember(fd),
    initial
  );

  return (
    <form action={action} className="invite-form">
      <input name="email" type="email" placeholder="hand@company.com" aria-label="Invite email" required />
      <select name="role" aria-label="Role" defaultValue="member">
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Sending…" : "Invite"}</button>
      {state.error ? <span className="wl-err">{state.error}</span> : null}
      {state.ok ? <span className="wl-done">Invite created.</span> : null}
    </form>
  );
}
