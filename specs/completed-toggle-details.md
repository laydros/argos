# Completed view: toggleable details

## Goal
On the Completed tab, task notes should be hidden by default and expandable via a toggle (same pattern used elsewhere: details/summary or the "show details" control used in tasks).

## Requirements
- Each completed item should display a toggle (e.g., a <details> element) that expands/collapses the task body.
- Default collapsed.
- Keep owner grouping (work/personal/agent) as-is.
- Do not show the "From:" line; keep Completed timestamp in header.
- Use the same UI style as existing expandable task details (consistency with tasks/home).

## Guidance
- Prefer reusing existing markup/styles used for expandable details in tasks view.
- If there is a reusable render helper, use it; otherwise create a small helper that builds a consistent details block.

## Files
- projects/task-dashboard/app.js
- projects/task-dashboard/style.css (if needed)
