/*
# Care Loop — Prescriptions Table

## Purpose
Stores AI-generated prescription drafts linked to consultations, with status
tracking through the review workflow (draft → pending_review → approved / changes_requested).

## New Tables

### prescriptions
- `id` (uuid, primary key) — unique prescription record
- `consultation_id` (uuid) — links to consultations table (no FK constraint since consultations table may not have this id as PK match; soft reference)
- `patient_id` (uuid) — identifies the patient
- `doctor_id` (uuid, nullable) — identifies the reviewing doctor (set when sent for review)
- `medications` (jsonb) — array of medication objects with drug_name, dosage, frequency, duration, instructions
- `additional_notes` (text) — extra clinical notes from AI
- `warnings` (text) — safety warnings from AI
- `status` (text, default 'draft') — one of: draft, pending_review, approved, changes_requested
- `sent_at` (timestamptz, nullable) — when the prescription was emailed to doctor
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on prescriptions table.
- Single-tenant app (no sign-in screen) → policies allow anon + authenticated CRUD.
- Data is intentionally shared/public across the care team.

## Indexes
- Index on patient_id for querying a patient's prescriptions.
- Index on consultation_id for looking up prescriptions by consultation.
*/

CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid,
  patient_id uuid NOT NULL,
  doctor_id uuid,
  medications jsonb DEFAULT '[]'::jsonb,
  additional_notes text,
  warnings text,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_prescriptions" ON prescriptions;
CREATE POLICY "anon_select_prescriptions" ON prescriptions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_prescriptions" ON prescriptions;
CREATE POLICY "anon_insert_prescriptions" ON prescriptions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_prescriptions" ON prescriptions;
CREATE POLICY "anon_update_prescriptions" ON prescriptions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_prescriptions" ON prescriptions;
CREATE POLICY "anon_delete_prescriptions" ON prescriptions FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON prescriptions(consultation_id);
