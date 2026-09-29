"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Image as ImageIcon, Check, X, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractExpirationDate } from "@/lib/ocr-date";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { COMPLIANCE_KINDS } from "@/lib/saas/taxonomy";
import { addComplianceItem } from "@/app/app/units/[unitId]/actions";

/**
 * Clearing a cert takes paper. A photo of the new cert goes to the server,
 * which reads it and checks the date, the name or serial, and the kind of
 * cert (lib/saas/cert-verify.ts). A clean match goes green. Anything else
 * waits on a manager and the item stays red. Nobody types a new date to make
 * a truck green, and there's no button that does it.
 */

interface CheckRow { key: string; label: string; ok: boolean; detail: string }
interface Outcome {
  ok: boolean;
  outcome: "applied" | "waiting" | "rejected";
  message: string;
  canForce?: boolean;
  canApprove?: boolean;
  checks?: CheckRow[];
  uploadId?: string;
}

const fld = "h-11 w-full rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";
const primary = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-bone px-4 text-sm font-semibold text-coal hover:bg-bone-soft disabled:cursor-default disabled:opacity-50";
const secondary = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-2 px-4 text-sm font-medium text-ink hover:bg-elevated disabled:opacity-50";

const NETWORK_FAIL: Outcome = { ok: false, outcome: "rejected", message: "That didn't go through. Check your signal and try again." };

/** Photo + date state shared by renewing and adding. */
function useCertPhoto() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [expiration, setExpiration] = useState("");
  const [reading, setReading] = useState(false);
  const [readHint, setReadHint] = useState<"read" | "none" | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(raw: File | undefined) {
    setErr("");
    if (!raw) return;
    if (!raw.type.startsWith("image/")) { setErr("That isn't a photo. Take a picture of the cert."); return; }
    const small = await shrinkPhoto(raw);
    if (small.size > 4 * 1024 * 1024) { setErr("That photo is too big to send. Take it again with the camera."); return; }
    setFile(small);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(small); });
    setReadHint(null);
    setReading(true);
    const read = await extractExpirationDate(small);
    setReading(false);
    if (read) { setExpiration(read); setReadHint("read"); }
    else setReadHint("none");
  }

  function reset() {
    setFile(null);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
    setExpiration(""); setReadHint(null); setErr(""); setReading(false);
  }
  return { file, preview, expiration, setExpiration, reading, readHint, setReadHint, err, setErr, pick, reset };
}

function PhotoButtons({ photo, label }: { photo: ReturnType<typeof useCertPhoto>; label: string }) {
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => { void photo.pick(e.target.files?.[0]); e.target.value = ""; };
  return (
    <div className="flex flex-col gap-2">
      {photo.preview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt="The photo you picked" className="h-20 w-20 shrink-0 rounded-lg border border-line-2 object-cover" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm text-ink">Photo ready</span>
            <button type="button" onClick={() => cam.current?.click()} className="w-fit cursor-pointer text-sm text-ink-dim underline underline-offset-2 hover:text-ink">Retake</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => cam.current?.click()} className={cn(primary, "min-h-12")}>
            <Camera className="h-5 w-5" /> {label}
          </button>
          <button type="button" onClick={() => lib.current?.click()} className={cn(secondary, "min-h-12")}>
            <ImageIcon className="h-5 w-5" /> Choose a photo
          </button>
        </div>
      )}
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={onChange} />
      <input ref={lib} type="file" accept="image/*" hidden onChange={onChange} />
    </div>
  );
}

function ExpirationInput({ photo }: { photo: ReturnType<typeof useCertPhoto> }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
      Expiration date printed on the cert
      <input
        type="date"
        required
        value={photo.expiration}
        onChange={(e) => { photo.setExpiration(e.target.value); photo.setReadHint(null); }}
        className={cn(fld, photo.readHint === "read" && "border-amber-500/60")}
      />
      {photo.reading ? <span className="text-xs text-ink-faint">Reading the date off the photo…</span>
        : photo.readHint === "read" ? <span className="text-xs text-amber-400">Read off the photo. Make sure it matches the paper.</span>
        : photo.readHint === "none" ? <span className="text-xs text-ink-faint">Couldn&apos;t pick a date off the photo. Type it in from the paper.</span>
        : null}
    </label>
  );
}

function Result({ r, onRetake, onForce, onApprove, onDone, busy, canRetake = true }: {
  r: Outcome; busy: boolean; canRetake?: boolean;
  onRetake: () => void; onForce: () => void; onApprove: () => void; onDone: () => void;
}) {
  const tone = r.outcome === "applied" ? "border-emerald-500/40 bg-emerald-500/10" : r.outcome === "waiting" ? "border-amber-500/40 bg-amber-500/10" : "border-red-500/40 bg-red-500/10";
  const head = r.outcome === "applied" ? "text-emerald-400" : r.outcome === "waiting" ? "text-amber-400" : "text-red-400";
  const title = r.outcome === "applied" ? "Saved" : r.outcome === "waiting" ? (r.canApprove ? "Needs your OK" : "Waiting on a manager") : "Not saved";
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-3", tone)} role="status">
      <div>
        <div className={cn("text-sm font-semibold", head)}>{title}</div>
        <p className="mt-0.5 text-sm text-ink">{r.message}</p>
      </div>
      {r.checks && r.checks.length > 0 && r.outcome !== "applied" && (
        <ul className="flex flex-col gap-1 text-sm">
          {r.checks.map((c) => (
            <li key={c.key} className="flex gap-2">
              {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
              <span className={c.ok ? "text-ink-dim" : "text-ink"}>{c.detail}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {r.outcome === "waiting" && r.canApprove && (
          <button type="button" disabled={busy} onClick={onApprove} className={primary}>
            <Check className="h-4 w-4" /> {busy ? "Saving…" : "I checked it. Approve"}
          </button>
        )}
        {r.outcome === "rejected" && r.canForce && (
          <button type="button" disabled={busy} onClick={onForce} className={secondary}>
            {busy ? "Sending…" : "Send it to a manager anyway"}
          </button>
        )}
        {r.outcome !== "applied" && canRetake && (
          <button type="button" onClick={onRetake} className={r.outcome === "rejected" ? primary : secondary}>
            <Camera className="h-4 w-4" /> Retake
          </button>
        )}
        <button type="button" onClick={onDone} className={secondary}>Done</button>
      </div>
    </div>
  );
}

async function post(fd: FormData): Promise<Outcome> {
  try {
    const res = await fetch("/api/saas/certs/upload", { method: "POST", body: fd });
    return (await res.json()) as Outcome;
  } catch {
    return NETWORK_FAIL;
  }
}

async function approve(uploadId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/saas/certs/review", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ upload_id: uploadId, action: "approve" }),
    });
    return await res.json();
  } catch {
    return { ok: false, message: NETWORK_FAIL.message };
  }
}

/** On an existing item: "Upload new cert". */
export function UploadCert({ itemId, isManager, allowOnTheWay, failing }: {
  itemId: string; isManager: boolean; allowOnTheWay: boolean; failing: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={cn(failing ? primary : secondary, "min-h-10 px-3.5 text-[13px]")}>
        <Upload className="h-4 w-4" /> Upload new cert
      </button>
    );
  }
  return (
    <div className="order-last mt-1 w-full rounded-lg border border-line-2 bg-coal p-3">
      <UploadCertPanel itemId={itemId} isManager={isManager} allowOnTheWay={allowOnTheWay} onClose={() => setOpen(false)} />
    </div>
  );
}

/** The upload itself: photo, date, check, result. Also the quick screen's renew step. */
export function UploadCertPanel({ itemId, isManager, allowOnTheWay, onClose, big = false }: {
  itemId: string; isManager: boolean; allowOnTheWay: boolean; onClose: () => void; big?: boolean;
}) {
  const router = useRouter();
  const photo = useCertPhoto();
  const [evidence, setEvidence] = useState<"cert" | "temporary">("cert");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);

  function close() { setResult(null); setEvidence("cert"); photo.reset(); onClose(); }

  async function send(force = false) {
    if (!photo.file) { photo.setErr("Take a photo of the paper first."); return; }
    if (evidence === "cert" && !photo.expiration) { photo.setErr("Enter the expiration date printed on the cert."); return; }
    const fd = new FormData();
    fd.set("item_id", itemId);
    fd.set("photo", photo.file);
    fd.set("evidence", evidence);
    if (evidence === "cert") fd.set("expiration", photo.expiration);
    if (force) fd.set("force", "1");
    setBusy(true);
    const r = await post(fd);
    setBusy(false);
    setResult(r);
    if (r.ok) router.refresh();
  }

  async function approveIt() {
    if (!result?.uploadId) return;
    setBusy(true);
    const r = await approve(result.uploadId);
    setBusy(false);
    setResult(r.ok ? { ok: true, outcome: "applied", message: r.message } : { ...result, message: r.message });
    if (r.ok) router.refresh();
  }

  if (result) {
    return (
      <Result r={result} busy={busy}
        onRetake={() => { setResult(null); photo.reset(); }}
        onForce={() => void send(true)}
        onApprove={() => void approveIt()}
        onDone={close} />
    );
  }
  return (
    <div className={cn("flex flex-col", big ? "gap-4" : "gap-3")}>
      {allowOnTheWay && (
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line-2 p-1 text-sm" role="radiogroup" aria-label="What are you uploading?">
          {([["cert", "The new cert"], ["temporary", "Retested, cert not here yet"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={evidence === v} onClick={() => setEvidence(v)}
              className={cn("cursor-pointer rounded-md px-2 text-center leading-tight", big ? "min-h-12" : "min-h-10", evidence === v ? "bg-elevated font-medium text-ink" : "text-ink-dim hover:text-ink")}>
              {l}
            </button>
          ))}
        </div>
      )}
      <PhotoButtons photo={photo} label={evidence === "cert" ? "Take a photo of the cert" : "Take a photo of the tag or invoice"} />
      {evidence === "cert" ? (
        photo.file ? <ExpirationInput photo={photo} /> : null
      ) : (
        <p className="text-sm text-ink-dim">
          Upload the retest invoice or a photo of the new tag. It shows yellow, &quot;cert on the way&quot;, for 7 days, then goes red again unless the real cert is uploaded.
          {isManager ? "" : " A manager has to OK it first."}
        </p>
      )}
      {photo.err ? <p className="text-sm text-red-400">{photo.err}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !photo.file} onClick={() => void send()} className={cn(primary, big && "min-h-14 w-full text-base")}>
          {busy ? "Checking the photo…" : "Check it and save"}
        </button>
        {!big && <button type="button" onClick={close} className={secondary}>Cancel</button>}
      </div>
      {busy ? <p className="text-xs text-ink-faint">Reading the paper. This takes a few seconds.</p> : null}
    </div>
  );
}

/** "Add a cert": from its photo, or (managers) typed in, or tracked with no date yet. */
export function AddCert({ parentType, parentId, redirectPath, isManager, defaultKind = "cert", placeholder, heading, bare = false }: {
  parentType: "unit" | "asset" | "crew"; parentId: string; redirectPath: string; isManager: boolean;
  defaultKind?: string; placeholder: string; heading: string;
  /** No card around it (the quick screen draws its own). */
  bare?: boolean;
}) {
  const router = useRouter();
  const photo = useCertPhoto();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState(defaultKind);
  const [mode, setMode] = useState<"photo" | "typed">("photo");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);

  function clear() { setResult(null); setTitle(""); photo.reset(); }

  async function send(force = false) {
    if (!title.trim()) { photo.setErr("Name the cert first (for example, H2S Clear)."); return; }
    if (!photo.file) { photo.setErr("Take a photo of the cert first."); return; }
    if (!photo.expiration) { photo.setErr("Enter the expiration date printed on the cert."); return; }
    const fd = new FormData();
    fd.set("parent_type", parentType); fd.set("parent_id", parentId);
    fd.set("title", title.trim()); fd.set("kind", kind);
    fd.set("photo", photo.file); fd.set("evidence", "cert"); fd.set("expiration", photo.expiration);
    if (force) fd.set("force", "1");
    setBusy(true);
    const r = await post(fd);
    setBusy(false);
    setResult(r);
    if (r.ok) router.refresh();
  }

  async function approveIt() {
    if (!result?.uploadId) return;
    setBusy(true);
    const r = await approve(result.uploadId);
    setBusy(false);
    setResult(r.ok ? { ok: true, outcome: "applied", message: r.message } : { ...result, message: r.message });
    if (r.ok) router.refresh();
  }

  return (
    <div className={cn("flex flex-col gap-3", !bare && "rounded-2xl border border-line bg-surface p-4 sm:p-5")}>
      {heading ? <h3 className="text-sm font-medium text-ink">{heading}</h3> : null}
      {result ? (
        <Result r={result} busy={busy}
          onRetake={() => { setResult(null); photo.reset(); }}
          onForce={() => void send(true)}
          onApprove={() => void approveIt()}
          onDone={clear} />
      ) : mode === "photo" ? (
        <>
          <div className="flex flex-col gap-3 lg:flex-row">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} aria-label="Name of the cert" className={cn(fld, "min-w-0 lg:flex-1")} />
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind" className={cn(fld, "lg:w-48")}>
              {COMPLIANCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <PhotoButtons photo={photo} label="Take a photo of the cert" />
          {photo.file ? <ExpirationInput photo={photo} /> : null}
          {photo.err ? <p className="text-sm text-red-400">{photo.err}</p> : null}
          <button type="button" disabled={busy || !photo.file} onClick={() => void send()} className={cn(primary, "w-full sm:w-fit")}>
            {busy ? "Checking the photo…" : "Check it and add"}
          </button>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button type="button" onClick={() => setMode("typed")} className="cursor-pointer text-ink-dim underline underline-offset-2 hover:text-ink">
              {isManager ? "No photo? Type the dates in" : "No photo yet? Add it with no date"}
            </button>
          </div>
        </>
      ) : (
        <form action={async (fd) => { await addComplianceItem(fd); setMode("photo"); clear(); router.refresh(); }} className="flex flex-col gap-3">
          <input type="hidden" name="parent_type" value={parentType} />
          <input type="hidden" name="parent_id" value={parentId} />
          <input type="hidden" name="redirect_path" value={redirectPath} />
          <div className="flex flex-col gap-3 lg:flex-row">
            <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} aria-label="Name of the cert" className={cn(fld, "min-w-0 lg:flex-1")} />
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind" className={cn(fld, "lg:w-48")}>
              {COMPLIANCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          {isManager ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Issued<input name="issued_date" type="date" className={fld} /></label>
                <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Expires<input name="expiration_date" type="date" className={fld} /></label>
              </div>
              <p className="text-xs text-ink-faint">Typed-in dates are for setting up from the binder. They show as &quot;no photo on file&quot; until someone uploads the cert.</p>
            </>
          ) : (
            <p className="text-xs text-ink-faint">It shows red, &quot;no expiration on file&quot;, until someone uploads a photo of the cert.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primary}>Add it</button>
            <button type="button" onClick={() => setMode("photo")} className={secondary}>Back to the photo</button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * A photo a hand sent through their update link, applied by a manager: pick
 * which card it is, confirm the date, and it runs the same checks as any
 * upload. A hand's link never changes a record by itself.
 */
export function UseSentPhoto({ docRequestId, cards, suggestedExpiration }: {
  docRequestId: string; cards: { id: string; title: string }[]; suggestedExpiration: string | null;
}) {
  const router = useRouter();
  const [itemId, setItemId] = useState(cards.length === 1 ? cards[0].id : "");
  const [expiration, setExpiration] = useState(suggestedExpiration ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<Outcome | null>(null);

  async function send() {
    setErr("");
    if (!itemId) { setErr("Pick which card this is."); return; }
    if (!expiration) { setErr("Enter the expiration date printed on the card."); return; }
    const fd = new FormData();
    fd.set("item_id", itemId); fd.set("doc_request_id", docRequestId);
    fd.set("evidence", "cert"); fd.set("expiration", expiration);
    setBusy(true);
    const r = await post(fd);
    setBusy(false);
    setResult(r);
    if (r.ok) router.refresh();
  }

  async function approveIt() {
    if (!result?.uploadId) return;
    setBusy(true);
    const r = await approve(result.uploadId);
    setBusy(false);
    setResult(r.ok ? { ok: true, outcome: "applied", message: r.message } : { ...result, message: r.message });
    if (r.ok) router.refresh();
  }

  if (result) {
    return <Result r={result} busy={busy} canRetake={false} onRetake={() => setResult(null)} onForce={() => {}} onApprove={() => void approveIt()} onDone={() => { setResult(null); router.refresh(); }} />;
  }
  if (cards.length === 0) {
    return <p className="text-sm text-ink-dim">Add the card below first, then come back and use this photo for it.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          Which card is it?
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={fld}>
            <option value="" disabled>Pick one…</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          Expiration printed on it
          <input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} className={fld} />
        </label>
      </div>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <button type="button" disabled={busy} onClick={() => void send()} className={cn(primary, "w-full sm:w-fit")}>
        {busy ? "Checking the photo…" : "Check it and use it"}
      </button>
    </div>
  );
}
