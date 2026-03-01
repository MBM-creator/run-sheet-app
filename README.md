# Run Sheet — Standalone Webapp

Supervisor-agreed run sheet: draft → in review → proposals → supervisor confirm → lock. EOD reconciliation. Signed links (no Supabase Auth in v1).

## Stack

- Next.js 15+ (App Router), TypeScript, Tailwind
- Supabase (Postgres + `@supabase/supabase-js`, `@supabase/ssr`)
- Auth: signed tokens (HMAC-SHA256), no logins

## Setup

### 1. Env

Copy `.env.example` to `.env.local` and set:

- **`NEXT_PUBLIC_SUPABASE_URL`** — Supabase project URL
- **`SUPABASE_SERVICE_ROLE_KEY`** — Service role key (server-only)
- **`RUN_SHEET_SIGNING_SECRET`** — Long random secret (e.g. `openssl rand -hex 32`). Used to sign and verify all access tokens.
- **`RUN_SHEET_BOOTSTRAP_KEY`** — (Dev only.) Secret for the bootstrap endpoint that mints the **first** owner link. Generate e.g. `openssl rand -hex 32`. Send as header `x-bootstrap-key`. **Do not set or use in production** — the bootstrap endpoint returns 404 there.
- **`NEXT_PUBLIC_APP_URL`** — (Optional.) Base URL for access links; defaults to request host.

### 2. Database

Create a Supabase project and run migrations:

```bash
supabase db push
```

Or run the SQL in `supabase/migrations/` in the Supabase SQL editor (in order: schema, then `20250302000000_projects_token_version.sql` for revocation support).

### 3. Bootstrap the first owner link (dev only)

You need one owner link to start. In **development only**, use the bootstrap endpoint so you don’t need an existing token:

```bash
curl -X POST http://localhost:3000/api/run-sheet/bootstrap-owner \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-key: YOUR_RUN_SHEET_BOOTSTRAP_KEY" \
  -d '{"project_id": "YOUR_PROJECT_UUID", "label": "Owner", "expires_in_days": 90}'
```

- **DO NOT enable or use this in production.** The endpoint is disabled there (404).
- Response: `{ "url": "...", "expires_at": "..." }`. Open `url` in the browser to use the app as owner.

Create a project in Supabase first (e.g. via dashboard or SQL `INSERT INTO projects (name, ...) VALUES (...)`), then use its `id` as `project_id`.

### 4. Minting more links (after you have an owner link)

Once you have an owner link, use the normal API with that token:

- **POST /api/run-sheet/access-link** — Owner only. Body: `project_id`, `role` (`owner` | `supervisor` | `crew`), optional `label`, optional `expires_in_days` (integer 1–365, default 90). Send the owner token in `Authorization: Bearer <token>` or as `?token=...`. Returns `{ url, expires_at }`.

So: bootstrap gives you the first **owner** link; from then on, owners use **access-link** to mint supervisor/crew (or additional owner) links.

### 5. Token revocation

If a link is leaked or you want to invalidate all existing links for a project:

- **POST /api/run-sheet/revoke-tokens** — Owner only. Body: `{ "project_id": "..." }`. Increments `projects.token_version` so all existing tokens for that project stop working. New links created after revocation work as usual.

Run the migration that adds `projects.token_version` so revocation is available.

### 6. Escalations (optional)

To enable the escalation scanner (cut-off missed, consecutive misses, mid-week review), set **`CRON_SECRET`** and run the scanner on a schedule. See [docs/escalations.md](docs/escalations.md) for the enforcement ladder, cron setup (e.g. `vercel.json`), and APIs.

## Run

- `npm run dev` — Development
- `npm run build` && `npm run start` — Production

Open the app via a signed run-sheet link (e.g. `/projects/<projectId>/run-sheet?token=<signed_token>`).

## Access link behaviour

- **expires_in_days**: Allowed range 1–365 (default 90). Non-integers, NaN, or out-of-range values return 400.
- **Bootstrap**: Dev-only; requires `RUN_SHEET_BOOTSTRAP_KEY` and header `x-bootstrap-key`; returns 404 in production and 403 on wrong/missing key.

## Smoke test checklist (manual)

1. Create a project in Supabase (or via SQL/UI).
2. Call **POST /api/run-sheet/bootstrap-owner** with correct `x-bootstrap-key` (dev only) → get owner URL.
3. Open the owner URL → confirm access.
4. Use the owner session to call **POST /api/run-sheet/access-link** and mint supervisor and crew links.
5. Call **POST /api/run-sheet/access-link** with a supervisor token → must 403.
6. Send invalid `expires_in_days` (e.g. 0, 400, or a float) → must 400.
7. Call **POST /api/run-sheet/revoke-tokens** as owner → old URLs stop working; new links minted after revocation work.

## Acceptance criteria

- Standalone app; no code in Client Connect
- Supervisor opens via link, sees full week, submits proposal with reason
- Owner approves/rejects proposals; accepted changes apply to run sheet
- Run sheet cannot be locked while proposals are pending
- Supervisor must confirm before lock; then owner can lock
- Once locked, outcomes/logistics only editable via new version
- EOD loads today’s outcomes from locked run sheet; recovery_plan when not complete, explanation when reason=other
- Week actions panel shows upcoming cut-offs with default rules and override reason when used
