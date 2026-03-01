# Seed test data for run sheet review

Use this to get a project and run sheet with 7 days of sample data so you can open the app and review flows.

## 1. Apply migrations and seed

If using Supabase CLI:

```bash
cd run-sheet-app
supabase db reset
```

That applies all migrations and runs `supabase/seed.sql` if present. To run only the seed against an existing DB (e.g. Supabase dashboard SQL editor), paste and run the contents of [../supabase/seed.sql](../supabase/seed.sql).

## 2. Test project and run sheet IDs

After the seed:

| What        | UUID |
|------------|------|
| Project ID | `11111111-0000-4000-a000-000000000001` |
| Run sheet  | `22222222-0000-4000-a000-000000000002` |

- **Project**: "Test Project — North Site", 7 days of run sheet data.
- **Run sheet**: Draft, version 1, 7 days with outcomes/logistics and concrete cut-offs.
- **Cut-offs**: Day 1 past and unconfirmed (overdue), Day 2 confirmed, Days 3–5 with cut-offs set.

## 3. Bootstrap owner link (dev only)

With the app running locally and `RUN_SHEET_BOOTSTRAP_KEY` set:

```bash
curl -X POST http://localhost:3000/api/run-sheet/bootstrap-owner \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-key: YOUR_RUN_SHEET_BOOTSTRAP_KEY" \
  -d '{"project_id": "11111111-0000-4000-a000-000000000001", "label": "Owner", "expires_in_days": 90}'
```

Use the `url` from the response in the browser. You’ll land on the run sheet as owner and can try:

- Week view and week actions panel (cut-offs, confirm)
- Proposals (mint a supervisor link first), lock flow, EOD
- Escalations (run the scanner, then use banner/inbox)

## 4. Optional: locked run sheet for EOD

To test EOD and “today’s plan”, create a locked run sheet and a day matching today’s date. In the SQL editor:

```sql
-- Add a second run sheet (locked) for the same project
INSERT INTO run_sheets (id, project_id, version, status)
VALUES (
  '33333333-0000-4000-a000-000000000003',
  '11111111-0000-4000-a000-000000000001',
  1,
  'locked'
);

-- One day matching today
INSERT INTO run_sheet_days (run_sheet_id, day_number, calendar_date, outcomes_text, logistics_text)
VALUES (
  '33333333-0000-4000-a000-000000000003',
  1,
  CURRENT_DATE,
  'Today: Strip and pour. 50m² pad ready for steel fix.',
  'Tools/Plant: Digger. Materials: 8t aggregate, 4t sand.'
);
```

Then in the app you can open EOD, pick today’s date, and submit reconciliation. Note: the run sheet page prefers the draft run sheet, so the main week view will still show the draft. Use the EOD link for the locked sheet flow.
