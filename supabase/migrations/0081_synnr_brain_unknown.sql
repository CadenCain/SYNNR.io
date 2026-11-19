-- "It says when it doesn't know." The search goes by words, so asked about
-- something the shop never wrote down, it used to hand back whatever
-- passages shared a stray word with the question, as if they answered it.
-- This tells the app which words of a question appear in none of the
-- documents the asker can see, so the answer can say so by name ("your
-- documents never mention hotel") instead of passing a near miss off as an
-- answer. It runs as the person asking, like the search does: a word that
-- only a managers-only document uses is, to a hand, a word nothing mentions.
create or replace function public.synnr_brain_unknown(p_company uuid, p_query text)
returns text[]
language sql stable security invoker set search_path = public as $$
  select coalesce(array_agg(w.word order by w.pos), '{}')
  from (
    select t.word, min(t.pos) as pos
    from regexp_split_to_table(lower(left(coalesce(p_query, ''), 2000)), '[^a-z0-9]+') with ordinality as t(word, pos)
    where length(t.word) > 2
    group by t.word
    order by 2
    limit 40
  ) w
  -- A word the search itself throws away ("the", "what") says nothing either way.
  where numnode(plainto_tsquery('english', w.word)) > 0
    and not exists (
      select 1 from public.synnr_doc_chunks c
      join public.synnr_docs d on d.id = c.doc_id and d.status = 'ready'
      where c.company_id = p_company and c.fts @@ plainto_tsquery('english', w.word)
    );
$$;

revoke all on function public.synnr_brain_unknown(uuid, text) from public, anon;
grant execute on function public.synnr_brain_unknown(uuid, text) to authenticated, service_role;
