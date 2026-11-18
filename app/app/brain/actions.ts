"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { requireCompany, requireWritableCompany, type ActiveCompany } from "@/lib/saas/auth";
import { saasAdmin, saasDb } from "@/lib/saas/db";
import { chunkPages, fileKind, isDocKind, titleFromFile, tidy, MAX_FILE_BYTES, MAX_NOTE_CHARS, type DocKind, type Piece } from "@/lib/saas/brain";
import { readBytes } from "@/lib/saas/brain-read";

/**
 * Putting a shop's documents into the brain, and taking them out. A manager
 * does it; the crew asks. Every write goes through the server (the database
 * lets nobody else write a document or a passage), and a passage only ever
 * comes from a file the server read itself or a note a manager typed.
 */

const BUCKET = "brain";
/** The most documents one company keeps. Far more than a shop has; it stops a runaway script. */
const MAX_DOCS = 1000;

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const nameOf = (u: User) => (u.user_metadata?.full_name as string | undefined)?.trim() || u.email?.split("@")[0] || "Someone";
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const UNSET = "Documents aren't set up. Call or text 432-250-0715.";

/** Who may change what's in the brain: a manager, on a paid-up account that isn't the demo. */
async function manager(): Promise<{ ok: true; user: User; company: ActiveCompany } | Fail> {
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  if (got.company.role === "member") return fail("Only a manager can change what's in the brain.");
  // The demo is open to anyone, and its documents are samples.
  if (got.company.is_demo) return fail("The demo's documents are samples. In your own company, you load your own.");
  return got;
}

function refresh(docId?: string) {
  revalidatePath("/app/brain");
  revalidatePath("/app");
  if (docId) revalidatePath(`/app/brain/docs/${docId}`);
}

/**
 * Start loading a file: make its row, and hand back a one-time way to send
 * the file straight to storage (a document can be bigger than a form can
 * carry). The file is read once it has landed: see readDoc.
 */
export async function startUpload(input: { name: string; size: number; kind: string; managersOnly: boolean }): Promise<{ ok: true; docId: string; path: string; token: string; mime: string } | Fail> {
  const got = await manager();
  if (!got.ok) return got;
  const name = clip(input.name, 200);
  const kind = fileKind(name);
  if (!kind.ok) return fail(kind.problem);
  const size = Math.trunc(Number(input.size));
  if (!(size > 0)) return fail("That file is empty.");
  if (size > MAX_FILE_BYTES) return fail("That file is over 25 MB. Split it, or load the part that matters.");
  const admin = saasAdmin();
  if (!admin) return fail(UNSET);
  const { count } = await admin.from("synnr_docs").select("id", { count: "exact", head: true }).eq("company_id", got.company.id);
  if ((count ?? 0) >= MAX_DOCS) return fail(`The brain holds ${MAX_DOCS} documents. Take one out to add another.`);

  const { data: doc, error } = await admin.from("synnr_docs").insert({
    company_id: got.company.id, title: titleFromFile(name), kind: isDocKind(input.kind) ? input.kind : "other", origin: "file",
    file_name: name, mime: kind.mime, bytes: size, status: "reading", managers_only: Boolean(input.managersOnly),
    added_by: got.user.id, added_by_name: nameOf(got.user),
  }).select("id").single();
  if (error || !doc) { console.error("[brain] start:", error?.message); return fail("Couldn't start that one. Try again."); }
  const docId = (doc as { id: string }).id;
  // The file keeps its own ending and nothing else of its name: a name can hold anything.
  const path = `${got.company.id}/docs/${docId}/file.${name.split(".").pop()!.toLowerCase()}`;
  const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signErr || !signed) {
    console.error("[brain] sign:", signErr?.message);
    await admin.from("synnr_docs").delete().eq("id", docId);
    return fail("Couldn't start that one. Try again.");
  }
  await admin.from("synnr_docs").update({ file_path: path }).eq("id", docId);
  refresh();
  return { ok: true, docId, path, token: signed.token, mime: kind.mime };
}

/** Save a document's passages and mark it ready. */
async function keep(admin: NonNullable<ReturnType<typeof saasAdmin>>, doc: { id: string; company: string; title: string }, pieces: Piece[], extra: { pages?: number | null; chars: number }): Promise<string | null> {
  const docId = doc.id;
  await admin.from("synnr_doc_chunks").delete().eq("doc_id", docId);
  for (let i = 0; i < pieces.length; i += 200) {
    const { error } = await admin.from("synnr_doc_chunks").insert(pieces.slice(i, i + 200).map((p) => ({
      // The company and the name are the document's own: the database sets them from it, whatever is sent here.
      doc_id: docId, company_id: doc.company, doc_title: doc.title, idx: p.idx, section: p.section, page: p.page, body: p.body,
    })));
    if (error) { console.error("[brain] passages:", error.message); return "The document was read but didn't save. Load it again."; }
  }
  const { error } = await admin.from("synnr_docs").update({ status: "ready", problem: null, chars: extra.chars, pages: extra.pages ?? null }).eq("id", docId);
  return error ? "The document was read but didn't save. Load it again." : null;
}

/** The file has landed: read it, cut it into passages, and say how it went. A file that can't be read stays listed, with the reason. */
export async function readDoc(docId: string): Promise<{ ok: true; status: "ready" | "failed"; problem: string | null; passages: number } | Fail> {
  if (!isId(docId)) return fail("That document isn't there anymore.");
  const got = await manager();
  if (!got.ok) return got;
  const admin = saasAdmin();
  if (!admin) return fail(UNSET);
  const { data } = await admin.from("synnr_docs").select("id, title, file_path, file_name, origin").eq("id", docId).eq("company_id", got.company.id).maybeSingle();
  const doc = data as { id: string; title: string; file_path: string | null; file_name: string | null; origin: string } | null;
  if (!doc || doc.origin !== "file" || !doc.file_path) return fail("That document isn't there anymore.");
  const kind = fileKind(doc.file_name ?? "");
  const problem = async (why: string) => {
    await admin.from("synnr_docs").update({ status: "failed", problem: why.slice(0, 300) }).eq("id", docId);
    refresh(docId);
    return { ok: true as const, status: "failed" as const, problem: why, passages: 0 };
  };
  if (!kind.ok) return problem(kind.problem);

  const { data: blob, error } = await admin.storage.from(BUCKET).download(doc.file_path);
  if (error || !blob) return problem("The file didn't finish uploading. Take it out and load it again.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length > MAX_FILE_BYTES) return problem("That file is over 25 MB. Split it, or load the part that matters.");
  const read = await readBytes(bytes, kind.ext);
  if (!read.ok) return problem(read.problem);
  const pieces = chunkPages(read.pages, read.paged);
  if (!pieces.length) return problem("There was nothing in that file to read.");
  const bad = await keep(admin, { id: docId, company: got.company.id, title: doc.title }, pieces, { pages: read.paged ? read.pages.length : null, chars: read.pages.reduce((n, p) => n + p.length, 0) });
  if (bad) return problem(bad);
  refresh(docId);
  return { ok: true, status: "ready", problem: null, passages: pieces.length };
}

/** Something nobody wrote down, typed or pasted in. */
export async function addNote(input: { title: string; text: string; kind: string; managersOnly: boolean }): Promise<{ ok: true; docId: string } | Fail> {
  const got = await manager();
  if (!got.ok) return got;
  const title = clip(input.title, 160);
  if (!title) return fail("Give it a name, so an answer can say where it came from.");
  const text = tidy(String(input.text ?? ""));
  if (text.length < 20) return fail("Write a little more than that.");
  if (text.length > MAX_NOTE_CHARS) return fail("That's too long for one note. Split it in two.");
  const admin = saasAdmin();
  if (!admin) return fail(UNSET);
  const { count } = await admin.from("synnr_docs").select("id", { count: "exact", head: true }).eq("company_id", got.company.id);
  if ((count ?? 0) >= MAX_DOCS) return fail(`The brain holds ${MAX_DOCS} documents. Take one out to add another.`);
  const kind: DocKind = isDocKind(input.kind) ? input.kind : "note";
  const { data: doc, error } = await admin.from("synnr_docs").insert({
    company_id: got.company.id, title, kind, origin: "note", status: "reading", managers_only: Boolean(input.managersOnly),
    added_by: got.user.id, added_by_name: nameOf(got.user),
  }).select("id").single();
  if (error || !doc) { console.error("[brain] note:", error?.message); return fail("Couldn't save it. Try again."); }
  const docId = (doc as { id: string }).id;
  const bad = await keep(admin, { id: docId, company: got.company.id, title }, chunkPages([text], false), { chars: text.length });
  if (bad) { await admin.from("synnr_docs").delete().eq("id", docId); return fail("Couldn't save it. Try again."); }
  refresh(docId);
  return { ok: true, docId };
}

/** Rename a document, say what kind it is, or make it managers only. Its passages follow in the same step. */
export async function updateDoc(docId: string, input: { title?: string; kind?: string; managersOnly?: boolean }): Promise<{ ok: true } | Fail> {
  if (!isId(docId)) return fail("That document isn't there anymore.");
  const got = await manager();
  if (!got.ok) return got;
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) { const t = clip(input.title, 160); if (!t) return fail("It needs a name."); patch.title = t; }
  if (input.kind !== undefined) { if (!isDocKind(input.kind)) return fail("Pick what kind of document it is."); patch.kind = input.kind; }
  if (input.managersOnly !== undefined) patch.managers_only = Boolean(input.managersOnly);
  if (!Object.keys(patch).length) return { ok: true };
  const admin = saasAdmin();
  if (!admin) return fail(UNSET);
  const { data, error } = await admin.from("synnr_docs").update(patch).eq("id", docId).eq("company_id", got.company.id).select("id").maybeSingle();
  if (error || !data) return fail("That didn't save. Try again.");
  refresh(docId);
  return { ok: true };
}

/** Take a document out. Its passages and its file go with it, and nothing is answered from it again. */
export async function removeDoc(docId: string): Promise<{ ok: true } | Fail> {
  if (!isId(docId)) return fail("That document isn't there anymore.");
  // Works on a paused account too: taking your own documents out is never something to pay for.
  const got = await requireCompany();
  if (got.company.role === "member") return fail("Only a manager can take a document out.");
  if (got.company.is_demo) return fail("The demo's documents are samples. In your own company, you load your own.");
  const admin = saasAdmin();
  if (!admin) return fail(UNSET);
  const { data, error } = await admin.from("synnr_docs").delete().eq("id", docId).eq("company_id", got.company.id).select("file_path").maybeSingle();
  if (error || !data) return fail("Couldn't take it out. Try again.");
  const path = (data as { file_path: string | null }).file_path;
  if (path) await admin.storage.from(BUCKET).remove([path]).then(() => {}, () => {});
  refresh();
  return { ok: true };
}

/** A short-lived link to the file as it was loaded. Only for someone the database says can see the document. */
export async function docFileUrl(docId: string): Promise<{ ok: true; url: string } | Fail> {
  if (!isId(docId)) return fail("That document isn't there anymore.");
  const { company } = await requireCompany();
  const db = await saasDb();
  const { data } = await db.from("synnr_docs").select("file_path, file_name").eq("id", docId).eq("company_id", company.id).maybeSingle();
  const doc = data as { file_path: string | null; file_name: string | null } | null;
  if (!doc?.file_path) return fail("There's no file for that one.");
  const admin = saasAdmin();
  if (!admin) return fail(UNSET);
  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(doc.file_path, 120, { download: doc.file_name ?? true });
  return signed?.signedUrl ? { ok: true, url: signed.signedUrl } : fail("Couldn't open the file. Try again.");
}
