-- The first cut of the search counted a word as found or not. Asked what
-- standby costs, it put a clause that only says "charge" level with the
-- price sheet's own Standby section. A word in a passage's section heading
-- or its document's name now counts for more than the same word in passing,
-- and a word used more than once counts a little more.
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
    -- Body, (unused), section heading, document name.
    sum(w.wt * (1 + 3 * ts_rank('{0.1, 0.2, 0.6, 1.0}', c.fts, w.tq)))::real as score
  from public.synnr_doc_chunks c
  join public.synnr_docs d on d.id = c.doc_id and d.status = 'ready'
  join weighed w on c.fts @@ w.tq
  where c.company_id = p_company
  group by c.id, d.kind
  order by 11 desc, c.doc_id, c.idx
  limit least(greatest(coalesce(p_limit, 12), 1), 40);
$$;
