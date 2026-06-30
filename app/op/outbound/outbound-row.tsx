"use client";

import { useState } from "react";

/**
 * One pending-alert row. Client component so the "Copy" button can use the
 * Clipboard API and we can give the operator instant feedback that the text
 * is in their clipboard — they paste it into Messages on their phone.
 *
 * Server actions are passed in as props (Next 16 supports this) so the row
 * stays a tight client component without re-importing the actions.
 */
export default function OutboundRow({
  id,
  shopId,
  due_at,
  to_phone,
  message,
  markSent,
  dismiss,
}: {
  id: string;
  shopId: string;
  due_at: string | null;
  to_phone: string | null;
  message: string;
  markSent: (fd: FormData) => Promise<void>;
  dismiss: (fd: FormData) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Older browsers / non-secure contexts — fall through silently. The
      // message is still visible in the row for manual selection.
    }
  }

  return (
    <tr>
      <td className="mono">{due_at ?? "—"}</td>
      <td className="mono">{to_phone ?? <span className="op-faint">no number</span>}</td>
      <td className="op-muted" style={{ maxWidth: 540 }}>{message}</td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <button className="op-btn op-btn-sm" type="button" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>{" "}
        <form action={markSent} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="shop_id" value={shopId} />
          <button className="op-btn op-btn-primary op-btn-sm" type="submit">Mark sent</button>
        </form>{" "}
        <form action={dismiss} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="shop_id" value={shopId} />
          <input type="hidden" name="reason" value="operator dismissed" />
          <button className="op-btn op-btn-ghost op-btn-sm" type="submit" title="Skip">✕</button>
        </form>
      </td>
    </tr>
  );
}
