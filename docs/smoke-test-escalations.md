# Escalations — smoke test checklist

Use this after deploying or when verifying the escalation system. Requires a running app and Supabase with migrations applied.

**Quick script**: From the project root, with the app running:
- Scan: `CRON_SECRET=xxx BASE_URL=http://localhost:3000 node scripts/smoke-escalations.mjs`
- GET escalations: `OWNER_TOKEN=xxx BASE_URL=http://localhost:3000 node scripts/smoke-escalations.mjs <project_id>`

## 1. Scanner (cut-off missed → level 1)

1. In Supabase, ensure you have a project, a run_sheet, and at least one `run_sheet_days` row with:
   - `cutoff_datetime` set to a time in the **past** (e.g. yesterday)
   - `cutoff_confirmed_at` = NULL
2. Run the scanner:
   ```bash
   curl -X POST "http://localhost:3000/api/run-sheet/escalations/scan" \
     -H "x-cron-secret: YOUR_CRON_SECRET"
   ```
3. **Assert**: Response includes `created >= 1` and `byType.cutoff_missed >= 1`. In DB, `run_sheet_escalations` has one open row with `escalation_type = 'cutoff_missed'`, `level = 1`; `run_sheet_days.escalation_state` = `'warning'` for that day.

## 2. Scanner (cut-off overdue 24h → level 2)

1. Same as above but set `cutoff_datetime` to **25 hours** ago.
2. Run the scanner again (or run once if the day had no prior escalation).
3. **Assert**: One open escalation with `level = 2`, `escalation_state` = `'action'` (or level 2 created).

## 3. Clear on confirm

1. Set `cutoff_confirmed_at` (and optionally `cutoff_confirmed_by_label`) on the same `run_sheet_days` row (e.g. via Supabase dashboard or the app’s “Mark confirmed” flow).
2. Run the scanner again.
3. **Assert**: That day’s open `cutoff_missed` escalation has `resolved = true`, `resolved_by_label = 'system'`; `run_sheet_days.escalation_state` cleared to `'none'` when no other open escalation for that day.

## 4. APIs

- **GET escalations**  
  `GET /api/run-sheet/escalations?project_id=<project_id>&open_only=true`  
  With `Authorization: Bearer <owner_or_supervisor_token>`.  
  **Assert**: 200, JSON array (or wrapped list) of open escalations for that project.

- **POST resolve**  
  `POST /api/run-sheet/escalations/<id>/resolve`  
  Body: `{ "resolution_note": "Done" }`, owner token.  
  **Assert**: 200, updated row with `resolved = true`, `resolved_by_label` set, `resolved_at` set.

- **POST assign**  
  `POST /api/run-sheet/escalations/<id>/assign`  
  Body: `{ "assign_to_label": "Jane", "note": "Optional" }`, owner token.  
  **Assert**: 200, updated row with `metadata.assigned_to` = "Jane".

- **GET inbox**  
  `GET /api/run-sheet/escalations/inbox?label=<owner_label>`  
  Owner token.  
  **Assert**: 200, list of open escalations (assigned to label or unassigned).

## 5. UI (manual)

- With at least one open escalation level ≥ 2: red banner “Delivery risk – action required” and “Open Escalation Inbox” visible.
- Week actions panel: cutoff items with an escalation show level badge and “Resolve escalation” (owner).
- Escalation Inbox modal: table with Resolve / Assign; resolve flow sets note and closes; assign sets assignee.
- Mid-week: when there is an open `midweek_review` escalation, modal appears; “Snooze 2 hours” (owner) calls snooze API and dismisses.
- Day row: day with open escalation shows orange/red badge; click opens detail panel with “Open Escalation Inbox”.

## 6. EOD blocking and acknowledge

- With at least one open level ≥ 2 escalation, open EOD page: **Assert** “DELIVERY RISK ACTIVE” section at top; Submit button disabled.
- As supervisor/owner: enter comment &lt; 20 chars, click Acknowledge → **Assert** 400 or client validation.
- As supervisor/owner: enter comment ≥ 20 chars, click “Acknowledge & Continue” → **Assert** blocking section hides, Submit enabled.
- As crew: **Assert** banner visible, no Acknowledge form, Submit disabled; message “supervisor or owner must acknowledge”.
- **POST /api/run-sheet/escalations/acknowledge** (owner/supervisor): Body `{ project_id, escalation_ids: ["..."], note: "20+ chars" }`. **Assert** 200; escalation `metadata.last_acknowledged_at` set; not resolved.

## 7. Resolution discipline

- **POST resolve** with `resolution_note` &lt; 20 chars → **Assert** 400.
- **POST resolve** for level 3 without `recovery_plan` or &lt; 50 chars → **Assert** 400.
- **POST resolve** for level 3 with `resolution_note` ≥ 20 and `recovery_plan` ≥ 50 → **Assert** 200; `metadata.recovery_plan` stored.

## 8. Weekly logistics (Monday)

- On Monday with no `weekly_logistics_reviews` row for current week: run scanner → **Assert** one `weekly_logistics_not_confirmed` escalation (level 1 or 2 after 12:00).
- Run sheet header: **Assert** “Weekly Logistics Check Complete” button (owner/supervisor). Click → **Assert** POST logistics-review 200; escalation resolved; button disappears after reload.
- **POST /api/run-sheet/logistics-review**: Body `{ project_id, week_start_date: "YYYY-MM-DD" }` (Monday). **Assert** 200; row in `weekly_logistics_reviews`; open `weekly_logistics_not_confirmed` for that week resolved.

## 9. Owner delivery dashboard

- As owner, open `/projects/<projectId>/delivery-risk?token=...`. **Assert** “Delivery Risk Overview” card with Projects at risk, Active escalations, Overdue cut-offs; “Resolved This Week” count; “Open Escalation Inbox” CTA.
- As supervisor/crew, open same URL → **Assert** redirect to run sheet.
