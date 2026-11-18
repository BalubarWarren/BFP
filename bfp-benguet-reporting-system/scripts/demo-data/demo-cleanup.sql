-- =============================================================================
-- FireTrack demonstration data — REMOVE
-- Paste into the Supabase SQL Editor and Run. Deletes every row demo-seed.sql added (and the old
-- SAMPLE- cases), with anything the app attached to those reports since, and puts the dashboard
-- tallies back. Reports that are not demonstration data are never touched.
-- =============================================================================
BEGIN;

-- Removes every row this script added (recorded in _demo_seed_rows), the old SAMPLE- cases of
-- the earlier in-app sample tool, and anything the app attached to those reports since
-- (notifications, audit entries, archived versions, annotations, requests). Puts the hidden
-- dashboard tallies back. Never touches any other report.
CREATE OR REPLACE FUNCTION pg_temp.demo_cleanup() RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  demo_reports int[];
  demo_incidents int[];
BEGIN
  CREATE TABLE IF NOT EXISTS _demo_seed_rows (tbl text NOT NULL, row_id int NOT NULL);

  SELECT coalesce(array_agg(r.id), '{}') INTO demo_reports
  FROM reports r LEFT JOIN incidents i ON i.id = r."incidentId"
  WHERE r.id IN (SELECT row_id FROM _demo_seed_rows WHERE tbl = 'reports')
     OR i."referenceNumber" LIKE 'SAMPLE-%';

  SELECT coalesce(array_agg(id), '{}') INTO demo_incidents
  FROM incidents
  WHERE id IN (SELECT row_id FROM _demo_seed_rows WHERE tbl = 'incidents')
     OR "referenceNumber" LIKE 'SAMPLE-%';

  DELETE FROM notifications WHERE "reportId" = ANY(demo_reports)
     OR id IN (SELECT row_id FROM _demo_seed_rows WHERE tbl = 'notifications');
  DELETE FROM audit_logs WHERE "reportId" = ANY(demo_reports)
     OR id IN (SELECT row_id FROM _demo_seed_rows WHERE tbl = 'audit_logs');
  DELETE FROM trash_items WHERE ("itemType" IN ('REPORT_VERSION', 'REPORT') AND "originalId" = ANY(demo_reports))
     OR id IN (SELECT row_id FROM _demo_seed_rows WHERE tbl = 'trash_items');
  DELETE FROM directives WHERE id IN (SELECT row_id FROM _demo_seed_rows WHERE tbl = 'directives');
  IF to_regclass('public.report_requests') IS NOT NULL THEN
    DELETE FROM report_requests WHERE "reportId" = ANY(demo_reports);
  END IF;
  DELETE FROM annotations WHERE "reportId" = ANY(demo_reports);
  DELETE FROM reports WHERE id = ANY(demo_reports);
  -- A demo case keeps its incident if someone filed their own report under it meanwhile.
  DELETE FROM incidents i WHERE i.id = ANY(demo_incidents)
    AND NOT EXISTS (SELECT 1 FROM reports r WHERE r."incidentId" = i.id);
  DELETE FROM _demo_seed_rows;

  UPDATE daily_report_entries
     SET "reportingOfficer" = substr("reportingOfficer", 19)
   WHERE "reportingOfficer" LIKE '[sample-replaced] %';
  UPDATE daily_report_entries
     SET "reportingOfficer" = 'System Seed'
   WHERE "reportingOfficer" = 'System Seed [replaced by sample reports]';
END
$fn$;

SELECT pg_temp.demo_cleanup();
DROP TABLE IF EXISTS _demo_seed_rows;
COMMIT;
