-- =============================================================================
-- FireTrack demonstration data
-- Paste this whole file into the Supabase SQL Editor and click Run.
--
-- * Removes any earlier demonstration data (this script is safe to run again) and the old
--   SAMPLE- cases, then rebuilds everything.
-- * Turns every dashboard tally into closed, on-time cases with Spot/Progress/Final reports.
-- * For every municipality that has an Investigator, a Municipal Chief IIS and a Municipal Fire
--   Marshal account, adds one case for each workflow scenario (drafts, every review stage,
--   returns with PDF comments, revisions, late submissions with explanations, overdue follow-ups,
--   reopen request, co-investigator, assignments) with matching notifications and audit trail.
-- * Never touches reports that are not demonstration data.
-- To remove it all later, run demo-cleanup.sql.
-- =============================================================================

BEGIN;

-- Reopen / co-investigator requests (migration 20261118120000_add_report_requests), if missing.
CREATE TABLE IF NOT EXISTS "report_requests" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reportId" INTEGER NOT NULL,
    "municipalityId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "targetUserId" INTEGER,
    "reason" TEXT,
    "documentUrl" TEXT,
    "documentName" TEXT,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "report_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "report_requests_reportId_idx" ON "report_requests"("reportId");
CREATE INDEX IF NOT EXISTS "report_requests_municipalityId_status_idx" ON "report_requests"("municipalityId", "status");
CREATE INDEX IF NOT EXISTS "report_requests_targetUserId_status_idx" ON "report_requests"("targetUserId", "status");
DO $$ BEGIN
  ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Every row this script inserts is listed here, so it can be removed exactly.
CREATE TABLE IF NOT EXISTS _demo_seed_rows (tbl text NOT NULL, row_id int NOT NULL);

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

-- Deterministic "random" choices: the same database gets the same demo data every time.
SELECT setseed(0.4242);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.track(p_tbl text, p_id int) RETURNS int LANGUAGE sql AS $fn$
  INSERT INTO _demo_seed_rows (tbl, row_id) VALUES (p_tbl, p_id) RETURNING p_id;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.pick(p text[]) RETURNS text LANGUAGE sql VOLATILE AS $fn$
  SELECT p[1 + floor(random() * array_length(p, 1))::int];
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.rnd(p_lo int, p_hi int) RETURNS int LANGUAGE sql VOLATILE AS $fn$
  SELECT p_lo + floor(random() * (p_hi - p_lo + 1))::int;
$fn$;

-- First (or n-th) active account with a role, in a municipality (NULL = any).
CREATE OR REPLACE FUNCTION pg_temp.u(p_role text, p_mun int, p_nth int DEFAULT 1) RETURNS int LANGUAGE sql AS $fn$
  SELECT id FROM users
   WHERE role = p_role AND "isActive" AND (p_mun IS NULL OR "municipalityId" = p_mun)
   ORDER BY id OFFSET p_nth - 1 LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.barangays(p_mun text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN lower(p_mun) = lower('Atok') THEN ARRAY['Abiang', 'Caliking', 'Cattubo', 'Naguey', 'Paoay', 'Pasdong', 'Poblacion', 'Topdac']::text[]
    WHEN lower(p_mun) = lower('Bakun') THEN ARRAY['Ampusongan', 'Bagu', 'Dalipey', 'Gambang', 'Kayapa', 'Poblacion (Central)', 'Sinacbat']::text[]
    WHEN lower(p_mun) = lower('Bokod') THEN ARRAY['Ambuclao', 'Bila', 'Bobok-Bisal', 'Daclan', 'Ekip', 'Karao', 'Nawal', 'Pito', 'Poblacion', 'Tikey']::text[]
    WHEN lower(p_mun) = lower('Buguias') THEN ARRAY['Abatan', 'Amgaleyguey', 'Amlimay', 'Baculongan Norte', 'Baculongan Sur', 'Bangao', 'Buyacaoan', 'Calamagan', 'Catlubong', 'Lengaoan', 'Loo', 'Natubleng', 'Poblacion (Central)', 'Sebang']::text[]
    WHEN lower(p_mun) = lower('Itogon') THEN ARRAY['Ampucao', 'Dalupirip', 'Gumatdang', 'Loacan', 'Poblacion (Central)', 'Tinongdan', 'Tuding', 'Ucab', 'Virac']::text[]
    WHEN lower(p_mun) = lower('Kabayan') THEN ARRAY['Adaoay', 'Anchukey', 'Ballay', 'Bashoy', 'Batan', 'Duacan', 'Eddet', 'Gusaran', 'Kabayan Barrio', 'Lusod', 'Pacso', 'Poblacion (Central)', 'Tawangan']::text[]
    WHEN lower(p_mun) = lower('Kapangan') THEN ARRAY['Balakbak', 'Beleng-Belis', 'Boklaoan', 'Cayapes', 'Cuba', 'Datakan', 'Gadang', 'Gasweling', 'Labueg', 'Paykek', 'Poblacion Central', 'Pongayan', 'Pudong', 'Sagubo', 'Taba-ao']::text[]
    WHEN lower(p_mun) = lower('Kibungan') THEN ARRAY['Badeo', 'Lubo', 'Madaymen', 'Palina', 'Poblacion', 'Sagpat', 'Tacadang']::text[]
    WHEN lower(p_mun) = lower('La Trinidad') THEN ARRAY['Alapang', 'Alno', 'Ambiong', 'Bahong', 'Balili', 'Beckel', 'Betag', 'Bineng', 'Cruz', 'Lubas', 'Pico', 'Poblacion', 'Puguis', 'Shilan', 'Tawang', 'Wangal']::text[]
    WHEN lower(p_mun) = lower('Mankayan') THEN ARRAY['Balili', 'Bedbed', 'Bulalacao', 'Cabiten', 'Colalo', 'Guinaoang', 'Paco', 'Palasaan', 'Poblacion', 'Sapid', 'Tabio', 'Taneg']::text[]
    WHEN lower(p_mun) = lower('Sablan') THEN ARRAY['Bagong', 'Balluay', 'Banangan', 'Banengbeng', 'Bayabas', 'Kamog', 'Pappa', 'Poblacion']::text[]
    WHEN lower(p_mun) = lower('Tuba') THEN ARRAY['Ansagan', 'Camp 3', 'Camp 4', 'Camp One', 'Nangalisan', 'Poblacion', 'San Pascual', 'Tabaan Norte', 'Tabaan Sur', 'Tadiangan', 'Taloy Norte', 'Taloy Sur', 'Twin Peaks']::text[]
    WHEN lower(p_mun) = lower('Tublay') THEN ARRAY['Ambassador', 'Ambongdolan', 'Ba-ayan', 'Basil', 'Caponga (Poblacion)', 'Daclan', 'Tublay Central', 'Tuel']::text[]
    ELSE ARRAY['Poblacion']::text[]
  END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.subcats(p_cat text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE p_cat
    WHEN 'RESIDENTIAL' THEN ARRAY['Apartment Building', 'Condominiums', 'Dormitory', 'Hotel', 'Lodging and Rooming Houses', 'Single and Two Family Dwelling']::text[]
    WHEN 'NON_RESIDENTIAL' THEN ARRAY['Assembly', 'Business', 'Day Care', 'Detention and Correctional', 'Educational', 'Health Care', 'Industrial', 'Mercantile', 'Mixed Occupancies', 'Residential Board and Care', 'Special Structures', 'Storage']::text[]
    WHEN 'NON_STRUCTURAL' THEN ARRAY['Agricultural Land', 'Ambulant Vendor', 'Electrical Pole', 'Forest', 'Grass', 'Rubbish']::text[]
    WHEN 'TRANSPORT' THEN ARRAY['Aircraft', 'Automobile', 'Bus', 'Heavy Equipment', 'Jeepney', 'Locomotive', 'Motorcycle', 'Ship / Water Vessel', 'Tricycle', 'Truck']::text[]
  END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.centre(p_mun text) RETURNS float8[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN lower(p_mun) = lower('Atok') THEN ARRAY[16.58, 120.7]::float8[]
    WHEN lower(p_mun) = lower('Bakun') THEN ARRAY[16.8, 120.66]::float8[]
    WHEN lower(p_mun) = lower('Bokod') THEN ARRAY[16.49, 120.83]::float8[]
    WHEN lower(p_mun) = lower('Buguias') THEN ARRAY[16.72, 120.82]::float8[]
    WHEN lower(p_mun) = lower('Itogon') THEN ARRAY[16.367, 120.677]::float8[]
    WHEN lower(p_mun) = lower('Kabayan') THEN ARRAY[16.62, 120.85]::float8[]
    WHEN lower(p_mun) = lower('Kapangan') THEN ARRAY[16.58, 120.6]::float8[]
    WHEN lower(p_mun) = lower('Kibungan') THEN ARRAY[16.69, 120.65]::float8[]
    WHEN lower(p_mun) = lower('La Trinidad') THEN ARRAY[16.455, 120.587]::float8[]
    WHEN lower(p_mun) = lower('Mankayan') THEN ARRAY[16.86, 120.79]::float8[]
    WHEN lower(p_mun) = lower('Sablan') THEN ARRAY[16.497, 120.488]::float8[]
    WHEN lower(p_mun) = lower('Tuba') THEN ARRAY[16.32, 120.56]::float8[]
    WHEN lower(p_mun) = lower('Tublay') THEN ARRAY[16.476, 120.63]::float8[]
    ELSE ARRAY[16.45, 120.6]::float8[]
  END;
$fn$;

-- A moment in Philippine time, p_days before today, at p_hour:p_min.
CREATE OR REPLACE FUNCTION pg_temp.ph(p_days int, p_hour int, p_min int DEFAULT 0) RETURNS timestamptz LANGUAGE sql AS $fn$
  SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Manila') - p_days * interval '1 day'
          + p_hour * interval '1 hour' + p_min * interval '1 minute') AT TIME ZONE 'Asia/Manila';
$fn$;

-- Next reference number BFP-BEN-<year>-NNN, continuing the year's existing numbers.
CREATE TEMP TABLE IF NOT EXISTS demo_ref_counter (yr int PRIMARY KEY, n int NOT NULL);
CREATE OR REPLACE FUNCTION pg_temp.next_ref(p_year int) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v int;
BEGIN
  SELECT n INTO v FROM demo_ref_counter WHERE yr = p_year;
  IF v IS NULL THEN
    SELECT coalesce(max(substring("referenceNumber" FROM '^BFP-BEN-[0-9]{4}-([0-9]+)$')::int), 0) INTO v
      FROM incidents WHERE "referenceNumber" LIKE 'BFP-BEN-' || p_year || '-%';
    INSERT INTO demo_ref_counter VALUES (p_year, v);
  END IF;
  v := v + 1;
  UPDATE demo_ref_counter SET n = v WHERE yr = p_year;
  RETURN 'BFP-BEN-' || p_year || '-' || lpad(v::text, 3, '0');
END
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.audit(p_action text, p_user int, p_report int, p_changes jsonb, p_at timestamptz)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v int;
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  INSERT INTO audit_logs (action, "userId", "reportId", changes, "createdAt")
  VALUES (p_action, p_user, p_report, p_changes::text, p_at) RETURNING id INTO v;
  PERFORM pg_temp.track('audit_logs', v);
END
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.notify(p_user int, p_report int, p_type text, p_message text, p_at timestamptz)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v int;
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  INSERT INTO notifications ("userId", "reportId", type, message, "isRead", "createdAt")
  VALUES (p_user, p_report, p_type, p_message, p_at < now() - interval '3 days', p_at) RETURNING id INTO v;
  PERFORM pg_temp.track('notifications', v);
END
$fn$;

-- A reviewer's comment pinned to one line of a generated PDF (row index, see lib/sample-pdf.js:
-- first row baseline 704 pt from the bottom, 15 pt per row; page 595 x 842).
CREATE OR REPLACE FUNCTION pg_temp.annotate(p_report int, p_url text, p_author int, p_row int, p_text text, p_comment text, p_at timestamptz)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  base float8 := 704 - 15 * p_row;
  rect jsonb := jsonb_build_object('x1', 56, 'y1', 842 - (base + 10), 'x2', 470, 'y2', 842 - (base - 3), 'width', 595, 'height', 842, 'pageNumber', 1);
  v int;
BEGIN
  INSERT INTO annotations ("reportId", "attachmentUrl", "authorId", comment, "highlightData", "createdAt")
  VALUES (p_report, p_url, p_author, p_comment,
          jsonb_build_object('position', jsonb_build_object('boundingRect', rect, 'rects', jsonb_build_array(rect), 'pageNumber', 1),
                             'content', jsonb_build_object('text', p_text))::text,
          p_at)
  RETURNING id INTO v;
  PERFORM pg_temp.track('annotations', v);
END
$fn$;

-- One fire: the incident (case). Casualties and damage depend on the classification.
CREATE OR REPLACE FUNCTION pg_temp.mk_case(p_mun int, p_fire timestamptz, p_cat text, p_creator int)
RETURNS int LANGUAGE plpgsql AS $fn$
DECLARE
  mun_name text;
  local_ts timestamp := p_fire AT TIME ZONE 'Asia/Manila';
  sub text := pg_temp.pick(pg_temp.subcats(p_cat));
  brgy text;
  addr text := pg_temp.pick(ARRAY['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5','Sitio Proper','Sitio Centro','Sitio Upper','near the barangay hall','near the public market','along the national road','near the elementary school','beside the chapel','near the basketball court']);
  inj int := 0; fat int := 0; dmg numeric;
  v int;
BEGIN
  SELECT name INTO mun_name FROM municipalities WHERE id = p_mun;
  brgy := pg_temp.pick(pg_temp.barangays(mun_name));
  IF p_cat = 'RESIDENTIAL' THEN
    IF random() < 0.25 THEN inj := pg_temp.rnd(1, 3); END IF;
    IF random() < 0.05 THEN fat := 1; END IF;
    dmg := pg_temp.rnd(50, 1500) * 1000;
  ELSIF p_cat = 'NON_RESIDENTIAL' THEN
    IF random() < 0.2 THEN inj := pg_temp.rnd(1, 4); END IF;
    IF random() < 0.04 THEN fat := 1; END IF;
    dmg := pg_temp.rnd(100, 5000) * 1000;
  ELSIF p_cat = 'TRANSPORT' THEN
    IF random() < 0.3 THEN inj := pg_temp.rnd(1, 2); END IF;
    IF random() < 0.06 THEN fat := 1; END IF;
    dmg := pg_temp.rnd(30, 600) * 1000;
  ELSE
    IF random() < 0.03 THEN inj := 1; END IF;
    dmg := pg_temp.rnd(0, 20) * 1000;
  END IF;

  INSERT INTO incidents ("referenceNumber", "municipalityId", "dateOfIncident", "timeOfIncident", barangay, address,
                         "generalCategory", "subCategory", description, status, "casualtiesInjured", "casualtiesFatalities",
                         "estimatedDamage", "createdById", "createdAt", "updatedAt")
  VALUES (pg_temp.next_ref(extract(year FROM local_ts)::int), p_mun, local_ts::date::timestamp, to_char(local_ts, 'HH24:MI'),
          brgy, addr, p_cat, sub,
          'Fire involving a ' || lower(sub) || CASE WHEN addr ~ '^(Purok|Sitio)' THEN ' at ' ELSE ' ' END || addr || ', Brgy. ' || brgy || ', ' || mun_name ||
          '. Responding units contained and extinguished the fire; the area was cleared and turned over for investigation.',
          'EXTINGUISHED', inj, fat, dmg, p_creator, p_fire + interval '3 hours', p_fire + interval '3 hours')
  RETURNING id INTO v;
  RETURN pg_temp.track('incidents', v);
END
$fn$;

-- One report of a case, at a given point of the review chain.
--   p_stage: DRAFT | AT_CHIEF | RETURNED_CHIEF | APPROVED_CHIEF | AT_MARSHAL | APPROVED_MARSHAL |
--            AT_PROVINCIAL | RETURNED_PROVINCIAL | FINAL
--   p_step:  time each review takes; forwarding takes half a step.
--   p_activity: also write the audit trail and notifications (workflow scenarios).
-- Returns the report id and, when finalized, the moment of final approval.
CREATE OR REPLACE FUNCTION pg_temp.mk_report(
  p_inc int, p_type text, p_stage text, p_inv int, p_chief int, p_marshal int, p_prov int,
  p_sub timestamptz, p_step interval, p_extra jsonb DEFAULT '{}'::jsonb, p_remarks text DEFAULT NULL,
  p_activity boolean DEFAULT false, OUT rid int, OUT done_at timestamptz)
LANGUAGE plpgsql AS $fn$
DECLARE
  inc incidents%ROWTYPE;
  mun_name text;
  inv_name text; inv_rank text; marshal_name text;
  t_chief timestamptz := p_sub + p_step;
  t_fwd1 timestamptz := p_sub + p_step * 1.5;
  t_marshal timestamptz := p_sub + p_step * 2.5;
  t_fwd2 timestamptz := p_sub + p_step * 3;
  t_prov timestamptz := p_sub + p_step * 4;
  v_status text; v_to_role text; v_to int; v_rev int; v_rev_at timestamptz; v_updated timestamptz;
  file text := CASE p_type WHEN 'SPOT_INVESTIGATION' THEN 'spot' WHEN 'PROGRESS_INVESTIGATION' THEN 'progress' ELSE 'final' END;
  title text := CASE p_type WHEN 'SPOT_INVESTIGATION' THEN 'Spot' WHEN 'PROGRESS_INVESTIGATION' THEN 'Progress' ELSE 'Final' END;
  base_url text;
  files jsonb;
  content jsonb := jsonb_build_object('demo', true);
  centre float8[];
  type_label text := replace(p_type, '_', ' ');
BEGIN
  SELECT * INTO inc FROM incidents WHERE id = p_inc;
  SELECT name INTO mun_name FROM municipalities WHERE id = inc."municipalityId";
  SELECT name, coalesce(rank, 'FO2') INTO inv_name, inv_rank FROM users WHERE id = p_inv;
  SELECT name INTO marshal_name FROM users WHERE id = p_marshal;
  base_url := '/api/case-files/' || inc."referenceNumber" || '/';

  files := jsonb_build_array(jsonb_build_object('name', title || ' Investigation Report - ' || inc."referenceNumber" || '.pdf',
                                                'type', 'application/pdf', 'size', 48213, 'url', base_url || file || '.pdf'));
  IF p_type = 'SPOT_INVESTIGATION' AND inc."casualtiesInjured" + inc."casualtiesFatalities" > 0 THEN
    files := files || jsonb_build_object('name', 'EMS Report - ' || inc."referenceNumber" || '.pdf', 'type', 'application/pdf',
                                         'size', 30117, 'url', base_url || 'ems.pdf', 'kind', 'EMS');
  END IF;
  IF p_type = 'PROGRESS_INVESTIGATION' THEN
    files := files || jsonb_build_object('name', 'Laboratory Result - ' || inc."referenceNumber" || '.pdf', 'type', 'application/pdf',
                                         'size', 26880, 'url', base_url || 'laboratory.pdf', 'kind', 'SUPPORTING',
                                         'docType', 'Specimen / Laboratory Result');
  END IF;
  IF p_type = 'FINAL_INVESTIGATION' THEN
    files := files || jsonb_build_object('name', 'Fire Incident Certificate - ' || inc."referenceNumber" || '.pdf', 'type', 'application/pdf',
                                         'size', 21544, 'url', base_url || 'certificate.pdf', 'kind', 'SUPPORTING',
                                         'docType', 'Fire Incident Certificate');
  END IF;

  IF p_type = 'SPOT_INVESTIGATION' THEN
    centre := pg_temp.centre(mun_name);
    content := content || jsonb_build_object(
      'dateOfIncident', to_char(inc."dateOfIncident", 'YYYY-MM-DD'),
      'timeOfIncident', inc."timeOfIncident",
      'description', inc.description,
      'barangay', inc.barangay,
      'address', inc.address,
      'casualtiesInjured', inc."casualtiesInjured",
      'casualtiesFatalities', inc."casualtiesFatalities",
      'rescueOperations', CASE WHEN inc."casualtiesInjured" + inc."casualtiesFatalities" > 0 THEN pg_temp.rnd(1, 3)
                               WHEN random() < 0.1 THEN 1 ELSE 0 END,
      'propertyType', CASE inc."generalCategory" WHEN 'RESIDENTIAL' THEN 'Single-family house'
                        WHEN 'NON_RESIDENTIAL' THEN 'Commercial establishment'
                        WHEN 'TRANSPORT' THEN 'Vehicle' ELSE 'Grassland / Forest' END,
      'establishmentName', CASE WHEN inc."generalCategory" = 'NON_RESIDENTIAL'
                             THEN pg_temp.pick(ARRAY['Dela Cruz','Bautista','Kiwas','Bayang','Tamang','Lumbaya','Sacla','Dangwa']) || ' ' || inc."subCategory" ELSE '' END,
      'ownerName', pg_temp.pick(ARRAY['Juan','Maria','Jose','Ana','Pedro','Rosa','Mark','Grace','Ramon','Liza','Carlo','Joy']) || ' ' ||
                   pg_temp.pick(ARRAY['Dela Cruz','Bautista','Kiwas','Bayang','Tamang','Calpito','Dumalo','Lumbaya','Pacio','Sacla','Ayochok','Dangwa']),
      'occupantName', '',
      'numberOfStoreys', CASE WHEN inc."generalCategory" IN ('RESIDENTIAL','NON_RESIDENTIAL') THEN pg_temp.rnd(1, 3) ELSE NULL END
    );
    IF random() < 0.6 THEN
      content := content || jsonb_build_object('latitude', round((centre[1] + (random() - 0.5) * 0.04)::numeric, 6),
                                               'longitude', round((centre[2] + (random() - 0.5) * 0.04)::numeric, 6));
    END IF;
  END IF;
  content := content || p_extra;

  -- Where the report is now.
  v_status := 'SUBMITTED'; v_to_role := NULL; v_to := NULL; v_rev := NULL; v_rev_at := NULL; v_updated := p_sub;
  CASE p_stage
    WHEN 'DRAFT' THEN v_status := 'DRAFT';
    WHEN 'AT_CHIEF' THEN v_to_role := 'MUNICIPAL_CHIEF_IIS'; v_to := p_chief;
    WHEN 'RETURNED_CHIEF' THEN v_status := 'RETURNED'; v_to_role := 'INVESTIGATOR'; v_to := p_inv; v_rev := p_chief; v_rev_at := t_chief;
    WHEN 'APPROVED_CHIEF' THEN v_status := 'APPROVED'; v_to_role := 'INVESTIGATOR'; v_to := p_inv; v_rev := p_chief; v_rev_at := t_chief;
    WHEN 'AT_MARSHAL' THEN v_to_role := 'MUNICIPAL_FIRE_MARSHAL'; v_to := p_marshal; v_rev := p_chief; v_rev_at := t_chief; v_updated := t_fwd1;
    WHEN 'APPROVED_MARSHAL' THEN v_status := 'APPROVED'; v_to_role := 'INVESTIGATOR'; v_to := p_inv; v_rev := p_marshal; v_rev_at := t_marshal;
    WHEN 'AT_PROVINCIAL' THEN v_to_role := 'PROVINCIAL_CHIEF_IIS'; v_to := p_prov; v_rev := p_marshal; v_rev_at := t_marshal; v_updated := t_fwd2;
    WHEN 'RETURNED_PROVINCIAL' THEN v_status := 'RETURNED'; v_to_role := 'INVESTIGATOR'; v_to := p_inv; v_rev := p_prov; v_rev_at := t_prov;
    WHEN 'FINAL' THEN v_status := 'APPROVED'; v_rev := p_prov; v_rev_at := t_prov; done_at := t_prov;
  END CASE;
  v_updated := greatest(v_updated, coalesce(v_rev_at, v_updated));

  INSERT INTO reports ("reportType", status, "municipalityId", "incidentId", "reportDate", content, category,
                       "respondingUnits", "respondingOfficer", "reportingOfficerRank", "stationCommanderName", remarks,
                       "passedToRole", "passedToId", "submittedAt", "reviewedAt", "reviewedById", "submittedById",
                       attachments, "qrToken", "createdAt", "updatedAt")
  VALUES (p_type, v_status, inc."municipalityId", p_inc,
          CASE WHEN p_type = 'SPOT_INVESTIGATION' THEN inc."dateOfIncident" ELSE (p_sub AT TIME ZONE 'Asia/Manila')::date::timestamp END,
          content::text, CASE WHEN p_type = 'SPOT_INVESTIGATION' THEN inc."generalCategory" END,
          mun_name || ' Fire Station - Engine ' || pg_temp.rnd(1, 2), inv_name, inv_rank, marshal_name,
          CASE WHEN p_stage IN ('RETURNED_CHIEF', 'RETURNED_PROVINCIAL') THEN p_remarks END,
          v_to_role, v_to, p_sub, v_rev_at, v_rev, p_inv, files::text,
          CASE WHEN v_status <> 'DRAFT' THEN md5(random()::text || clock_timestamp()::text) || md5(random()::text) END,
          p_sub, v_updated)
  RETURNING id INTO rid;
  PERFORM pg_temp.track('reports', rid);

  -- The Final report records the cause of fire on the case.
  IF p_type = 'FINAL_INVESTIGATION' AND content ? 'causeOfFire' THEN
    UPDATE incidents SET "causeOfFire" = content->>'causeOfFire', "updatedAt" = p_sub WHERE id = p_inc;
  END IF;

  IF NOT p_activity OR p_stage = 'DRAFT' THEN RETURN; END IF;

  -- Audit trail of every review that happened, and the notifications people would have received.
  IF p_stage <> 'AT_CHIEF' THEN
    PERFORM pg_temp.audit(CASE WHEN p_stage = 'RETURNED_CHIEF' THEN 'RETURN_REPORT' ELSE 'APPROVE_REPORT' END, p_chief, rid,
      jsonb_build_object('reviewerRole', 'MUNICIPAL_CHIEF_IIS', 'remarks', CASE WHEN p_stage = 'RETURNED_CHIEF' THEN p_remarks END), t_chief);
  END IF;
  IF p_stage IN ('APPROVED_MARSHAL', 'AT_PROVINCIAL', 'RETURNED_PROVINCIAL', 'FINAL') THEN
    PERFORM pg_temp.audit('APPROVE_REPORT', p_marshal, rid, jsonb_build_object('reviewerRole', 'MUNICIPAL_FIRE_MARSHAL', 'remarks', NULL), t_marshal);
  END IF;
  IF p_stage IN ('RETURNED_PROVINCIAL', 'FINAL') THEN
    PERFORM pg_temp.audit(CASE WHEN p_stage = 'FINAL' THEN 'APPROVE_REPORT' ELSE 'RETURN_REPORT' END, p_prov, rid,
      jsonb_build_object('reviewerRole', 'PROVINCIAL_CHIEF_IIS', 'remarks', CASE WHEN p_stage = 'RETURNED_PROVINCIAL' THEN p_remarks END), t_prov);
  END IF;

  CASE p_stage
    WHEN 'AT_CHIEF' THEN
      PERFORM pg_temp.notify(p_chief, rid, 'REPORT_SUBMITTED', 'New ' || p_type || ' report submitted by ' || inv_name, p_sub);
    WHEN 'RETURNED_CHIEF' THEN
      PERFORM pg_temp.notify(p_inv, rid, 'REPORT_RETURNED', 'Your report from ' || mun_name || ' was returned for revision: ' || p_remarks, t_chief);
    WHEN 'APPROVED_CHIEF' THEN
      PERFORM pg_temp.notify(p_inv, rid, 'REPORT_APPROVED', 'Your ' || p_type || ' report has been approved by Municipal Chief IIS. Please submit it to the Municipal Fire Marshal.', t_chief);
    WHEN 'AT_MARSHAL' THEN
      PERFORM pg_temp.notify(p_marshal, rid, 'REPORT_SUBMITTED', 'A ' || p_type || ' report from ' || mun_name || ' is awaiting your review.', t_fwd1);
    WHEN 'APPROVED_MARSHAL' THEN
      PERFORM pg_temp.notify(p_inv, rid, 'REPORT_APPROVED', 'Your ' || p_type || ' report has been approved by Municipal Fire Marshal. Please submit it to the Provincial Chief IIS.', t_marshal);
    WHEN 'AT_PROVINCIAL' THEN
      PERFORM pg_temp.notify(p_prov, rid, 'REPORT_SUBMITTED', 'A ' || p_type || ' report from ' || mun_name || ' is awaiting your review.', t_fwd2);
    WHEN 'RETURNED_PROVINCIAL' THEN
      PERFORM pg_temp.notify(p_inv, rid, 'REPORT_RETURNED', 'Your report from ' || mun_name || ' was returned for revision: ' || p_remarks, t_prov);
    WHEN 'FINAL' THEN
      PERFORM pg_temp.notify(p_inv, rid, 'REPORT_APPROVED', 'Your report from ' || mun_name || ' has been approved by Provincial Chief IIS.', t_prov);
  END CASE;
END
$fn$;

-- Saves a returned report's current state to the Report Archive (as the app does when the
-- investigator revises it), then resubmits it to the Municipal Chief IIS with correction notes.
CREATE OR REPLACE FUNCTION pg_temp.revise(p_report int, p_inv int, p_chief int, p_at timestamptz, p_notes text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE r reports%ROWTYPE; mun_name text; inv_name text; v int;
BEGIN
  SELECT * INTO r FROM reports WHERE id = p_report;
  SELECT name INTO mun_name FROM municipalities WHERE id = r."municipalityId";
  SELECT name INTO inv_name FROM users WHERE id = p_inv;
  INSERT INTO trash_items ("itemType", "originalId", label, data, "ownerId", "municipalityId", "deletedById", "deletedByName", "deletedAt", "expiresAt")
  VALUES ('REPORT_VERSION', r.id, initcap(lower(replace(r."reportType", '_', ' '))) || ' report — ' || mun_name,
          jsonb_build_object('report', to_jsonb(r),
                             'annotations', coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM annotations a WHERE a."reportId" = r.id), '[]'::jsonb),
                             'version', 1)::text,
          r."submittedById", r."municipalityId", p_inv, inv_name, p_at, '9999-12-31')
  RETURNING id INTO v;
  PERFORM pg_temp.track('trash_items', v);
  PERFORM pg_temp.audit('ARCHIVE_REPORT_VERSION', p_inv, r.id,
    jsonb_build_object('reportType', r."reportType", 'version', 1, 'remarks', r.remarks), p_at);
  UPDATE reports
     SET status = 'SUBMITTED', "passedToRole" = 'MUNICIPAL_CHIEF_IIS', "passedToId" = p_chief,
         content = (content::jsonb || jsonb_build_object('corrections', p_notes))::text, "updatedAt" = p_at
   WHERE id = r.id;
  PERFORM pg_temp.notify(p_chief, r.id, 'REPORT_SUBMITTED', 'A ' || r."reportType" || ' report from ' || mun_name || ' is awaiting your review.', p_at);
END
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.cat() RETURNS text LANGUAGE sql VOLATILE AS $fn$
  SELECT pg_temp.pick(ARRAY['RESIDENTIAL','RESIDENTIAL','NON_RESIDENTIAL','NON_STRUCTURAL','NON_STRUCTURAL','TRANSPORT']);
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.cause() RETURNS text LANGUAGE sql VOLATILE AS $fn$
  SELECT pg_temp.pick(ARRAY['Faulty electrical wiring', 'Overloaded electrical connection', 'Unattended cooking', 'LPG leak', 'Open flame (candle, kerosene lamp)', 'Lighted cigarette', 'Rubbish / kaingin burning', 'Children playing with fire', 'Vehicle malfunction', 'Spontaneous combustion', 'Lightning', 'Arson (intentional)']::text[]);
$fn$;

-- ---------------------------------------------------------------------------------------------
-- 1. Workflow scenarios — one case each, for every municipality with a full set of accounts
-- ---------------------------------------------------------------------------------------------
DO $main$
DECLARE
  m record;
  inv int; inv2 int; chief int; marshal int; prov int;
  inc int; r int; r2 int; t timestamptz; t2 timestamptz; t_sub timestamptz;
  ref text; created int := 0; skipped text := '';
  d1 interval := interval '1 day';
BEGIN
  prov := coalesce(pg_temp.u('PROVINCIAL_CHIEF_IIS', NULL), pg_temp.u('SUPER_ADMIN', NULL), pg_temp.u('ADMIN', NULL));

  FOR m IN SELECT id, name FROM municipalities ORDER BY name LOOP
    inv := pg_temp.u('INVESTIGATOR', m.id);
    inv2 := pg_temp.u('INVESTIGATOR', m.id, 2);
    chief := pg_temp.u('MUNICIPAL_CHIEF_IIS', m.id);
    marshal := pg_temp.u('MUNICIPAL_FIRE_MARSHAL', m.id);
    IF inv IS NULL OR chief IS NULL OR marshal IS NULL OR prov IS NULL THEN
      skipped := skipped || m.name || ' ';
      CONTINUE;
    END IF;

    -- S1 Draft Spot report, not yet submitted.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(1, 10, 20), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'DRAFT', inv, chief, marshal, prov, pg_temp.ph(1, 15, 5), d1, '{}', NULL, true);

    -- S2 Spot report just submitted on time, waiting for the Municipal Chief IIS.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(1, 6, 40), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'AT_CHIEF', inv, chief, marshal, prov, pg_temp.ph(1, 13, 30), d1, '{}', NULL, true);

    -- S3 Spot report submitted LATE (beyond 24 hours) with its Explanation Report.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(4, 14, 10), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'AT_CHIEF', inv, chief, marshal, prov, pg_temp.ph(2, 16, 45), d1,
      jsonb_build_object('lateExplanation', 'The investigation team was deployed to a simultaneous grass fire in an adjacent barangay and the scene could only be processed the following day. The report was prepared immediately after the scene examination.', 'submittedLate', true),
      NULL, true);

    -- S4 Spot report RETURNED by the Municipal Chief IIS, with comments on the PDF.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(6, 9, 15), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'RETURNED_CHIEF', inv, chief, marshal, prov, pg_temp.ph(6, 17, 0), d1, '{}',
      'Please indicate the exact location of the fire and attach the EMS report for the injured occupant.', true);
    SELECT '/api/case-files/' || "referenceNumber" || '/spot.pdf' INTO ref FROM incidents WHERE id = inc;
    PERFORM pg_temp.annotate(r, ref, chief, 3, 'Place of incident', 'Specify the purok or nearest landmark, not only the barangay.', pg_temp.ph(5, 17, 10));
    PERFORM pg_temp.annotate(r, ref, chief, 6, 'Casualties', 'Confirm the number of injured with the EMS team and attach their report.', pg_temp.ph(5, 17, 12));

    -- S5 Returned, REVISED and resubmitted (earlier version kept in the Report Archive).
    inc := pg_temp.mk_case(m.id, pg_temp.ph(12, 20, 30), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'RETURNED_CHIEF', inv, chief, marshal, prov, pg_temp.ph(11, 8, 0), d1, '{}',
      'Classification does not match the narrative. Please review the sub-category.', true);
    SELECT '/api/case-files/' || "referenceNumber" || '/spot.pdf' INTO ref FROM incidents WHERE id = inc;
    PERFORM pg_temp.annotate(r, ref, chief, 5, 'Classification', 'The narrative describes a different occupancy. Please correct the sub-category.', pg_temp.ph(10, 8, 5));
    PERFORM pg_temp.revise(r, inv, chief, pg_temp.ph(9, 10, 0), 'Sub-category corrected after re-checking the occupancy with the barangay officials.');

    -- S6 Approved by the Municipal Chief IIS, waiting for the investigator to forward it.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(7, 11, 0), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'APPROVED_CHIEF', inv, chief, marshal, prov, pg_temp.ph(7, 18, 0), interval '20 hours', '{}', NULL, true);
    -- ...shared with a second investigator by Letter of Order (co-investigator), when there is one.
    IF inv2 IS NOT NULL THEN
      SELECT "referenceNumber" INTO ref FROM incidents WHERE id = inc;
      INSERT INTO report_requests (type, status, "reportId", "municipalityId", "requestedById", "targetUserId", reason,
                                   "documentUrl", "documentName", "decidedById", "decidedAt", "decisionNote", "createdAt", "updatedAt")
      VALUES ('COLLABORATOR', 'APPROVED', r, m.id, inv, inv2, 'Assist in interviewing witnesses and preparing the follow-up reports.',
              '/api/case-files/' || ref || '/letter-of-order.pdf', 'Letter of Order - ' || ref || '.pdf',
              chief, pg_temp.ph(5, 9, 0), 'Approved per Letter of Order.', pg_temp.ph(6, 15, 0), pg_temp.ph(5, 9, 0))
      RETURNING id INTO r2;
      PERFORM pg_temp.track('report_requests', r2);
      PERFORM pg_temp.notify(inv2, r, 'REPORT_REQUEST_DECIDED', 'You were added as co-investigator on report #' || r || ' by Letter of Order. It now appears in My Reports.', pg_temp.ph(5, 9, 0));
    END IF;

    -- S7 Forwarded, waiting for the Municipal Fire Marshal.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(9, 8, 30), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'AT_MARSHAL', inv, chief, marshal, prov, pg_temp.ph(9, 15, 0), interval '18 hours', '{}', NULL, true);

    -- S8 Approved by the Fire Marshal, waiting for the investigator to forward it to the province.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(11, 13, 0), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'APPROVED_MARSHAL', inv, chief, marshal, prov, pg_temp.ph(11, 19, 0), interval '20 hours', '{}', NULL, true);

    -- S9 Forwarded, waiting for the Provincial Chief IIS.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(5, 16, 0), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'AT_PROVINCIAL', inv, chief, marshal, prov, pg_temp.ph(5, 21, 0), interval '18 hours', '{}', NULL, true);

    -- S10 Spot report finalized recently; Progress report not yet due. The Fire Marshal has assigned it.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(4, 10, 0), pg_temp.cat(), inv);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(4, 15, 0), interval '14 hours', '{}', NULL, true);
    SELECT "referenceNumber" INTO ref FROM incidents WHERE id = inc;
    INSERT INTO directives (kind, status, "municipalityId", "senderId", "recipientId", "reportType", message, "dueAt", "createdAt", "updatedAt")
    VALUES ('ASSIGNMENT', 'PENDING', m.id, marshal, inv, 'PROGRESS_INVESTIGATION',
            'Prepare and submit the Progress Investigation Report for ' || ref || '.', t + interval '7 days', t + interval '2 hours', t + interval '2 hours')
    RETURNING id INTO r2;
    PERFORM pg_temp.track('directives', r2);
    PERFORM pg_temp.notify(inv, NULL, 'DIRECTIVE_RECEIVED', 'New assignment from your Fire Marshal: prepare the Progress Investigation Report for ' || ref || '.', t + interval '2 hours');

    -- S11 Spot report finalized long ago and NO follow-up filed: next report overdue (red flag).
    inc := pg_temp.mk_case(m.id, pg_temp.ph(26, 9, 0), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(26, 14, 0), d1, '{}', NULL, true);

    -- S12 Progress report submitted on time, waiting for the Municipal Chief IIS.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(14, 13, 0), pg_temp.cat(), inv);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(14, 19, 0), d1, '{}', NULL, true);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'AT_CHIEF', inv, chief, marshal, prov, t + interval '5 days', d1, '{}', NULL, true);

    -- S13 Spot and Progress finalized; Final report is the next step (not yet due).
    inc := pg_temp.mk_case(m.id, pg_temp.ph(40, 10, 0), pg_temp.cat(), inv);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(40, 16, 0), d1, '{}', NULL, true);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t + interval '5 days', d1, '{}', NULL, true);

    -- S14 Final report waiting for the Provincial Chief IIS.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(55, 15, 0), pg_temp.cat(), inv);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(55, 20, 0), d1, '{}', NULL, true);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t + interval '4 days', d1, '{}', NULL, true);
    t_sub := greatest(t + interval '30 days', now() - interval '4 days');
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'FINAL_INVESTIGATION', 'AT_PROVINCIAL', inv, chief, marshal, prov, t_sub, interval '20 hours',
      jsonb_build_object('causeOfFire', pg_temp.cause()), NULL, true);

    -- S15 Closed case: Spot -> Progress -> Final, all finalized on time.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(120, 10, 0), pg_temp.cat(), inv);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(120, 15, 0), d1, '{}', NULL, true);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t + interval '4 days', d1, '{}', NULL, true);
    SELECT rid, done_at INTO r2, t2 FROM pg_temp.mk_report(inc, 'FINAL_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t + interval '28 days', d1,
      jsonb_build_object('causeOfFire', pg_temp.cause()), NULL, true);
    SELECT "referenceNumber" INTO ref FROM incidents WHERE id = inc;
    INSERT INTO directives (kind, status, "municipalityId", "senderId", "recipientId", "reportType", message, "dueAt", response, "respondedAt", "createdAt", "updatedAt")
    VALUES ('ASSIGNMENT', 'COMPLETED', m.id, marshal, inv, 'FINAL_INVESTIGATION',
            'Complete the Final Investigation Report for ' || ref || '.', t + interval '45 days',
            'Final Investigation Report submitted for review.', t + interval '28 days', t + interval '1 day', t + interval '28 days')
    RETURNING id INTO r2;
    PERFORM pg_temp.track('directives', r2);

    -- S16 Closed case that SKIPPED the Progress report (source of ignition identified at once).
    inc := pg_temp.mk_case(m.id, pg_temp.ph(95, 14, 0), pg_temp.cat(), inv);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(95, 19, 0), d1, '{}', NULL, true);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'FINAL_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t + interval '25 days', d1,
      jsonb_build_object('causeOfFire', pg_temp.cause()), NULL, true);

    -- S17 Final report RETURNED by the Provincial Chief IIS, with a comment on the PDF.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(50, 9, 0), pg_temp.cat(), inv);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(50, 14, 0), d1, '{}', NULL, true);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t + interval '4 days', d1, '{}', NULL, true);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'FINAL_INVESTIGATION', 'RETURNED_PROVINCIAL', inv, chief, marshal, prov, t + interval '30 days', interval '1 day',
      jsonb_build_object('causeOfFire', pg_temp.cause()),
      'The stated cause is not supported by the laboratory result. Please reconcile the findings.', true);
    SELECT '/api/case-files/' || "referenceNumber" || '/final.pdf' INTO ref FROM incidents WHERE id = inc;
    PERFORM pg_temp.annotate(r, ref, prov, 9, 'Cause of fire', 'Explain how the laboratory result supports this cause, or revise it.', t + interval '34 days');

    -- S18 Closed case whose Final report the investigator asked to REOPEN (waiting for the Chief IIS).
    inc := pg_temp.mk_case(m.id, pg_temp.ph(150, 11, 0), pg_temp.cat(), inv);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(150, 16, 0), d1, '{}', NULL, true);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t + interval '4 days', d1, '{}', NULL, true);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'FINAL_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t + interval '30 days', d1,
      jsonb_build_object('causeOfFire', pg_temp.cause()), NULL, true);
    INSERT INTO report_requests (type, status, "reportId", "municipalityId", "requestedById", reason, "createdAt", "updatedAt")
    VALUES ('REOPEN', 'PENDING', r, m.id, inv,
            'The property owner submitted new CCTV footage that may change the established cause of fire.',
            now() - interval '2 days', now() - interval '2 days')
    RETURNING id INTO r2;
    PERFORM pg_temp.track('report_requests', r2);
    PERFORM pg_temp.notify(chief, r, 'REPORT_REQUEST', (SELECT name FROM users WHERE id = inv) || ' asks to reopen Final Investigation Report #' || r || ': The property owner submitted new CCTV footage that may change the established cause of fire.', now() - interval '2 days');

    -- S19 Progress report submitted LATE (beyond 7 days of the Spot approval), with explanation.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(30, 10, 0), pg_temp.cat(), inv);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(30, 15, 0), d1, '{}', NULL, true);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'AT_CHIEF', inv, chief, marshal, prov, pg_temp.ph(2, 9, 30), d1,
      jsonb_build_object('lateExplanation', 'Laboratory results for the debris samples were released only last week by the Regional Crime Laboratory, so the Progress report could not be completed earlier.', 'submittedLate', true),
      NULL, true);

    -- S20 Closed case whose Final report was submitted LATE (with explanation) and approved.
    inc := pg_temp.mk_case(m.id, pg_temp.ph(200, 8, 0), pg_temp.cat(), inv);
    SELECT rid, done_at INTO r, t FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, pg_temp.ph(200, 13, 0), d1, '{}', NULL, true);
    SELECT rid INTO r FROM pg_temp.mk_report(inc, 'FINAL_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t + interval '58 days', d1,
      jsonb_build_object('causeOfFire', pg_temp.cause(),
                         'lateExplanation', 'The case required an electrical analysis from the provincial engineering office, which was received after the 45-day period.',
                         'submittedLate', true),
      NULL, true);

    -- A general message from the Fire Marshal, acknowledged.
    INSERT INTO directives (kind, status, "municipalityId", "senderId", "recipientId", message, response, "respondedAt", "createdAt", "updatedAt")
    VALUES ('MESSAGE', 'ACKNOWLEDGED', m.id, marshal, inv,
            'Reminder: attend the provincial fire investigation refresher course on Friday, 8:00 AM, at the Provincial Fire Office.',
            'Noted, sir. Will attend.', now() - interval '3 days', now() - interval '4 days', now() - interval '3 days')
    RETURNING id INTO r2;
    PERFORM pg_temp.track('directives', r2);

    created := created + 1;
  END LOOP;

  RAISE NOTICE 'Workflow scenarios created for % municipalities.%', created,
    CASE WHEN skipped <> '' THEN ' Skipped (missing Investigator / Chief IIS / Fire Marshal account): ' || skipped ELSE '' END;
END
$main$;

-- ---------------------------------------------------------------------------------------------
-- 2. History — every dashboard tally becomes closed, on-time cases with their reports
-- ---------------------------------------------------------------------------------------------
DO $hist$
DECLARE
  e record;
  cat text; n int; k int;
  inv int; chief int; marshal int; prov int; fallback int;
  fire timestamptz; age float8; inc int; r int;
  t_spot timestamptz; t_prog timestamptz; t timestamptz;
  y int; mo int; last_day int; cases int := 0;
  step interval;
BEGIN
  prov := coalesce(pg_temp.u('PROVINCIAL_CHIEF_IIS', NULL), pg_temp.u('SUPER_ADMIN', NULL), pg_temp.u('ADMIN', NULL));
  fallback := coalesce(pg_temp.u('SUPER_ADMIN', NULL), pg_temp.u('ADMIN', NULL), prov);

  FOR e IN SELECT * FROM daily_report_entries
            WHERE "reportingOfficer" NOT LIKE '[sample-replaced] %'
              AND "reportingOfficer" <> 'System Seed [replaced by sample reports]'
            ORDER BY "reportDate", id LOOP
    inv := coalesce(pg_temp.u('INVESTIGATOR', e."municipalityId"), fallback);
    chief := coalesce(pg_temp.u('MUNICIPAL_CHIEF_IIS', e."municipalityId"), prov);
    marshal := coalesce(pg_temp.u('MUNICIPAL_FIRE_MARSHAL', e."municipalityId"), prov);
    y := extract(year FROM e."reportDate")::int;
    mo := extract(month FROM e."reportDate")::int;
    last_day := extract(day FROM (make_date(y, mo, 1) + interval '1 month - 1 day'))::int;

    FOREACH cat IN ARRAY ARRAY['RESIDENTIAL','NON_RESIDENTIAL','NON_STRUCTURAL','TRANSPORT'] LOOP
      n := CASE cat WHEN 'RESIDENTIAL' THEN e."residentialCount" WHEN 'NON_RESIDENTIAL' THEN e."nonResidentialCount"
                    WHEN 'NON_STRUCTURAL' THEN e."nonStructuralCount" ELSE e."transportCount" END;
      FOR k IN 1..coalesce(n, 0) LOOP
        -- Somewhere in the tally's month (not in the future), during the day.
        fire := (make_date(y, mo, pg_temp.rnd(1, last_day))::timestamp + make_interval(hours => pg_temp.rnd(6, 21), mins => pg_temp.rnd(0, 59))) AT TIME ZONE 'Asia/Manila';
        IF fire > now() - interval '6 hours' THEN
          fire := now() - interval '1 day' - make_interval(hours => pg_temp.rnd(0, 20));
        END IF;
        age := extract(epoch FROM now() - fire) / 86400;
        inc := pg_temp.mk_case(e."municipalityId", fire, cat, inv);
        step := CASE WHEN age < 3 THEN interval '8 hours' ELSE interval '14 hours' END;

        -- Spot report: within hours of the fire; reviewed through the chain.
        IF age < 1.5 THEN
          SELECT rid INTO r FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'AT_PROVINCIAL', inv, chief, marshal, prov, fire + interval '5 hours', interval '5 hours');
          CONTINUE;
        END IF;
        SELECT rid, done_at INTO r, t_spot FROM pg_temp.mk_report(inc, 'SPOT_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, fire + interval '5 hours', step);

        -- Progress (on time: 4 days after the Spot report's final approval) unless the case skips it.
        t_prog := NULL;
        IF random() < 0.7 AND now() > t_spot + interval '4 days' THEN
          IF now() > t_spot + interval '4 days' + step * 4 THEN
            SELECT rid, done_at INTO r, t_prog FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t_spot + interval '4 days', step);
          ELSE
            SELECT rid INTO r FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'AT_CHIEF', inv, chief, marshal, prov, t_spot + interval '4 days', step);
            CONTINUE;
          END IF;
        ELSIF now() <= t_spot + interval '4 days' THEN
          CONTINUE; -- Progress not due yet
        END IF;

        -- Final (on time: 25 days after the last finalized report), once that day has come.
        t := coalesce(t_prog, t_spot) + interval '25 days';
        IF now() > t + step * 4 THEN
          SELECT rid INTO r FROM pg_temp.mk_report(inc, 'FINAL_INVESTIGATION', 'FINAL', inv, chief, marshal, prov, t, step,
            jsonb_build_object('causeOfFire', pg_temp.cause()));
        ELSIF now() > t THEN
          SELECT rid INTO r FROM pg_temp.mk_report(inc, 'FINAL_INVESTIGATION', 'AT_CHIEF', inv, chief, marshal, prov, t, step,
            jsonb_build_object('causeOfFire', pg_temp.cause()));
        ELSIF t_prog IS NULL THEN
          -- Skipping Progress but the Final isn't due yet: file the Progress after all, so the
          -- case is never left with an overdue next step.
          SELECT rid INTO r FROM pg_temp.mk_report(inc, 'PROGRESS_INVESTIGATION', 'AT_CHIEF', inv, chief, marshal, prov, least(t_spot + interval '4 days', now() - interval '2 hours'), step);
        END IF;
        cases := cases + 1;
      END LOOP;
    END LOOP;

    -- The tally's fires now have their own reports: hide it from the dashboards (kept, not deleted).
    UPDATE daily_report_entries SET "reportingOfficer" = '[sample-replaced] ' || "reportingOfficer" WHERE id = e.id;
  END LOOP;
  RAISE NOTICE 'History: % closed or in-progress cases created from the dashboard tallies.', cases;
END
$hist$;

COMMIT;

-- Summary of what is now in the system.
SELECT r."reportType" AS report, r.status, count(*) AS reports
  FROM reports r WHERE r.id IN (SELECT row_id FROM _demo_seed_rows WHERE tbl = 'reports')
 GROUP BY 1, 2 ORDER BY 1, 2;
