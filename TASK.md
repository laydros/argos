# Task: Fix Status Widget + Add System Metrics

## Problems to Fix

### 1. Gateway Uptime shows "Unknown"
The `status-update` Python script parses `systemctl --user status openclaw-gateway.service` looking for `; <time> ago` in the output. The regex is failing on the current output format.

Current systemctl output:
```
Active: active (running) since Sat 2026-02-07 10:34:29 EST; 7min ago
```

The `parse_gateway_uptime()` function in `tools/status-update` (which lives at `/home/laydros/.openclaw/workspace/tools/status-update`) needs its regex fixed. It should match the `; 7min ago` or `; 1h 30min ago` patterns from systemctl.

### 2. Agent Uptime shows "Unknown"
The dashboard (`app.js`) reads `data.agent.uptime` but the status-update script never populates an `agent` field in status.json. There is no `agent` key in the JSON at all.

Options:
- Remove "Agent Uptime" row from the dashboard (simplest — it's redundant with Gateway Uptime since the agent runs inside the gateway)
- OR populate it from OpenClaw somehow

**Recommendation: Remove the Agent Uptime row.** Gateway uptime already tells you if the service is running. Agent uptime is confusing and redundant.

### 3. Zag Uptime is missing from dashboard
The status-update script DOES populate `data.zag.uptime` correctly (currently "59m"). But the dashboard's `renderStatus()` function doesn't have a row for it. It was likely dropped or never added.

**Fix: Add a "Zag Uptime" row** reading from `data.zag.uptime`.

### 4. Add System Resource Metrics (NEW)
Add these to status.json (in status-update script) AND to the dashboard:

- **RAM**: Used / Total (e.g., "1.1G / 12G") — read from `/proc/meminfo` or `free`
- **Swap**: Used / Total (e.g., "0B / 6.2G") — same source
- **Disk**: Used / Total / Percent for `/` (e.g., "8.2G / 30G (27%)") — from `df` or `os.statvfs`
- **CPU Load**: 1-min load average (e.g., "0.05") — from `/proc/loadavg`

Add these to the `zag` object in status.json:
```json
"zag": {
  "uptime": "59m",
  "ram": "1.1G / 12G",
  "swap": "0B / 6.2G", 
  "disk": "8.2G / 30G (27%)",
  "loadAvg": "0.05"
}
```

And render them in the dashboard status widget.

### 5. Claude Usage shows "Unknown"
The codexbar Claude provider hangs/times out (known issue, reduced to 8s timeout). Claude usage returns null. This is a pre-existing issue — don't try to fix codexbar, just make sure the dashboard handles null gracefully (it already shows "Unknown" which is fine for now).

## Files to Edit

1. **`/home/laydros/.openclaw/workspace/tools/status-update`** — Python script that generates status.json
   - Fix `parse_gateway_uptime()` regex
   - Add RAM, swap, disk, CPU metrics to the `zag` object
   
2. **`app.js`** (in this repo, `/home/laydros/src/dev/argos/app.js`) — Dashboard JavaScript
   - Remove "Agent Uptime" row
   - Add "Zag Uptime" row
   - Add rows for RAM, Swap, Disk, CPU Load
   - Use color/emoji indicators for concerning values (e.g., RAM > 80% = red)

## Testing

After editing, run:
```bash
/home/laydros/.openclaw/workspace/tools/status-update
cat /home/laydros/.openclaw/workspace/status.json
```

Verify status.json has all fields populated, then check the dashboard renders correctly.
