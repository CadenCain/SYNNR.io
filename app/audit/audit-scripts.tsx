"use client";

import { useEffect } from "react";

/**
 * Audit-detail state machine, ported from the prototype's inline script:
 * each finding can be approved -> re-billed -> recovered, or dismissed;
 * blockers can be resolved. The Found/In-billing/Recovered pipeline and the
 * footer summary recompute live. State persists to localStorage.
 */
export default function AuditScripts() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".audit");
    if (!root) return;

    const KEY = "synnr_audit_4821";
    let state: Record<string, string> = {};
    try {
      state = JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      state = {};
    }
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".finding"));
    const save = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    };
    const money = (n: number) => "$" + Math.round(n).toLocaleString();

    const actionsFor = (card: HTMLElement) => {
      const id = card.getAttribute("data-id")!;
      const st = state[id] || "open";
      const blk = card.getAttribute("data-blocker");
      const box = card.querySelector<HTMLElement>("[data-actions]")!;
      card.classList.remove("done", "dismissed");
      if (blk) {
        if (st === "resolved") {
          card.classList.add("done");
          box.innerHTML =
            '<span class="fstate resolved"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>' +
            (blk === "backup" ? "Backup attached" : "Signed by customer") +
            "</span>";
          return;
        }
        box.innerHTML =
          '<button class="bmini solid" data-act="resolve"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          (blk === "backup"
            ? '<path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 16v4h16v-4"/>'
            : '<path d="M4 17h16M6 12l3-9 3 9"/>') +
          "</svg>" +
          (blk === "backup" ? "Request photos from crew" : "Send for signature") +
          '</button><button class="bmini ghosty" data-act="dismiss">Dismiss</button>';
      } else if (st === "approved") {
        card.classList.add("done");
        box.innerHTML =
          '<span class="fstate billing"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H4zM4 9h16"/></svg>Re-billed · awaiting payment</span><button class="bmini solid" data-act="recover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Mark recovered</button>';
      } else if (st === "recovered") {
        card.classList.add("done");
        box.innerHTML =
          '<span class="fstate recovered"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Recovered · collected</span>';
      } else if (st === "dismissed") {
        card.classList.add("dismissed");
        box.innerHTML = '<span class="fstate dismissed">Dismissed</span>';
      } else {
        box.innerHTML =
          '<button class="bmini solid" data-act="approve"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H4zM4 9h16"/></svg>Approve &amp; send to billing</button><button class="bmini ghosty" data-act="dismiss">Dismiss</button>';
      }
      box.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((b) => {
        b.addEventListener("click", () => {
          const a = b.getAttribute("data-act");
          state[id] =
            a === "approve" ? "approved" :
            a === "recover" ? "recovered" :
            a === "resolve" ? "resolved" :
            a === "dismiss" ? "dismissed" : "open";
          save();
          actionsFor(card);
          recompute();
        });
      });
    };

    const recompute = () => {
      let billing = 0, recovered = 0, foundLive = 0;
      cards.forEach((card) => {
        const id = card.getAttribute("data-id")!;
        const amt = +(card.getAttribute("data-amt") || 0);
        const st = state[id] || "open";
        if (amt) {
          if (st !== "dismissed") foundLive += amt;
          if (st === "approved") billing += amt;
          if (st === "recovered") recovered += amt;
        }
      });
      const set = (id: string, v: string) => {
        const el = root.querySelector<HTMLElement>("#" + id);
        if (el) el.textContent = v;
      };
      set("vFound", money(foundLive));
      set("vBilling", money(billing + recovered));
      set("vRecovered", money(recovered));
      const openTotal = cards.filter((c) => (state[c.getAttribute("data-id")!] || "open") === "open").length;
      set("openCount", openTotal + " open");
      set("barSub", money(recovered) + " of " + money(foundLive) + " recovered · " + openTotal + " to review");
      set(
        "barTitle",
        recovered > 0 && recovered >= foundLive
          ? "Fully recovered — every dollar collected"
          : recovered > 0
          ? "Recovering — keep going"
          : "Review each finding to recover this job"
      );
    };

    cards.forEach(actionsFor);
    recompute();
  }, []);

  return null;
}
