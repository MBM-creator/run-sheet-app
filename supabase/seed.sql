-- Test data for run sheet review
-- Run after migrations. Then bootstrap an owner link with the project_id below.

-- Fixed IDs for easy reference (use in bootstrap: project_id = TEST_PROJECT_ID)
-- TEST_PROJECT_ID = '11111111-0000-4000-a000-000000000001'
-- TEST_RUN_SHEET_ID = '22222222-0000-4000-a000-000000000002'

INSERT INTO projects (id, name, site_address, start_date, supervisor_name, status)
VALUES (
  '11111111-0000-4000-a000-000000000001',
  'Test Project — North Site',
  '123 Builder Lane, Auckland',
  CURRENT_DATE - 7,
  'Jane Supervisor',
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO run_sheets (id, project_id, version, status, created_by)
VALUES (
  '22222222-0000-4000-a000-000000000002',
  '11111111-0000-4000-a000-000000000001',
  1,
  'draft',
  'owner'
)
ON CONFLICT (id) DO NOTHING;

-- 7 days: relative to start_date. Day 2 cutoff confirmed; others mix of past/future.
DELETE FROM run_sheet_days WHERE run_sheet_id = '22222222-0000-4000-a000-000000000002';

INSERT INTO run_sheet_days (
  run_sheet_id,
  day_number,
  calendar_date,
  outcomes_text,
  logistics_text,
  cutoff_datetime,
  cutoff_category,
  cutoff_rule_applied,
  cutoff_confirmed_at,
  cutoff_confirmed_by_label
)
SELECT
  '22222222-0000-4000-a000-000000000002',
  n,
  (CURRENT_DATE - 7) + (n - 1),
  'Day ' || n || ': Foundations to DPC. Strip and pour 50m² pad. 20mm stone, 50mm sand, 100mm slab. Ready for steel fix.',
  E'Tools/Plant: 12t digger, laser level\nMaterials: 20mm aggregate 8t, sand 4t, 6 bags cement\nBookings/Access: Site access 07:00',
  CASE
    WHEN n = 1 THEN (CURRENT_DATE - 7) + (n - 1) + TIME '17:00' - INTERVAL '1 day'
    WHEN n IN (2,3,4,5,6,7) THEN (CURRENT_DATE - 7) + (n - 1) + TIME '17:00' - INTERVAL '2 days'
    ELSE NULL
  END,
  CASE WHEN n <= 5 THEN 'concrete'::cutoff_category ELSE NULL END,
  true,
  CASE WHEN n = 2 THEN now() - INTERVAL '1 day' ELSE NULL END,
  CASE WHEN n = 2 THEN 'Jane Supervisor' ELSE NULL END
FROM generate_series(1, 7) AS n;
