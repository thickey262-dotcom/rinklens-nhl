-- Follow-up: upsert sends the vote identity columns on conflict.
-- The existing RLS policies bind user_id to auth.uid(), and a BEFORE UPDATE
-- trigger rejects changes to vote identity, timestamps or excessive updates.
-- UPDATE therefore needs table-wide grants for Supabase/PostgREST upserts.
GRANT UPDATE ON public.community_eye_votes TO authenticated;
