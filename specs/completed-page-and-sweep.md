# Completed Tasks Page + Auto-Sweep

## Goals
1. **Dashboard**: Add a **Completed** tab/page so completed tasks don't clutter the Tasks view.
2. **Tasks page**: Keep **Active + Backlog + Someday** on Tasks page (Someday stays).
3. **Completed tracking**: Keep a **single** `tasks/completed.md` file, but group completed items by owner (work/personal/agent) using the `**From:** owner/bucket` field.
4. **Fix "completed tag but still in backlog"**: Add a CLI command to **sweep** tasks that have a completed status and move them to `tasks/completed.md`.

---

## Dashboard Changes (projects/task-dashboard)

### UI
- Add a new **Completed** tab in the top nav.
- Create a **Completed** view/panel.
- When Completed tab is active:
  - Show Completed view
  - Hide Tasks view
  - Hide Tasks filters (`#tasks-controls`) unless on Tasks tab (existing behavior)

### Data
- Fetch `tasks/completed.md` from `/data/tasks/completed.md` (same as existing task fetch logic).
- Parse tasks (same `## Title` pattern). Body includes:
  - `**Completed:** YYYY-MM-DD HH:MM`
  - `**From:** owner/bucket`
- Group by owner: `work`, `personal`, `agent` based on `From:`.
  - If missing, group under `Other`.

### Rendering
- Completed page shows sections like:
  - Work
  - Personal
  - Zag
- Each section lists tasks with title + Completed timestamp + From.

---

## CLI Changes (tools/task)

### New command: `task sweep`
- Scans all tasks in:
  - `tasks/work/{active,backlog,someday}.md`
  - `tasks/personal/{active,backlog,someday}.md`
  - `tasks/agent/{active,backlog,someday}.md`
- Detect tasks whose **Status** indicates completion. Match if status contains any of:
  - `complete`, `completed`, `✅` (case-insensitive)
- For each match:
  1. Remove from source file
  2. Append to `tasks/completed.md` using same format as `task done`:
     ```
     ## Title

     **Completed:** YYYY-MM-DD HH:MM
     **From:** owner/bucket
     ```
- Output a summary: how many tasks moved per owner/bucket.

### Optional (nice):
- `task archive` should call sweep first (so completed statuses get moved before archival).
- Update `tools/README.md` usage section with `task sweep`.
- Update `test_task.py` to include a sweep test.

---

## Notes
- Keep existing file structure; **do not** introduce per-owner completed files.
- Completed page should be read-only (no edits).
- If no completed tasks, show a friendly empty-state message.
