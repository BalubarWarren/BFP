-- Fire incident counts for CY 2023, 2024 and 2025 from the BFP Benguet records, loaded into
-- daily_report_entries so the provincial dashboard's "Fire Incident Comparison" has past years
-- to compare against. Run in the Supabase SQL Editor. Safe to re-run: it first removes the rows a
-- previous run added (all tagged with reportingOfficer = 'Official records CY2023-2025 (demo import)').
-- To remove this data later, run only the DELETE statement.
--
-- Sources and how they were mapped:
--   * CY 2023 spreadsheet and CY 2024 signed summary: monthly province totals, no municipality,
--     so they are recorded under La Trinidad (seat of the Provincial Office).
--   * CY 2025 certification: totals per municipality, no months, so each municipality's
--     incidents are spread evenly over Jan-Dec. Yearly and per-municipality totals are exact;
--     the 2025 month-by-month split is approximate.
--   * Structural fires are counted as Residential (the records don't split residential and
--     non-residential). Forest, grass, rubbish/garbage, electric post and agricultural fires are
--     Non-Structural. Vehicular / transport fires are Transport.
--   Totals: 2023 = 111, 2024 = 178, 2025 = 76.

BEGIN;

DELETE FROM daily_report_entries WHERE "reportingOfficer" = 'Official records CY2023-2025 (demo import)';

INSERT INTO daily_report_entries
  ("reportId", "municipalityId", "reportDate", "residentialCount", "nonResidentialCount",
   "nonStructuralCount", "transportCount", "totalCount", "reportingOfficer")
SELECT
  0,
  m.id,
  v.report_date::timestamp,
  v.residential,
  0,
  v.non_structural,
  v.transport,
  v.residential + v.non_structural + v.transport,
  'Official records CY2023-2025 (demo import)'
FROM (VALUES
  ('La Trinidad', '2023-01-15', 7, 13, 1),
  ('La Trinidad', '2023-02-15', 1, 11, 0),
  ('La Trinidad', '2023-03-15', 3, 28, 0),
  ('La Trinidad', '2023-04-15', 5, 14, 0),
  ('La Trinidad', '2023-05-15', 2, 2, 0),
  ('La Trinidad', '2023-06-15', 3, 0, 0),
  ('La Trinidad', '2023-07-15', 2, 2, 0),
  ('La Trinidad', '2023-08-15', 2, 0, 0),
  ('La Trinidad', '2023-09-15', 3, 0, 0),
  ('La Trinidad', '2023-10-15', 0, 1, 0),
  ('La Trinidad', '2023-11-15', 5, 0, 1),
  ('La Trinidad', '2023-12-15', 2, 3, 0),
  ('La Trinidad', '2024-01-15', 6, 13, 0),
  ('La Trinidad', '2024-02-15', 6, 45, 0),
  ('La Trinidad', '2024-03-15', 4, 40, 0),
  ('La Trinidad', '2024-04-15', 4, 23, 0),
  ('La Trinidad', '2024-05-15', 2, 4, 0),
  ('La Trinidad', '2024-06-15', 2, 0, 0),
  ('La Trinidad', '2024-07-15', 2, 0, 0),
  ('La Trinidad', '2024-08-15', 4, 0, 0),
  ('La Trinidad', '2024-09-15', 2, 0, 0),
  ('La Trinidad', '2024-10-15', 5, 1, 0),
  ('La Trinidad', '2024-11-15', 5, 0, 1),
  ('La Trinidad', '2024-12-15', 5, 3, 1),
  ('Atok', '2025-01-15', 1, 0, 0),
  ('Itogon', '2025-01-15', 1, 1, 0),
  ('La Trinidad', '2025-01-15', 2, 0, 0),
  ('Mankayan', '2025-01-15', 1, 0, 0),
  ('Tuba', '2025-01-15', 1, 0, 0),
  ('Atok', '2025-02-15', 1, 0, 0),
  ('Itogon', '2025-02-15', 1, 1, 0),
  ('La Trinidad', '2025-02-15', 2, 0, 0),
  ('Mankayan', '2025-02-15', 1, 0, 0),
  ('Tuba', '2025-02-15', 0, 1, 0),
  ('Atok', '2025-03-15', 1, 0, 0),
  ('Itogon', '2025-03-15', 1, 1, 0),
  ('La Trinidad', '2025-03-15', 2, 0, 0),
  ('Mankayan', '2025-03-15', 1, 0, 0),
  ('Tuba', '2025-03-15', 0, 1, 0),
  ('Bakun', '2025-04-15', 1, 0, 0),
  ('Itogon', '2025-04-15', 1, 1, 0),
  ('La Trinidad', '2025-04-15', 2, 0, 0),
  ('Mankayan', '2025-04-15', 1, 0, 0),
  ('Tuba', '2025-04-15', 0, 0, 1),
  ('Bakun', '2025-05-15', 0, 1, 0),
  ('Itogon', '2025-05-15', 1, 1, 0),
  ('La Trinidad', '2025-05-15', 2, 0, 0),
  ('Sablan', '2025-05-15', 1, 0, 0),
  ('Bokod', '2025-06-15', 0, 1, 0),
  ('Itogon', '2025-06-15', 1, 1, 0),
  ('La Trinidad', '2025-06-15', 2, 0, 0),
  ('Tublay', '2025-06-15', 0, 1, 0),
  ('Buguias', '2025-07-15', 1, 0, 0),
  ('Itogon', '2025-07-15', 1, 0, 0),
  ('Kabayan', '2025-07-15', 0, 1, 0),
  ('La Trinidad', '2025-07-15', 1, 1, 0),
  ('Tuba', '2025-07-15', 1, 0, 0),
  ('Buguias', '2025-08-15', 1, 0, 0),
  ('Itogon', '2025-08-15', 0, 1, 0),
  ('Kabayan', '2025-08-15', 0, 1, 0),
  ('La Trinidad', '2025-08-15', 1, 1, 0),
  ('Tuba', '2025-08-15', 1, 0, 0),
  ('Buguias', '2025-09-15', 1, 0, 0),
  ('Itogon', '2025-09-15', 0, 1, 0),
  ('Kapangan', '2025-09-15', 1, 0, 0),
  ('La Trinidad', '2025-09-15', 1, 1, 0),
  ('Tuba', '2025-09-15', 1, 0, 0),
  ('Buguias', '2025-10-15', 1, 0, 0),
  ('Itogon', '2025-10-15', 0, 1, 0),
  ('Kapangan', '2025-10-15', 1, 0, 0),
  ('La Trinidad', '2025-10-15', 1, 1, 0),
  ('Tuba', '2025-10-15', 1, 0, 0),
  ('Buguias', '2025-11-15', 1, 0, 0),
  ('Itogon', '2025-11-15', 0, 1, 0),
  ('La Trinidad', '2025-11-15', 2, 0, 1),
  ('Tuba', '2025-11-15', 1, 0, 0),
  ('Itogon', '2025-12-15', 1, 1, 0),
  ('La Trinidad', '2025-12-15', 2, 0, 1),
  ('Tuba', '2025-12-15', 1, 0, 0)
) AS v(municipality, report_date, residential, non_structural, transport)
JOIN municipalities m ON UPPER(m.name) = UPPER(v.municipality);

COMMIT;

-- Check: expect total 111 for 2023, 178 for 2024 and 76 for 2025 (79 rows altogether). A lower
-- number means a municipality name didn't match the municipalities table and its rows were skipped.
SELECT EXTRACT(YEAR FROM "reportDate")::int AS year,
       SUM("residentialCount") AS residential,
       SUM("nonStructuralCount") AS non_structural,
       SUM("transportCount") AS transport,
       SUM("totalCount") AS total,
       COUNT(*) AS rows_added
FROM daily_report_entries
WHERE "reportingOfficer" = 'Official records CY2023-2025 (demo import)'
GROUP BY 1
ORDER BY 1;
