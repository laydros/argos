# Project Registry Spec

**Status:** Implemented  
**Date:** 2026-02-02

## Final Decisions

1. **Location:** `tasks/projects.md`
2. **Format:** Title Case, case-insensitive matching
3. **Statuses:** Active / On Hold / Completed
4. **Unregistered projects:** Auto-register with Status: Active
5. **Widget click:** Navigate to Tasks tab with project filter applied

## Problem

Tasks can have a `**Project:**` field, but:
- No way to list all projects (only discover via scanning tasks)
- No project-level status (Active / On Hold / Completed)
- No project metadata (description, links)
- Can't have a project with zero current tasks (like Payments 2FA on hold)

## Solution

Add a simple project registry file: `tasks/projects.md`

## Registry Format

```markdown
# Projects

## project-slug

**Status:** Active | On Hold | Completed
**Description:** One-line description

Optional notes, links, context.

---
```

### Example

```markdown
# Projects

## z3

**Status:** Active
**Description:** Modernizing internal inventory/support system

## disaster-recovery

**Status:** Active
**Description:** Infrastructure backup, redundancy, migration

Related: database migration, infrastructure updates

## wypayments-2fa

**Status:** On Hold
**Description:** Add 2FA to payments portal

Paused pending other priorities.

## task-dashboard

**Status:** Active
**Description:** Zag's web dashboard for tasks, files, and status
```

## Project Slugs

- Lowercase, hyphenated (e.g., `disaster-recovery`, not `Disaster Recovery`)
- Used in `**Project:** slug` on tasks
- Case-insensitive matching

## CLI Changes

### `task projects` (update existing)

Current: Scans tasks for unique Project values
New: Reads registry, shows status, counts tasks

```
$ task projects

Projects:
==================================================
  z3              Active     3 tasks (2 active, 1 backlog)
  disaster-recovery Active   5 tasks (1 active, 4 backlog)
  wypayments-2fa  On Hold    0 tasks
  task-dashboard  Active     1 task (1 backlog)

Total: 4 projects
```

### `task project <slug>` (new command)

Show project details + all related tasks:

```
$ task project disaster-recovery

## disaster-recovery
**Status:** Active
**Description:** Infrastructure backup, redundancy, migration

Tasks:
  [work/active] Database Server Migration
  [work/backlog] Backup router configuration
  [work/backlog] Server ZFS snapshot config
  [work/backlog] DNS configuration fix
  [work/backlog] server-02 completion
```

### `task add --project` (no change)

Still accepts any string. Unregistered projects show a warning:
```
⚠ Project "foo" not in registry. Add it to tasks/projects.md?
```

## Dashboard Changes

### Projects Widget (Home tab)

Current: Shows Zag active tasks (mislabeled)
New: Shows registered projects with status + task counts

```
┌─────────────────────────────────────┐
│ Projects                            │
├─────────────────────────────────────┤
│ 🟢 z3                    3 tasks    │
│ 🟢 disaster-recovery     5 tasks    │
│ 🟡 wypayments-2fa        on hold    │
│ 🟢 task-dashboard        1 task     │
└─────────────────────────────────────┘
```

Status indicators:
- 🟢 Active
- 🟡 On Hold  
- ⚪ Completed

Clicking a project → filters Tasks tab to that project

### Tasks Tab Filter

Already implemented. No changes needed — just needs projects to exist.

## Migration

1. Create `tasks/projects.md` with known projects
2. Update existing tasks with proper `**Project:**` slugs
3. Update CLI to read registry
4. Update dashboard widget to read registry

## Open Questions

1. Should projects live in `tasks/projects.md` or `projects/registry.md`?
2. Should we support project hierarchy (sub-projects)?
3. Should completed projects auto-hide or show with strikethrough?

## Out of Scope (for now)

- Project deadlines/milestones
- Project notes/documentation (use `projects/<slug>/` folders for that)
- Time tracking per project
- Project dependencies
