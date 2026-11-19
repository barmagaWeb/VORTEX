-- VORTEX follow-up: bound media fan-out and candidate ranking work.
-- Additive migration; no existing posts or media rows are deleted.

-- Community-filtered feed queries can use the same deterministic timeline index.
CREATE INDEX IF NOT EXISTS idx_posts_community_feed
  ON public.posts (community_id, created_at DESC, id DESC);

-- Guard media ownership/type on each row. The parent row lock serializes
-- concurrent INSERT statements for the same post before they write media rows.
CREATE OR REPLACE FUNCTION public.enforce_post_media_owner_and_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_author_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.post_id IS DISTINCT FROM OLD.post_id
       OR NEW.media_type IS DISTINCT FROM OLD.media_type THEN
      RAISE EXCEPTION 'Post media cannot be moved to another post or changed to another media type.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  SELECT post_row.author_id
    INTO v_author_id
    FROM public.posts AS post_row
   WHERE post_row.id = NEW.post_id
   FOR UPDATE;

  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'The post does not exist.' USING ERRCODE = '23503';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_author_id THEN
    RAISE EXCEPTION 'Only the post owner can attach media.' USING ERRCODE = '42501';
  END IF;

  IF NEW.media_type IS DISTINCT FROM 'image' THEN
    RAISE EXCEPTION 'VORTEX posts support image media only.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_post_media_owner_and_type_guard ON public.post_media;
CREATE TRIGGER trg_vortex_post_media_owner_and_type_guard
BEFORE INSERT OR UPDATE OF post_id, media_type ON public.post_media
FOR EACH ROW
EXECUTE FUNCTION public.enforce_post_media_owner_and_type();

REVOKE EXECUTE ON FUNCTION public.enforce_post_media_owner_and_type() FROM PUBLIC, anon, authenticated;

-- Check the final statement result, not a per-row count. A row-level BEFORE
-- trigger cannot reliably count every row of a multi-row INSERT. The
-- statement-level transition table sees all inserted rows; the parent lock
-- above serializes competing statements for the same post.
CREATE OR REPLACE FUNCTION public.enforce_post_media_count_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_post_id UUID;
  v_existing_count INTEGER;
BEGIN
  FOR v_post_id IN
    SELECT DISTINCT inserted_row.post_id
      FROM new_post_media_rows AS inserted_row
     ORDER BY inserted_row.post_id
  LOOP
    SELECT pg_catalog.count(*)::INTEGER
      INTO v_existing_count
      FROM public.post_media AS media_row
     WHERE media_row.post_id = v_post_id;

    IF v_existing_count > 10 THEN
      RAISE EXCEPTION 'A post can contain at most ten images.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_post_media_count_limit ON public.post_media;
CREATE TRIGGER trg_vortex_post_media_count_limit
AFTER INSERT ON public.post_media
REFERENCING NEW TABLE AS new_post_media_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.enforce_post_media_count_limit();

REVOKE EXECUTE ON FUNCTION public.enforce_post_media_count_limit() FROM PUBLIC, anon, authenticated;

-- Keep individual tags bounded as well as limiting array cardinality in
-- migration 12; otherwise a small number of enormous tag strings can bloat rows.
CREATE OR REPLACE FUNCTION public.validate_vortex_post_tags()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_tag TEXT;
BEGIN
  IF COALESCE(pg_catalog.cardinality(NEW.tags), 0) > 30 THEN
    RAISE EXCEPTION 'A post can contain at most 30 tags.' USING ERRCODE = '22023';
  END IF;

  FOREACH v_tag IN ARRAY COALESCE(NEW.tags, '{}'::TEXT[]) LOOP
    IF pg_catalog.char_length(pg_catalog.btrim(v_tag)) < 1
       OR pg_catalog.char_length(v_tag) > 64
       OR v_tag ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'Each tag must contain 1-64 printable characters.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_post_tag_bounds ON public.posts;
CREATE TRIGGER trg_vortex_post_tag_bounds
BEFORE INSERT OR UPDATE OF tags ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.validate_vortex_post_tags();

REVOKE EXECUTE ON FUNCTION public.validate_vortex_post_tags() FROM PUBLIC, anon, authenticated;

-- Evaluate ranking over a bounded newest-first candidate set. Visibility is
-- still enforced by posts RLS inside the candidate query. This caps the work
-- needed to calculate the decayed engagement score to at most 2,000 visible
-- candidates per request while keeping stable ordering and the existing RPC API.
CREATE OR REPLACE FUNCTION public.get_for_you_feed(
  page_limit INTEGER DEFAULT 30,
  page_offset INTEGER DEFAULT 0,
  target_community_id UUID DEFAULT NULL
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  WITH candidates AS MATERIALIZED (
    SELECT post_row.*
      FROM public.posts AS post_row
     WHERE target_community_id IS NULL
        OR post_row.community_id = target_community_id
     ORDER BY post_row.created_at DESC, post_row.id DESC
     LIMIT 2000
  )
  SELECT candidate.*
    FROM candidates AS candidate
   ORDER BY (
     pg_catalog.ln(1.0::DOUBLE PRECISION + GREATEST(COALESCE(candidate.likes_count, 0), 0)::DOUBLE PRECISION)
     / pg_catalog.power(
         GREATEST(pg_catalog.date_part('epoch', pg_catalog.now() - candidate.created_at) / 3600.0, 0.0)::DOUBLE PRECISION + 2.0::DOUBLE PRECISION,
         0.65::DOUBLE PRECISION
       )
   ) DESC, candidate.created_at DESC, candidate.id DESC
   LIMIT GREATEST(1, LEAST(COALESCE(page_limit, 30), 100))
   OFFSET GREATEST(0, COALESCE(page_offset, 0));
$function$;

REVOKE ALL ON FUNCTION public.get_for_you_feed(INTEGER, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_for_you_feed(INTEGER, INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_for_you_feed(INTEGER, INTEGER, UUID) IS
  'Ranks up to 2,000 newest RLS-visible posts by time-decayed engagement; older posts remain available in Latest and author profiles.';
