-- Demo fire incident data for CY 2026, loaded into daily_report_entries for the provincial
-- dashboard (monitoring board, map and comparison). Run the whole script in the Supabase SQL
-- Editor, after demo-official-fire-incidents-2023-2025.sql (which adds the subCategories column).
-- Safe to re-run: it first removes the rows a previous run added (all tagged with
-- reportingOfficer = 'Demo data CY2026 (12 June whiteboard + generated months)').
-- To remove this data later, run only the DELETE statement.
--
--   * June 2026: the "Fire Incident Monitoring as of 12 June 2026" whiteboard, exactly, per
--     municipality and category (dated 12 June). Total 109.
--   * Every other month up to 10 Nov 2026: GENERATED demo numbers, not real records — dry season
--     (Jan-May) heavy on grass/forest fires, rainy months few and mostly structural. December
--     has no data because it hasn't happened yet.
--   * Sub-categories (Grass, Forest, Single and Two Family Dwelling, Mercantile, ...) are
--     GENERATED for all of 2026, including June; they always add up to the category counts.
--   Monthly totals: 2026-01: 20, 2026-02: 43, 2026-03: 49, 2026-04: 36, 2026-05: 12, 2026-06: 109, 2026-07: 7, 2026-08: 6, 2026-09: 6, 2026-10: 8, 2026-11: 4. Year: 300.
--   Filed Spot/MDFIR reports already in the system are counted on top of these.

BEGIN;

ALTER TABLE "daily_report_entries" ADD COLUMN IF NOT EXISTS "subCategories" TEXT;

DELETE FROM daily_report_entries WHERE "reportingOfficer" = 'Demo data CY2026 (12 June whiteboard + generated months)';

INSERT INTO daily_report_entries
  ("reportId", "municipalityId", "reportDate", "residentialCount", "nonResidentialCount",
   "nonStructuralCount", "transportCount", "totalCount", "subCategories", "reportingOfficer")
SELECT
  0,
  m.id,
  v.report_date::timestamp,
  v.residential,
  v.non_residential,
  v.non_structural,
  v.transport,
  v.residential + v.non_residential + v.non_structural + v.transport,
  v.sub_categories,
  'Demo data CY2026 (12 June whiteboard + generated months)'
FROM (VALUES
  ('Atok', '2026-01-15', 0, 0, 0, 1, '{"transport":{"Tricycle":1}}'),
  ('Bakun', '2026-01-15', 1, 0, 0, 0, '{"residential":{"Single and Two Family Dwelling":1}}'),
  ('Bokod', '2026-01-15', 0, 0, 1, 0, '{"nonStructural":{"Electrical Pole":1}}'),
  ('Buguias', '2026-01-15', 1, 0, 0, 0, '{"residential":{"Dormitory":1}}'),
  ('Itogon', '2026-01-15', 1, 0, 4, 0, '{"residential":{"Single and Two Family Dwelling":1},"nonStructural":{"Forest":1,"Grass":2,"Agricultural Land":1}}'),
  ('La Trinidad', '2026-01-15', 2, 2, 2, 0, '{"residential":{"Single and Two Family Dwelling":1,"Lodging and Rooming Houses":1},"nonResidential":{"Special Structures":1,"Business":1},"nonStructural":{"Grass":1,"Rubbish":1}}'),
  ('Sablan', '2026-01-15', 0, 0, 3, 0, '{"nonStructural":{"Grass":3}}'),
  ('Tuba', '2026-01-15', 0, 0, 1, 0, '{"nonStructural":{"Forest":1}}'),
  ('Tublay', '2026-01-15', 0, 0, 1, 0, '{"nonStructural":{"Rubbish":1}}'),
  ('Atok', '2026-02-15', 0, 0, 1, 0, '{"nonStructural":{"Grass":1}}'),
  ('Bakun', '2026-02-15', 0, 0, 2, 0, '{"nonStructural":{"Forest":1,"Rubbish":1}}'),
  ('Bokod', '2026-02-15', 0, 0, 6, 0, '{"nonStructural":{"Grass":3,"Forest":2,"Electrical Pole":1}}'),
  ('Buguias', '2026-02-15', 1, 0, 1, 0, '{"residential":{"Single and Two Family Dwelling":1},"nonStructural":{"Grass":1}}'),
  ('Itogon', '2026-02-15', 0, 0, 11, 0, '{"nonStructural":{"Grass":2,"Forest":5,"Rubbish":1,"Agricultural Land":2,"Electrical Pole":1}}'),
  ('Kabayan', '2026-02-15', 0, 0, 3, 0, '{"nonStructural":{"Electrical Pole":1,"Forest":2}}'),
  ('Kibungan', '2026-02-15', 0, 0, 1, 0, '{"nonStructural":{"Grass":1}}'),
  ('La Trinidad', '2026-02-15', 4, 2, 2, 0, '{"residential":{"Single and Two Family Dwelling":4},"nonResidential":{"Health Care":1,"Business":1},"nonStructural":{"Forest":2}}'),
  ('Mankayan', '2026-02-15', 0, 0, 1, 0, '{"nonStructural":{"Rubbish":1}}'),
  ('Sablan', '2026-02-15', 0, 0, 1, 1, '{"nonStructural":{"Forest":1},"transport":{"Tricycle":1}}'),
  ('Tuba', '2026-02-15', 1, 0, 3, 0, '{"residential":{"Dormitory":1},"nonStructural":{"Rubbish":1,"Electrical Pole":1,"Forest":1}}'),
  ('Tublay', '2026-02-15', 0, 0, 2, 0, '{"nonStructural":{"Forest":2}}'),
  ('Atok', '2026-03-15', 1, 0, 4, 0, '{"residential":{"Single and Two Family Dwelling":1},"nonStructural":{"Rubbish":1,"Forest":2,"Electrical Pole":1}}'),
  ('Bakun', '2026-03-15', 0, 0, 5, 0, '{"nonStructural":{"Forest":1,"Electrical Pole":2,"Rubbish":2}}'),
  ('Bokod', '2026-03-15', 0, 0, 5, 0, '{"nonStructural":{"Rubbish":2,"Grass":3}}'),
  ('Buguias', '2026-03-15', 0, 0, 1, 0, '{"nonStructural":{"Grass":1}}'),
  ('Itogon', '2026-03-15', 0, 1, 6, 0, '{"nonResidential":{"Storage":1},"nonStructural":{"Grass":2,"Electrical Pole":1,"Agricultural Land":1,"Forest":2}}'),
  ('Kabayan', '2026-03-15', 0, 0, 1, 0, '{"nonStructural":{"Forest":1}}'),
  ('Kapangan', '2026-03-15', 1, 0, 2, 0, '{"residential":{"Single and Two Family Dwelling":1},"nonStructural":{"Agricultural Land":1,"Grass":1}}'),
  ('Kibungan', '2026-03-15', 0, 0, 1, 0, '{"nonStructural":{"Grass":1}}'),
  ('La Trinidad', '2026-03-15', 2, 2, 4, 0, '{"residential":{"Single and Two Family Dwelling":2},"nonResidential":{"Business":1,"Educational":1},"nonStructural":{"Electrical Pole":2,"Forest":1,"Rubbish":1}}'),
  ('Mankayan', '2026-03-15', 0, 0, 1, 0, '{"nonStructural":{"Rubbish":1}}'),
  ('Sablan', '2026-03-15', 0, 0, 1, 0, '{"nonStructural":{"Rubbish":1}}'),
  ('Tuba', '2026-03-15', 1, 0, 5, 0, '{"residential":{"Single and Two Family Dwelling":1},"nonStructural":{"Grass":2,"Electrical Pole":1,"Forest":2}}'),
  ('Tublay', '2026-03-15', 0, 0, 5, 0, '{"nonStructural":{"Forest":3,"Grass":2}}'),
  ('Atok', '2026-04-15', 0, 0, 5, 0, '{"nonStructural":{"Forest":2,"Grass":3}}'),
  ('Bakun', '2026-04-15', 0, 0, 2, 0, '{"nonStructural":{"Forest":2}}'),
  ('Bokod', '2026-04-15', 0, 0, 1, 0, '{"nonStructural":{"Forest":1}}'),
  ('Buguias', '2026-04-15', 0, 0, 1, 0, '{"nonStructural":{"Grass":1}}'),
  ('Itogon', '2026-04-15', 1, 0, 2, 0, '{"residential":{"Lodging and Rooming Houses":1},"nonStructural":{"Forest":1,"Grass":1}}'),
  ('Kabayan', '2026-04-15', 0, 0, 3, 0, '{"nonStructural":{"Grass":1,"Agricultural Land":1,"Forest":1}}'),
  ('Kapangan', '2026-04-15', 0, 0, 1, 0, '{"nonStructural":{"Agricultural Land":1}}'),
  ('Kibungan', '2026-04-15', 0, 0, 1, 0, '{"nonStructural":{"Grass":1}}'),
  ('La Trinidad', '2026-04-15', 0, 1, 1, 1, '{"nonResidential":{"Storage":1},"nonStructural":{"Grass":1},"transport":{"Jeepney":1}}'),
  ('Mankayan', '2026-04-15', 3, 1, 1, 0, '{"residential":{"Single and Two Family Dwelling":3},"nonResidential":{"Assembly":1},"nonStructural":{"Agricultural Land":1}}'),
  ('Sablan', '2026-04-15', 0, 0, 2, 0, '{"nonStructural":{"Agricultural Land":1,"Forest":1}}'),
  ('Tuba', '2026-04-15', 1, 0, 1, 0, '{"residential":{"Single and Two Family Dwelling":1},"nonStructural":{"Forest":1}}'),
  ('Tublay', '2026-04-15', 1, 0, 6, 0, '{"residential":{"Single and Two Family Dwelling":1},"nonStructural":{"Grass":2,"Electrical Pole":2,"Agricultural Land":1,"Rubbish":1}}'),
  ('Atok', '2026-05-15', 0, 0, 1, 0, '{"nonStructural":{"Grass":1}}'),
  ('Bokod', '2026-05-15', 0, 0, 1, 0, '{"nonStructural":{"Forest":1}}'),
  ('Buguias', '2026-05-15', 1, 1, 0, 0, '{"residential":{"Condominiums":1},"nonResidential":{"Educational":1}}'),
  ('Itogon', '2026-05-15', 1, 0, 1, 0, '{"residential":{"Single and Two Family Dwelling":1},"nonStructural":{"Rubbish":1}}'),
  ('La Trinidad', '2026-05-15', 2, 0, 1, 0, '{"residential":{"Single and Two Family Dwelling":2},"nonStructural":{"Forest":1}}'),
  ('Mankayan', '2026-05-15', 0, 0, 1, 0, '{"nonStructural":{"Rubbish":1}}'),
  ('Sablan', '2026-05-15', 0, 0, 1, 0, '{"nonStructural":{"Forest":1}}'),
  ('Tublay', '2026-05-15', 0, 0, 1, 0, '{"nonStructural":{"Grass":1}}'),
  ('Atok', '2026-06-12', 0, 0, 2, 0, '{"nonStructural":{"Rubbish":1,"Forest":1}}'),
  ('Bakun', '2026-06-12', 0, 1, 7, 0, '{"nonResidential":{"Mixed Occupancies":1},"nonStructural":{"Grass":4,"Forest":1,"Electrical Pole":1,"Agricultural Land":1}}'),
  ('Bokod', '2026-06-12', 0, 0, 8, 0, '{"nonStructural":{"Grass":3,"Rubbish":1,"Forest":3,"Electrical Pole":1}}'),
  ('Buguias', '2026-06-12', 1, 1, 0, 1, '{"residential":{"Single and Two Family Dwelling":1},"nonResidential":{"Business":1},"transport":{"Tricycle":1}}'),
  ('Itogon', '2026-06-12', 4, 2, 26, 1, '{"residential":{"Lodging and Rooming Houses":1,"Dormitory":1,"Condominiums":1,"Single and Two Family Dwelling":1},"nonResidential":{"Mixed Occupancies":1,"Business":1},"nonStructural":{"Electrical Pole":6,"Forest":8,"Rubbish":3,"Grass":8,"Agricultural Land":1},"transport":{"Motorcycle":1}}'),
  ('Kabayan', '2026-06-12', 0, 0, 2, 0, '{"nonStructural":{"Agricultural Land":1,"Forest":1}}'),
  ('Kapangan', '2026-06-12', 3, 1, 0, 0, '{"residential":{"Single and Two Family Dwelling":1,"Lodging and Rooming Houses":2},"nonResidential":{"Mercantile":1}}'),
  ('Kibungan', '2026-06-12', 0, 0, 1, 0, '{"nonStructural":{"Forest":1}}'),
  ('La Trinidad', '2026-06-12', 5, 4, 6, 0, '{"residential":{"Single and Two Family Dwelling":5},"nonResidential":{"Mercantile":1,"Storage":1,"Business":2},"nonStructural":{"Forest":4,"Agricultural Land":1,"Rubbish":1}}'),
  ('Mankayan', '2026-06-12', 0, 0, 5, 0, '{"nonStructural":{"Forest":3,"Grass":1,"Rubbish":1}}'),
  ('Sablan', '2026-06-12', 1, 0, 2, 0, '{"residential":{"Apartment Building":1},"nonStructural":{"Electrical Pole":1,"Forest":1}}'),
  ('Tuba', '2026-06-12', 4, 0, 9, 1, '{"residential":{"Dormitory":1,"Single and Two Family Dwelling":3},"nonStructural":{"Rubbish":1,"Forest":7,"Grass":1},"transport":{"Bus":1}}'),
  ('Tublay', '2026-06-12', 3, 0, 8, 0, '{"residential":{"Dormitory":1,"Apartment Building":1,"Single and Two Family Dwelling":1},"nonStructural":{"Grass":4,"Agricultural Land":2,"Rubbish":1,"Forest":1}}'),
  ('Atok', '2026-07-15', 0, 0, 0, 1, '{"transport":{"Motorcycle":1}}'),
  ('Buguias', '2026-07-15', 1, 0, 0, 0, '{"residential":{"Single and Two Family Dwelling":1}}'),
  ('Itogon', '2026-07-15', 0, 1, 0, 0, '{"nonResidential":{"Business":1}}'),
  ('Kabayan', '2026-07-15', 0, 0, 1, 0, '{"nonStructural":{"Grass":1}}'),
  ('La Trinidad', '2026-07-15', 1, 0, 0, 0, '{"residential":{"Single and Two Family Dwelling":1}}'),
  ('Mankayan', '2026-07-15', 1, 0, 0, 0, '{"residential":{"Single and Two Family Dwelling":1}}'),
  ('Tuba', '2026-07-15', 1, 0, 0, 0, '{"residential":{"Condominiums":1}}'),
  ('Itogon', '2026-08-15', 1, 0, 0, 0, '{"residential":{"Single and Two Family Dwelling":1}}'),
  ('Kapangan', '2026-08-15', 0, 1, 0, 0, '{"nonResidential":{"Mercantile":1}}'),
  ('La Trinidad', '2026-08-15', 1, 0, 0, 0, '{"residential":{"Apartment Building":1}}'),
  ('Sablan', '2026-08-15', 0, 1, 1, 0, '{"nonResidential":{"Storage":1},"nonStructural":{"Electrical Pole":1}}'),
  ('Tuba', '2026-08-15', 1, 0, 0, 0, '{"residential":{"Single and Two Family Dwelling":1}}'),
  ('Kapangan', '2026-09-15', 0, 1, 0, 0, '{"nonResidential":{"Assembly":1}}'),
  ('La Trinidad', '2026-09-15', 3, 0, 0, 0, '{"residential":{"Dormitory":1,"Single and Two Family Dwelling":2}}'),
  ('Mankayan', '2026-09-15', 0, 0, 0, 1, '{"transport":{"Tricycle":1}}'),
  ('Tuba', '2026-09-15', 1, 0, 0, 0, '{"residential":{"Single and Two Family Dwelling":1}}'),
  ('Bakun', '2026-10-15', 1, 0, 0, 0, '{"residential":{"Single and Two Family Dwelling":1}}'),
  ('Itogon', '2026-10-15', 1, 0, 2, 0, '{"residential":{"Single and Two Family Dwelling":1},"nonStructural":{"Rubbish":2}}'),
  ('La Trinidad', '2026-10-15', 2, 1, 0, 0, '{"residential":{"Single and Two Family Dwelling":2},"nonResidential":{"Business":1}}'),
  ('Sablan', '2026-10-15', 1, 0, 0, 0, '{"residential":{"Single and Two Family Dwelling":1}}'),
  ('Atok', '2026-11-05', 0, 0, 1, 0, '{"nonStructural":{"Rubbish":1}}'),
  ('Buguias', '2026-11-05', 0, 1, 0, 0, '{"nonResidential":{"Educational":1}}'),
  ('Itogon', '2026-11-05', 1, 0, 0, 0, '{"residential":{"Dormitory":1}}'),
  ('Tuba', '2026-11-05', 1, 0, 0, 0, '{"residential":{"Apartment Building":1}}')
) AS v(municipality, report_date, residential, non_residential, non_structural, transport, sub_categories)
JOIN municipalities m ON UPPER(m.name) = UPPER(v.municipality);

COMMIT;

-- Check: expect 2026-01: 20, 2026-02: 43, 2026-03: 49, 2026-04: 36, 2026-05: 12, 2026-06: 109, 2026-07: 7, 2026-08: 6, 2026-09: 6, 2026-10: 8, 2026-11: 4
-- (92 rows). A lower number means a municipality name didn't match and its rows were skipped.
SELECT TO_CHAR("reportDate", 'YYYY-MM') AS month,
       SUM("residentialCount") AS residential,
       SUM("nonResidentialCount") AS non_residential,
       SUM("nonStructuralCount") AS non_structural,
       SUM("transportCount") AS transport,
       SUM("totalCount") AS total
FROM daily_report_entries
WHERE "reportingOfficer" = 'Demo data CY2026 (12 June whiteboard + generated months)'
GROUP BY 1
ORDER BY 1;
