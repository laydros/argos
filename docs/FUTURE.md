# Future Considerations

Ideas and design thinking for future dashboard capabilities. Not committed - just documented for later decision.

## Calendar Integration

**Problem:** Home tab has calendar widget placeholder, needs backend.

**Proposed approach:**
- Cron job runs 3-4x daily
- Executes `khal list today tomorrow +2days --format json`
- Writes to `data/calendar-preview.json`
- Dashboard fetches and renders (static page, fresh data)

**Benefits:**
- Keeps dashboard serverless/static
- Data fresh enough for daily use
- No runtime khal calls needed

**Status:** Documented 2026-02-02, not implemented

---

## History Filtering

**Problem:** History tab shows every done task forever; needs ways to narrow the list.

**Possible filters:**
- Time window (last 7/14/30/90 days)
- Owner (work/personal/agent/inbox)
- Project (`**Project:**` field)
- Text search
- Collapsible month/year groupings

**Decision:** Pending

---

## Task Add Capability

**Problem:** Dashboard is currently read-only. Can view tasks but can't add/move/complete from UI.

**Constraint:** Task CLI (`tools/task`) is the enforcement/safety layer. Should remain single source of truth.

**Options considered:**

### Option 1: Minimal Express Server
- Lightweight Node.js server
- API endpoints: `/api/tasks/add`, `/api/tasks/move`, `/api/tasks/done`
- Server calls CLI tool as backend: `exec('./tools/task add ...')`
- Serves static files + JSON API
- Caddy proxies to it

**Pros:**
- Keeps CLI as single source of truth
- Thin API layer, no logic duplication
- Full CRUD from dashboard

**Cons:**
- Adds server process to maintain
- More complex deploy

### Option 2: CGI-Style Handler
- PHP/Python CGI script
- Form POST → calls CLI → returns JSON
- Apache/Caddy CGI module

**Pros:**
- Lighter than full server
- Simple request/response

**Cons:**
- CGI slower/less flexible than server
- Still needs write access setup

### Option 3: Keep CLI-Only
- Dashboard remains read-only view
- CLI (or future mobile/voice) handles writes
- Accept split UX for now

**Pros:**
- No additional infrastructure
- Dashboard simple/fast

**Cons:**
- Less convenient
- Can't add tasks from browser

---

**Decision:** Pending. the user needs time to think through trade-offs.

**Documented:** 2026-02-02 20:51 EST

---

## Git Remote / GitHub Backup

**Current backup:** internal backup pipeline (sync + cloud backup)

**Consideration:** If we sanitize personal data (OpenClaw token, etc.), could add GitHub as remote.

**Benefits:**
- Additional off-site backup
- Potential for sharing sanitized workspace/dashboard code
- Standard git workflow

**Challenges:**
- Need sanitization strategy (tokens, personal context)
- Currently workspace contains personal memory/context
- Would need `.gitignore` patterns or pre-commit hooks

**Status:** Documented 2026-02-02, not implemented

**Note:** Current git repo is local-only with SyncThing backup. GitHub would be additional, not replacement.
