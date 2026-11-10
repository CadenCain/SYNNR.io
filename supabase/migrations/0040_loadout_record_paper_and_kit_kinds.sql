-- 0040 Load-out records keep the truck's paper and the phone's save time;
-- truck kits name the kind of piece (2026-11-09).
--
-- 1. The truck's own paper on the record. A load-out record kept each
--    piece's tests and certs as they stood when it rolled, but the truck's
--    own paper (the DOT and the like) only when it failed. A truck rolling on
--    a DOT that's "retested, cert on the way" read as plain READY on the
--    operator's proof link. Now every item is kept the same way a piece's
--    tests are: [{ title, good_until, result, paper }], result one of ok,
--    due_soon, pending, expired, missing, no_paper.
--
-- 2. When the hand tapped Save on the phone. A load-out saved with no signal
--    on location can reach RollReady hours later. finished_at stays when it
--    landed; phone_saved_at is when the hand saved it (clamped by the server
--    to the load-out's own start and now), and the out clock starts then.
--
-- Both are written by the server's service role at insert, like the rest of
-- the record. saas_loadout_scans keeps its policies and its update lock
-- (migration 0012): nobody can change a record after it's saved.
--
-- 3. Kit lines made from what was on a truck kept the truck's name and the
--    one piece's serial ("Fluid end, P-01", "Reel R-1, 2-3/8in, 16,400 ft"),
--    so only that one piece could ever fill the line: a good spare fluid end
--    on P-01 read "Short: Fluid end, P-01, 0 of 1 scanned". New kits are made
--    by kind (lib/saas/loadout-lines.ts pieceKind). This re-derives the
--    existing kit lines once, by the same rule: take out any truck name of
--    the company that's in the line as a whole word, and any piece serial
--    that's part of that piece's own name (the way a line made from the truck
--    got it: "Reel R-1, ..." with serial R-1), only ones with letters and
--    digits, 3 or more long, so a size like "1502" is never touched; and a
--    reel's footage (1,000 ft or more). A short length like a pup joint's
--    "10 ft" stays, and so does a comma inside a number ("15,000 psi"). A
--    serial a manager typed onto a line on purpose ("Quad BOP QB-4471", when
--    the BOP's name is just "Quad BOP") stays. A line is only rewritten when
--    something came out of it; job packages are left alone, and a line that
--    would have nothing left that names a kind is left as it was. Running it
--    again changes nothing.

alter table public.saas_loadout_scans add column if not exists truck_paper jsonb;
alter table public.saas_loadout_scans add column if not exists phone_saved_at timestamptz;

do $$
declare
  l record;
  w record;
  cleaned text;
  nxt text;
begin
  for l in
    select pl.id, pl.label, pl.company_id
    from public.saas_package_lines pl
    join public.saas_packages p on p.id = pl.package_id and p.company_id = pl.company_id
    where p.unit_id is not null
  loop
    cleaned := l.label;
    for w in
      select distinct trim(x.word) as word from (
        select u.name as word from public.saas_units u
          where u.company_id = l.company_id and position(lower(trim(u.name)) in lower(l.label)) > 0
        union
        select a.identifier from public.saas_assets a
          where a.company_id = l.company_id and a.identifier is not null
            and position(lower(trim(a.identifier)) in lower(a.name)) > 0
            and position(lower(trim(a.identifier)) in lower(l.label)) > 0
      ) x
      where char_length(trim(x.word)) >= 3 and trim(x.word) ~ '[A-Za-z]' and trim(x.word) ~ '[0-9]'
    loop
      cleaned := regexp_replace(cleaned,
        '(?<![A-Za-z0-9])' || regexp_replace(w.word, '([.^$|?*+()\[\]{}\\-])', '\\\1', 'g') || '(?![A-Za-z0-9])',
        ' ', 'gi');
    end loop;
    -- What's left on a reel: 1,000 ft or more.
    cleaned := regexp_replace(cleaned, '(?<![0-9,.])([0-9]{1,3}(,[0-9]{3})+|[0-9]{4,})(\.[0-9]+)?\s*(ft|feet|foot|'')(?![A-Za-z])\.?', ' ', 'gi');
    cleaned := regexp_replace(cleaned, '\(\s*\)', ' ', 'g');
    -- Nothing came out of it: the line stays exactly as it was.
    continue when cleaned = l.label;
    -- A comma inside a number ("15,000 psi", "1,000,000") isn't a break
    -- between parts: set it aside (chr(1)) while the parts are tidied.
    loop
      nxt := regexp_replace(cleaned, '([0-9]),([0-9]{3})([^0-9]|$)', '\1' || chr(1) || '\2\3', 'g');
      exit when nxt = cleaned;
      cleaned := nxt;
    end loop;
    -- Tidy: each comma part trimmed, empty parts dropped.
    select string_agg(t.part, ', ' order by t.ord) into cleaned
    from (
      select replace(regexp_replace(regexp_replace(s.part, '\s+', ' ', 'g'), '^[\s:;-]+|[\s:;-]+$', '', 'g'), chr(1), ',') as part, s.ord
      from unnest(string_to_array(cleaned, ',')) with ordinality as s(part, ord)
    ) t
    where t.part <> '';
    cleaned := left(coalesce(cleaned, ''), 80);
    if cleaned ~ '[A-Za-z]' and cleaned <> l.label then
      update public.saas_package_lines set label = cleaned where id = l.id;
    end if;
  end loop;
end $$;
