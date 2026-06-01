-- =============================================================
-- Conference Discussion Board — Supabase Schema
-- Table prefix: cdb_  (avoids collisions in shared Supabase project)
-- Run this in the Supabase SQL editor to set up the database.
-- =============================================================

-- cdb_sessions: one row per conference session/board instance
CREATE TABLE cdb_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  title_ja   TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- cdb_categories: created by the moderator or AI organize, scoped to a session.
-- representative_question_id and discussion_trigger_question_id are set by AI organize.
CREATE TABLE cdb_categories (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                    UUID NOT NULL REFERENCES cdb_sessions(id) ON DELETE CASCADE,
  label                         TEXT NOT NULL,
  label_ja                      TEXT,
  representative_question_id    UUID REFERENCES cdb_questions(id) ON DELETE SET NULL,
  discussion_trigger_question_id UUID REFERENCES cdb_questions(id) ON DELETE SET NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Migration applied: ALTER TABLE cdb_categories
--   ADD COLUMN representative_question_id     UUID REFERENCES cdb_questions(id) ON DELETE SET NULL,
--   ADD COLUMN discussion_trigger_question_id  UUID REFERENCES cdb_questions(id) ON DELETE SET NULL;

-- cdb_questions: content and context are IMMUTABLE after insert.
-- Only category_id and parent_id may be updated (by the moderator).
-- Never update the content or context columns — the application enforces this.
CREATE TABLE cdb_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES cdb_sessions(id) ON DELETE CASCADE,
  category_id         UUID REFERENCES cdb_categories(id) ON DELETE SET NULL, -- NULL = Uncategorized
  parent_id           UUID REFERENCES cdb_questions(id) ON DELETE SET NULL,
  content             TEXT NOT NULL,        -- IMMUTABLE: original text in submission language
  context             TEXT,                 -- IMMUTABLE: optional background/reason in submission language
  content_en          TEXT,                 -- English version: original if submitted in EN, AI translation if submitted in JA
  content_ja          TEXT,                 -- Japanese version: original if submitted in JA, AI translation if submitted in EN
  context_en          TEXT,                 -- English context version
  context_ja          TEXT,                 -- Japanese context version
  author_name         TEXT NOT NULL,
  author_affiliation  TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Migrations applied:
--   ALTER TABLE cdb_questions ADD COLUMN context TEXT;
--   ALTER TABLE cdb_questions ADD COLUMN content_en TEXT, ADD COLUMN content_ja TEXT,
--     ADD COLUMN context_en TEXT, ADD COLUMN context_ja TEXT;

-- cdb_votes: one row per (question, voter) pair — DB enforces no double-voting
-- Note: cdb_participants are stored client-side in sessionStorage (no DB table needed)
CREATE TABLE cdb_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES cdb_questions(id) ON DELETE CASCADE,
  voter_id    TEXT NOT NULL,                -- participant UUID from sessionStorage
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, voter_id)
);

-- View: cdb_questions enriched with live vote counts
CREATE OR REPLACE VIEW cdb_questions_with_votes AS
SELECT
  q.*,
  COALESCE(v.vote_count, 0)::INT AS vote_count
FROM cdb_questions q
LEFT JOIN (
  SELECT question_id, COUNT(*) AS vote_count
  FROM cdb_votes
  GROUP BY question_id
) v ON v.question_id = q.id;

-- =============================================================
-- Enable Realtime for live updates
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE cdb_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE cdb_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE cdb_categories;

-- =============================================================
-- No seed data — sessions are created by the moderator at runtime
-- via the /moderator interface (POST /api/sessions).
-- =============================================================
