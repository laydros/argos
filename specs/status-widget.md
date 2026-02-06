# Status Widget (Footer)

## Goal
Add a small footer widget that shows runtime/system status info:
- Codex usage (from codexbar CLI)
- OpenClaw version
- Dashboard version (a static string for now)
- Gateway uptime
- Zag uptime

## Placement
- Bottom of the page (below existing content).
- Low-visual-weight, scannable.

## Data Sources
- **Codex usage:** call `codexbar usage --provider codex --source cli --json` and parse `primary.usedPercent` and `primary.resetDescription`.
- **OpenClaw version:** use `openclaw status` output or `openclaw gateway status`? If easier, read from `openclaw status` (CLI) and parse version string.
- **Gateway uptime:** from `openclaw gateway status` output if available.
- **Zag uptime:** `uptime -p` or `cat /proc/uptime`.
- **Dashboard version:** set a constant in app.js, e.g. `const DASHBOARD_VERSION = "2026-02-04"`.

## Implementation Approach
- Add a new endpoint in `projects/task-dashboard/app.js` that fetches a JSON file exposed at `/data/status.json`.
- Create a new script in `tools/` to generate `status.json` on a schedule (like calendar-update):
  - `tools/status-update` (python or bash) that writes to `workspace/status.json`.
- Add a cron job later to update it (manual run is fine for now).
- Keep the dashboard purely client-side: it just fetches `/data/status.json`.

## UI
- Footer section with key/value rows.
- No tables (Discord rendering).
- Example:
  - Codex: 23% (resets 6:29 PM)
  - OpenClaw: 2026.2.2-3
  - Dashboard: 2026-02-04
  - Gateway uptime: 3d 4h
  - Zag uptime: 12d 2h

## Files
- `projects/task-dashboard/index.html`
- `projects/task-dashboard/style.css`
- `projects/task-dashboard/app.js`
- `tools/status-update` (new)
- `tools/README.md` (document new script)
