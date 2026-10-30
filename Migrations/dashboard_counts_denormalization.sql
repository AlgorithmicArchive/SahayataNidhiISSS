-- =====================================================================
-- Dashboard Counts Denormalization Migration
-- Date: 2026-09-07
--
-- Purpose: Eliminate two slow CTEs in get_dashboard_counts():
--   1. shifted_count  → now reads from application_shifts table
--   2. temp_disability → now reads from is_pcp / udid_expiry_date columns
--
-- Safe to run: Yes (all DDL uses IF NOT EXISTS / IF EXISTS)
-- Reversible:  DROP TABLE application_shifts; ALTER TABLE citizen_applications
--              DROP COLUMN is_pcp, DROP COLUMN udid_expiry_date;
--              Then restore the old get_dashboard_counts definition.
-- =====================================================================

-- 1. application_shifts table (replaces JSONB workflow expansion for shifted_count)
CREATE TABLE IF NOT EXISTS application_shifts (
    id              BIGSERIAL    PRIMARY KEY,
    reference_number VARCHAR(50) NOT NULL,
    service_id      INTEGER      NOT NULL,
    designation     VARCHAR(100) NOT NULL,
    shifted_from    INTEGER      NOT NULL,
    shifted_to      INTEGER,
    tehsil_code     INTEGER,
    district_code   INTEGER,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Unique constraint for idempotent upserts (one row per officer-per-application shift)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'uq_application_shifts_ref_desig_from'
    ) THEN
        CREATE UNIQUE INDEX uq_application_shifts_ref_desig_from
            ON application_shifts (reference_number, service_id, designation, shifted_from);
    END IF;
END $$;

-- Covering index for the shifted_count query (service + designation + shifted_from + region)
CREATE INDEX IF NOT EXISTS idx_application_shifts_count
    ON application_shifts (service_id, designation, shifted_from)
    INCLUDE (reference_number, tehsil_code, district_code);

-- 2. Denormalized columns on citizen_applications (replaces temp_disability CTE)
ALTER TABLE citizen_applications
    ADD COLUMN IF NOT EXISTS is_pcp          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS udid_expiry_date DATE;

-- Partial indexes for fast filtered counts
CREATE INDEX IF NOT EXISTS idx_ca_pcp
    ON citizen_applications (service_id)
    WHERE is_pcp = TRUE;

CREATE INDEX IF NOT EXISTS idx_ca_udid_expiry
    ON citizen_applications (service_id)
    WHERE udid_expiry_date IS NOT NULL;

-- 3. Trigger: auto-maintain is_pcp and udid_expiry_date on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.fn_sync_pcp_udid_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_pension_type TEXT;
    v_expiry_str   TEXT;
    v_corr_expiry  DATE;
BEGIN
    -- is_pcp: derived from the flat formdetails (fast index lookup)
    v_pension_type := NEW.formdetails_flat ->> 'PensionType';
    NEW.is_pcp := (v_pension_type = 'PHYSICALLY CHALLENGED PERSON');

    IF NOT NEW.is_pcp THEN
        NEW.udid_expiry_date := NULL;
        RETURN NEW;
    END IF;

    -- Check corrigendum table for latest override (replicates old CTE logic)
    BEGIN
        SELECT (c.corrigendumfields -> 'IfTemporaryDisabilityUdidCardValidUpto' ->> 'new_value')::date
          INTO v_corr_expiry
          FROM public.corrigendum c
         WHERE c.referencenumber = NEW.referencenumber
           AND c.corrigendumfields ? 'IfTemporaryDisabilityUdidCardValidUpto'
         ORDER BY c.createdat DESC
         LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_corr_expiry := NULL;
    END;

    IF v_corr_expiry IS NOT NULL THEN
        NEW.udid_expiry_date := v_corr_expiry;
        RETURN NEW;
    END IF;
-- Fall back to the nested JSON: Pension Type → additionalFields(TEMPORARY) → IfTemporaryDisabilityUdidCardValidUpto
    BEGIN
        SELECT td.value ->> 'value'
          INTO v_expiry_str
          FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(NEW.formdetails -> 'Pension Type') = 'array'
                      THEN NEW.formdetails -> 'Pension Type'
                      ELSE '[]'::jsonb END
              ) pension
          CROSS JOIN LATERAL jsonb_array_elements(
                 CASE WHEN jsonb_typeof(pension.value -> 'additionalFields') = 'array'
                      THEN pension.value -> 'additionalFields'
                      ELSE '[]'::jsonb END
              ) disability
          CROSS JOIN LATERAL jsonb_array_elements(
                 CASE WHEN jsonb_typeof(disability.value -> 'additionalFields') = 'array'
                      THEN disability.value -> 'additionalFields'
                      ELSE '[]'::jsonb END
              ) td
         WHERE pension.value   ->> 'value' = 'PHYSICALLY CHALLENGED PERSON'
           AND disability.value ->> 'value' = 'TEMPORARY'
           AND td.value         ->> 'name'  = 'IfTemporaryDisabilityUdidCardValidUpto'
         LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_expiry_str := NULL;
    END;

    -- Parse the date (Indian DD/MM/YYYY format)
    IF v_expiry_str IS NOT NULL AND v_expiry_str ~ '^\d{2}/\d{2}/\d{4}$' THEN
        NEW.udid_expiry_date := to_date(v_expiry_str, 'DD/MM/YYYY');
    ELSIF v_expiry_str IS NOT NULL AND v_expiry_str ~ '^\d{4}-\d{2}-\d{2}$' THEN
        NEW.udid_expiry_date := v_expiry_str::date;
    ELSE
        NEW.udid_expiry_date := NULL;
    END IF;

    RETURN NEW;
END;
$fn$;

-- Create trigger (name sorts AFTER tg_flatten_formdetails alphabetically so formdetails_flat is ready)
DROP TRIGGER IF EXISTS trg_sync_pcp_udid ON citizen_applications;
CREATE TRIGGER trg_sync_pcp_udid
    BEFORE INSERT OR UPDATE ON citizen_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_pcp_udid_columns();

-- 4. Backfill existing data
-- 4a. Populate application_shifts from existing workflow JSONB
INSERT INTO application_shifts (reference_number, service_id, designation, shifted_from, shifted_to, tehsil_code, district_code)
SELECT DISTINCT ON (ca.referencenumber, ca.serviceid, wf ->> 'designation', (wf ->> 'shiftedFrom')::int)
    ca.referencenumber,
    ca.serviceid,
    wf ->> 'designation',
    (wf ->> 'shiftedFrom')::int,
    (wf ->> 'shiftedTo')::int,
    (ca.formdetails_flat ->> 'Tehsil')::int,
    (ca.formdetails_flat ->> 'District')::int
FROM citizen_applications ca,
     LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(ca.workflow) = 'array' THEN ca.workflow ELSE '[]'::jsonb END
     ) wf
WHERE (wf ->> 'shifted')::boolean = TRUE
  AND wf ->> 'shiftedFrom' IS NOT NULL
ON CONFLICT (reference_number, service_id, designation, shifted_from) DO NOTHING;

-- 4b. Populate is_pcp and udid_expiry_date for existing rows
--     (NOTE: this UPDATE fires the trigger, which recomputes both columns;
--      the trigger already applies the corrigendum override + date parsing.)
UPDATE citizen_applications ca
SET is_pcp = ca.is_pcp,
    udid_expiry_date = ca.udid_expiry_date
WHERE ca.serviceid = 1;

-- 5. Verification (manual, run after migration):
--    SELECT is_pcp, COUNT(*) FROM citizen_applications WHERE serviceid=1 GROUP BY is_pcp;
--    SELECT udid_expiry_date IS NOT NULL AS has_expiry, COUNT(*) FROM citizen_applications
--        WHERE serviceid=1 AND is_pcp GROUP BY has_expiry;
--    SELECT COUNT(*) AS shifts FROM application_shifts;