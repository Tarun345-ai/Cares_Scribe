/*
# Care Loop — Consultation, Care Actions, and Dependency Tables

## Purpose
Stores multilingual voice consultation transcripts, AI-generated clinical notes,
extracted care actions, and the dependency graph between actions.

## New Tables

### consultations
- `id` (uuid, primary key) — unique consultation record
- `patient_id` (uuid) — identifies the patient (no FK to auth.users; single-tenant app)
- `language_detected` (text) — language code returned by Groq Whisper
- `transcription` (text) — full transcript text from Whisper
- `clinical_note` (text) — AI-generated SOAP-format clinical note
- `created_at` (timestamptz, default now())

### care_actions
- `id` (uuid, primary key) — unique action
- `consultation_id` (uuid, FK → consultations.id ON DELETE CASCADE) — parent consultation
- `patient_id` (uuid) — identifies the patient
- `title` (text) — action title
- `type` (text) — one of: medication, test, referral, review
- `due_date` (date) — calculated due date
- `status` (text, default 'pending') — pending / in_progress / completed
- `created_at` (timestamptz, default now())

### action_dependencies
- `id` (uuid, primary key) — unique dependency edge
- `action_id` (uuid, FK → care_actions.id ON DELETE CASCADE) — the dependent action
- `depends_on_id` (uuid, FK → care_actions.id ON DELETE CASCADE) — the prerequisite action

## Security
- RLS enabled on all three tables.
- Single-tenant app (no sign-in screen) → policies allow anon + authenticated CRUD.
- Data is intentionally shared/public across the care team.
*/

CREATE TABLE IF NOT EXISTS consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  language_detected text,
  transcription text,
  clinical_note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_consultations" ON consultations;
CREATE POLICY "anon_select_consultations" ON consultations FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_consultations" ON consultations;
CREATE POLICY "anon_insert_consultations" ON consultations FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_consultations" ON consultations;
CREATE POLICY "anon_update_consultations" ON consultations FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_consultations" ON consultations;
CREATE POLICY "anon_delete_consultations" ON consultations FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS care_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'review',
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE care_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_care_actions" ON care_actions;
CREATE POLICY "anon_select_care_actions" ON care_actions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_care_actions" ON care_actions;
CREATE POLICY "anon_insert_care_actions" ON care_actions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_care_actions" ON care_actions;
CREATE POLICY "anon_update_care_actions" ON care_actions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_care_actions" ON care_actions;
CREATE POLICY "anon_delete_care_actions" ON care_actions FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS action_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid REFERENCES care_actions(id) ON DELETE CASCADE,
  depends_on_id uuid REFERENCES care_actions(id) ON DELETE CASCADE
);

ALTER TABLE action_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_action_dependencies" ON action_dependencies;
CREATE POLICY "anon_select_action_dependencies" ON action_dependencies FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_action_dependencies" ON action_dependencies;
CREATE POLICY "anon_insert_action_dependencies" ON action_dependencies FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_action_dependencies" ON action_dependencies;
CREATE POLICY "anon_update_action_dependencies" ON action_dependencies FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_action_dependencies" ON action_dependencies;
CREATE POLICY "anon_delete_action_dependencies" ON action_dependencies FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_care_actions_consultation_id ON care_actions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_care_actions_patient_id ON care_actions(patient_id);
CREATE INDEX IF NOT EXISTS idx_action_dependencies_action_id ON action_dependencies(action_id);
CREATE INDEX IF NOT EXISTS idx_action_dependencies_depends_on_id ON action_dependencies(depends_on_id);
