import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { saasDb } from "@/lib/saas/db";
import { kindLabel, MAX_CHUNKS, type Doc } from "@/lib/saas/brain";
import { fmtWhen } from "@/lib/saas/format";
import DocActions from "./doc-actions";

export const dynamic = "force-dynamic";

const DOC = "id, title, kind, origin, file_name, bytes, pages, status, problem, chars, managers_only, added_by_name, created_at";

async function load(id: string) {
  const { company } = await requireCompany();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await saasDb();
  // The database has the last word on whether this person can see it.
  const [{ data: doc }, { data: chunks }] = await Promise.all([
    db.from("synnr_docs").select(DOC).eq("id", id).eq("company_id", company.id).maybeSingle(),
    db.from("synnr_doc_chunks").select("idx, section, page, body").eq("doc_id", id).eq("company_id", company.id).order("idx").limit(MAX_CHUNKS),
  ]);
  if (!doc) return null;
  return { company, doc: doc as Doc, chunks: (chunks ?? []) as { idx: number; section: string | null; page: number | null; body: string }[] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const got = await load((await params).id);
  return { title: got ? got.doc.title : "Document" };
}

/**
 * One document, the way SYNNR read it: passage by passage, each with the
 * section and page it's from. An answer's "Open the document" lands on the
 * passage it came from. A manager can rename it, make it managers only, get
 * the file back, or take it out.
 */
export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const got = await load((await params).id);
  if (!got) notFound();
  const { company, doc, chunks } = got;
  const manager = company.role !== "member";
  const canChange = manager && !company.is_demo && isWritable(company.subscription_status, company.comped);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <Link href="/app/brain" className="inline-flex min-h-9 items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> The Brain
      </Link>
      <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[28px]">{doc.title}</h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-faint">
        <span>{kindLabel(doc.kind)}</span>
        {doc.pages ? <span>· {doc.pages} {doc.pages === 1 ? "page" : "pages"}</span> : null}
        <span>· {doc.origin === "sample" ? "A made-up sample" : doc.origin === "note" ? `Typed in by ${doc.added_by_name ?? "someone"}, ${fmtWhen(doc.created_at)}` : `Loaded by ${doc.added_by_name ?? "someone"}, ${fmtWhen(doc.created_at)}`}</span>
        {doc.managers_only ? <span className="flex items-center gap-1 rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-ink-dim"><Lock className="h-3 w-3" /> Managers only</span> : null}
      </p>

      {manager ? (
        <div className="mt-5">
          <DocActions docId={doc.id} title={doc.title} kind={doc.kind} managersOnly={doc.managers_only} hasFile={doc.origin === "file" && doc.status !== "reading"} canChange={canChange} demo={company.is_demo} />
        </div>
      ) : null}

      {doc.status !== "ready" ? (
        <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[14px] leading-relaxed text-red-300">
          {doc.status === "failed" ? `SYNNR couldn't read this one. ${doc.problem ?? ""}` : "This one didn't finish loading. Take it out and load it again."}
        </p>
      ) : (
        <>
          <p className="mt-7 text-[13px] text-ink-faint">
            What SYNNR read, in {chunks.length} {chunks.length === 1 ? "passage" : "passages"}. An answer points at the passage it came from.
          </p>
          <ol className="mt-2 flex flex-col gap-3">
            {chunks.map((c) => (
              <li key={c.idx} id={`p${c.idx}`} className="scroll-mt-20 rounded-xl border border-line bg-surface px-4 py-4 target:border-bone sm:px-5">
                {c.section || c.page ? (
                  <div className="mb-1.5 text-[12px] text-ink-faint">{[c.section, c.page ? `page ${c.page}` : null].filter(Boolean).join(" · ")}</div>
                ) : null}
                <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-dim">{c.body}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
