# Task Markdown Format (Canonical)

This document defines the canonical task markdown format used by the task CLI and the task dashboard.

## File Structure

Tasks live in:

```
tasks/
  work/{active,backlog,someday}.md
  personal/{active,backlog,someday}.md
  agent/{active,backlog,someday}.md
  inbox.md
  history.md
```

Each task file may start with an H1 header (e.g., `# Work - Active`). The parser ignores any content before the first task header.

## Task Entry Format

Each task is a section starting with an H2 header:

```markdown
## Task Title

**Status:** Active
**Project:** task-dashboard
**Due:** 2026-02-15

Notes or context go here. Markdown allowed.
```

### Required vs Optional

- **Title** (`## Task Title`) is required.
- **Status** is required for tasks in owner buckets (`active`, `backlog`, `someday`).
- **Project** is optional.
- **Due** is optional and should only be used for hard deadlines.
- **Notes** are optional and can be multiple paragraphs.

### Metadata Ordering

Canonical ordering is:

1. `**Status:** ...`
2. `**Project:** ...` (optional)
3. `**Due:** ...` (optional)
4. Blank line
5. Notes (optional)

Parsers are tolerant of order, but the CLI writes the canonical order above.

### Due Date Format

- Preferred: `YYYY-MM-DD`
- Allowed: `YYYY-MM-DD HH:MM` for time-specific deadlines

### Urgent Flag

If the task title contains `URGENT`, `urgent`, or the `⚠️` emoji, the dashboard will highlight it.

### Uniqueness

Task titles should be unique within a file. The CLI uses the title to move/complete tasks and will error if multiple matches exist.

## Inbox Format

`tasks/inbox.md` uses the same format as other task files. Status is still written by the CLI, but inbox items are treated as untriaged.

## History Format

Done tasks are written to `tasks/history.md` with completion metadata:

```markdown
## Task Title

**Done:** 2026-02-02 15:30
**From:** work/active

(optional notes)
```

## Project Field (v1)

The `**Project:**` field is a freeform text label for grouping related tasks:

```markdown
## Fix deploy script

**Status:** Active
**Project:** z3
```

**Current capabilities (v1):**
- `task list --project z3` — filter tasks by project
- `task projects` — list all projects in use with task counts
- Dashboard can filter by project (when implemented)

No validation — any string is accepted. Projects are discovered by scanning tasks.

## Future: Project Registry (v2)

A future enhancement could add a project registry for metadata:

```markdown
# tasks/projects.md

## z3
**Path:** projects/z3/
**Status:** Active
**Description:** Check signer modernization

## Payments 2FA
**Status:** In Progress
**Description:** Add 2FA to payments portal
```

This would enable:
- Validation that project names exist
- Project-level status tracking
- Links to project folders/docs
- Project dashboard views

Not yet implemented — v1 uses simple text matching.
