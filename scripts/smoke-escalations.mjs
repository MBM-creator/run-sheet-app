#!/usr/bin/env node
/**
 * Smoke test for escalation APIs. Requires:
 *   BASE_URL (e.g. http://localhost:3000)
 *   CRON_SECRET (for scan) or OWNER_TOKEN (for GET escalations; optional)
 *
 * Usage:
 *   CRON_SECRET=xxx BASE_URL=http://localhost:3000 node scripts/smoke-escalations.mjs [project_id]
 *   OWNER_TOKEN=xxx BASE_URL=http://localhost:3000 node scripts/smoke-escalations.mjs <project_id>
 *
 * With project_id: runs GET escalations (requires OWNER_TOKEN). Without: runs POST scan (requires CRON_SECRET).
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const OWNER_TOKEN = process.env.OWNER_TOKEN;
const projectId = process.argv[2];

async function main() {
  if (projectId && OWNER_TOKEN) {
    const url = `${BASE}/api/run-sheet/escalations?project_id=${encodeURIComponent(projectId)}&open_only=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${OWNER_TOKEN}` } });
    console.log("GET escalations:", res.status, res.statusText);
    if (!res.ok) {
      console.error(await res.text());
      process.exit(1);
    }
    const data = await res.json();
    const count = Array.isArray(data) ? data.length : 0;
    console.log("Open escalations count:", count);
    return;
  }

  if (!CRON_SECRET) {
    console.error("Set CRON_SECRET (for scan) or OWNER_TOKEN and project_id (for GET escalations).");
    process.exit(1);
  }

  const url = `${BASE}/api/run-sheet/escalations/scan`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-cron-secret": CRON_SECRET },
  });
  console.log("POST scan:", res.status, res.statusText);
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }
  const data = await res.json();
  console.log("Scan result:", JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
