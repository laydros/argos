# Completed View: Show Task Content

## Goal
When viewing the Completed tab, show the task body/notes content if present. The "From: backlog/someday" bucket is not important; ownership grouping is still useful.

## Requirements

### Dashboard UI (projects/task-dashboard)
- Completed items should display **task content/body** under the title if any exists.
- Content should be read-only, formatted like task details.
- Hide/ignore metadata lines in the body for display:
  - `**Status:**`
  - `**Completed:**`
  - `**From:**`
- Keep grouping by owner (work/personal/agent). The bucket (backlog/someday) is not important to show.
- The "From:" label can be removed from UI, or keep only owner if needed. Prefer removing it.

### CLI (tools/task)
- When moving tasks to `tasks/completed.md` (both `task done` and new `task sweep`), **preserve the original task body/notes** so the Completed view can show meaningful content.
- Append the body after the Completed/From metadata block (with a blank line before the body).
- Do **not** duplicate the `**Completed:**` or `**From:**` lines in the body.

### Tests
- Update `tools/test_task.py` to verify that body/notes are preserved in completed.md for both `task done` and `task sweep`.

## Files to touch
- `projects/task-dashboard/app.js`
- `projects/task-dashboard/style.css` (optional if needed)
- `tools/task`
- `tools/test_task.py`

## Notes
- Use existing render helpers if possible (e.g., `renderDetails`).
- Completed view should look consistent with Tasks view.
