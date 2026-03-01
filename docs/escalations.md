# Run Sheet Escalations

Escalations are created by a server scanner and shown in the run-sheet UI. No automatic sanctions; all actions are human-driven.

## Enforcement ladder

- **Level 1 (Warning)** — Panel highlight; no banner. Indicates cut-off missed or similar.
- **Level 2 (Action required)** — Red banner + Escalation Inbox; owner should act.
- **Level 3 (Urgent)** — Same as Level 2; owner response expected within 24h.

Escalations are resolved or assigned by the owner via the Escalation Inbox or day-row panel. The system does not auto-suspend or apply sanctions.

## Scanner (cron)

The scanner creates and clears escalations based on rules (cut-off missed → 24h → 72h, consecutive misses, mid-week review). It is intended to run on a schedule (e.g. hourly).

### Endpoint

- **POST /api/run-sheet/escalations/scan**

  - **Cron**: Send header `x-cron-secret` equal to `CRON_SECRET` (env). Scans all projects.
  - **Manual (owner)**: Send `Authorization: Bearer <owner_token>` and body `{ "project_id": "<uuid>" }` to scan a single project.

- Response: `{ created, byType, resolved, summary }`.

### Vercel Cron example

In `vercel.json` a cron is configured to hit the scan route every hour:

```json
{
  "crons": [
    {
      "path": "/api/run-sheet/escalations/scan",
      "schedule": "0 * * * *"
    }
  ]
}
```

Set `CRON_SECRET` in your Vercel project environment. Vercel Cron does not send custom headers, so the scheduled request will not authenticate. Use one of:

- **External cron** (recommended): Use a service that can send headers (e.g. cron-job.org). Call the URL with header `x-cron-secret: YOUR_CRON_SECRET`.
- **Query param**: From a server that has `CRON_SECRET`, you can call with the secret in the URL (less secure; URL may appear in logs):  
  `POST .../scan?cron_secret=YOUR_CRON_SECRET`

```bash
curl -X POST "https://your-app.vercel.app/api/run-sheet/escalations/scan" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## APIs

- **GET /api/run-sheet/escalations?project_id=...&open_only=true** — List (owner/supervisor).
- **POST /api/run-sheet/escalations/[id]/resolve** — Resolve (owner). Body: `resolution_note?`, `action?`.
- **POST /api/run-sheet/escalations/[id]/assign** — Assign (owner). Body: `assign_to_label`, `note?`.
- **GET /api/run-sheet/escalations/inbox?label=...** — Inbox for owner (assigned to label or unassigned).
- **POST /api/run-sheet/escalations/[id]/snooze** — Snooze mid-week modal (owner). Body: `duration_hours?` (default 2).
