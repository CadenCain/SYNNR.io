-- The brain: a shop's own documents, and answers that come only from them.
--
-- A shop loads what it runs on (procedures, customer terms, price sheets,
-- job reports, and notes nobody ever wrote down). SYNNR reads each one into
-- passages, and a question is answered from those passages and nothing
-- else, with the passage shown. Every row carries its company, and the
-- database decides who can read it:
--
--  - Only the server writes a document or a passage, after it has read the
--    file itself. Nobody types a passage in behind a document.
--  - A document can be for managers only (a price sheet, a customer's
--    terms). A hand's questions never search it, and never show it.
--  - What was asked, and what came back, is kept. A hand sees their own
--    questions; a manager sees the shop's.

create table if not exists public.synnr_docs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  kind text not null default 'other' check (kind in ('procedure', 'contract', 'pricing', 'report', 'note', 'other')),
  -- A file someone loaded, a note someone typed, or the demo's made-up samples.
  origin text not null default 'file' check (origin in ('file', 'note', 'sample')),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  mime text check (mime is null or char_length(mime) <= 120),
  bytes integer check (bytes is null or bytes >= 0),
  pages integer check (pages is null or pages >= 0),
  status text not null default 'reading' check (status in ('reading', 'ready', 'failed')),
  -- Why it couldn't be read, in plain words.
  problem text check (problem is null or char_length(problem) <= 300),
  chars integer not null default 0,
  managers_only boolean not null default false,
  added_by uuid,
  added_by_name text check (added_by_name is null or char_length(added_by_name) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists synnr_docs_company_idx on public.synnr_docs (company_id, created_at desc);

create table if not exists public.synnr_doc_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.synnr_docs(id) on delete cascade,
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  idx integer not null,
  -- Copied from the document (the database keeps them in step), so a
  -- question that names the document finds its passages.
  doc_title text not null,
  section text check (section is null or char_length(section) <= 200),
  page integer,
  body text not null check (char_length(body) between 1 and 4000),
  managers_only boolean not null default false,
  fts tsvector generated always as (
    setweight(to_tsvector('english', doc_title), 'A')
    || setweight(to_tsvector('english', coalesce(section, '')), 'B')
    || setweight(to_tsvector('english', body), 'D')
  ) stored,
  unique (doc_id, idx)
);
create index if not exists synnr_doc_chunks_fts_idx on public.synnr_doc_chunks using gin (fts);
create index if not exists synnr_doc_chunks_company_idx on public.synnr_doc_chunks (company_id);

create table if not exists public.synnr_asks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  user_id uuid,
  asked_by text check (asked_by is null or char_length(asked_by) <= 120),
  -- A question, or a job pasted in as dispatch sent it.
  mode text not null default 'ask' check (mode in ('ask', 'job')),
  question text not null check (char_length(question) between 1 and 8000),
  -- What came back: the answer, and the passages it came from.
  answer jsonb not null default '{}'::jsonb check (pg_column_size(answer) <= 200000),
  -- Written from the passages, the passages themselves, or nothing found.
  how text not null default 'none' check (how in ('ai', 'passages', 'none')),
  created_at timestamptz not null default now()
);
create index if not exists synnr_asks_company_idx on public.synnr_asks (company_id, created_at desc);

-- A passage always belongs to its document's company, and carries its
-- document's name and who may see it.
create or replace function public.synnr_doc_chunks_guard() returns trigger
language plpgsql set search_path = public as $$
declare d record;
begin
  select company_id, title, managers_only into d from public.synnr_docs where id = new.doc_id;
  if d.company_id is null then
    raise exception 'That document is gone.';
  end if;
  new.company_id := d.company_id;
  new.doc_title := d.title;
  new.managers_only := d.managers_only;
  return new;
end $$;
drop trigger if exists synnr_doc_chunks_guard on public.synnr_doc_chunks;
create trigger synnr_doc_chunks_guard before insert or update on public.synnr_doc_chunks
  for each row execute function public.synnr_doc_chunks_guard();

-- A document never changes company. Renaming it, or making it managers
-- only, reaches every passage in the same step.
create or replace function public.synnr_docs_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'A document cannot move to another company.';
  end if;
  new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists synnr_docs_guard on public.synnr_docs;
create trigger synnr_docs_guard before update on public.synnr_docs
  for each row execute function public.synnr_docs_guard();

create or replace function public.synnr_docs_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.title is distinct from old.title or new.managers_only is distinct from old.managers_only then
    update public.synnr_doc_chunks set idx = idx where doc_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists synnr_docs_sync on public.synnr_docs;
create trigger synnr_docs_sync after update on public.synnr_docs
  for each row execute function public.synnr_docs_sync();

revoke all on function public.synnr_doc_chunks_guard() from public, anon, authenticated;
revoke all on function public.synnr_docs_guard() from public, anon, authenticated;
revoke all on function public.synnr_docs_sync() from public, anon, authenticated;

alter table public.synnr_docs enable row level security;
alter table public.synnr_doc_chunks enable row level security;
alter table public.synnr_asks enable row level security;

-- Reading only. There are no rules for writing, so nobody signed in can
-- write any of these: the server does, after its own checks.
drop policy if exists synnr_docs_select on public.synnr_docs;
create policy synnr_docs_select on public.synnr_docs for select
  using (company_id in (select saas_user_company_ids()) and (not managers_only or saas_is_company_admin(company_id)));
drop policy if exists synnr_doc_chunks_select on public.synnr_doc_chunks;
create policy synnr_doc_chunks_select on public.synnr_doc_chunks for select
  using (company_id in (select saas_user_company_ids()) and (not managers_only or saas_is_company_admin(company_id)));
drop policy if exists synnr_asks_select on public.synnr_asks;
create policy synnr_asks_select on public.synnr_asks for select
  using (company_id in (select saas_user_company_ids()) and (user_id = auth.uid() or saas_is_company_admin(company_id)));

-- Find the passages closest to a question. It runs as the person asking,
-- so the rules above decide what it can see: never another company's
-- passages, and never a managers-only document for a hand.
--
-- A word that shows up in a few passages counts for more than one that is
-- in all of them, so "standby" outweighs "job". Each passage is scored by
-- the words of the question it holds.
create or replace function public.synnr_brain_search(p_company uuid, p_query text, p_limit integer default 12)
returns table (chunk_id uuid, doc_id uuid, doc_title text, kind text, section text, page integer, idx integer, body text, hits integer, terms integer, score real)
language sql stable security invoker set search_path = public as $$
  with words as (
    select lexeme, ('''' || replace(replace(lexeme, '\', '\\'), '''', '''''') || '''')::tsquery as tq
    from (select lexeme from unnest(to_tsvector('english', left(coalesce(p_query, ''), 8000))) order by lexeme limit 80) w
  ),
  total as (
    select greatest(count(*), 1)::real as n from public.synnr_doc_chunks c where c.company_id = p_company
  ),
  weighed as (
    select w.lexeme, w.tq, ln(1 + total.n / df.n)::real as wt
    from words w
    cross join total
    cross join lateral (
      select count(*)::real as n from public.synnr_doc_chunks c where c.company_id = p_company and c.fts @@ w.tq
    ) df
    where df.n > 0
  )
  select c.id, c.doc_id, c.doc_title, d.kind, c.section, c.page, c.idx, c.body,
    count(*)::integer as hits,
    (select count(*)::integer from words) as terms,
    sum(w.wt)::real as score
  from public.synnr_doc_chunks c
  join public.synnr_docs d on d.id = c.doc_id and d.status = 'ready'
  join weighed w on c.fts @@ w.tq
  where c.company_id = p_company
  group by c.id, d.kind
  order by sum(w.wt) desc, c.doc_id, c.idx
  limit least(greatest(coalesce(p_limit, 12), 1), 40);
$$;
revoke all on function public.synnr_brain_search(uuid, text, integer) from public, anon;
grant execute on function public.synnr_brain_search(uuid, text, integer) to authenticated, service_role;

-- Where the files themselves are kept: private, and only the server reads
-- or writes it (no storage rules are added for anyone else).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brain', 'brain', false, 26214400, array[
  'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict (id) do nothing;
