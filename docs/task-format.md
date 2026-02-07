# Task Format

The task CLI and dashboard use **Obsidian Dataview checkbox format** — plain Markdown that's readable by humans, parseable by Dataview queries, and easy for AI agents to manipulate.

## File Layout

Each "owner" gets one task file with all sections:

```
obnotes/
├── work/work-tasks.md
├── personal/personal-tasks.md
├── zag/zag-tasks.md         # AI agent / automation tasks
└── inbox.md                 # Quick capture, triaged later
```

> **Why "zag"?** This project was built for use with an AI assistant named Zag (an [OpenClaw](https://github.com/openclaw/openclaw) agent). Where you see "zag" in owner names and file paths, think "agent" or "automation" — it's the bucket for tasks the AI agent owns. If you're adapting this for your own setup, rename it to whatever fits. The CLI reads owner names from its config, not hardcoded.

## Task Entry Format

```markdown
- [ ] Task title #tag [due:: 2026-02-15] [project:: myproject] [created:: 2026-02-01]
  Optional description lines (2-space indent)
  Can be multiple lines
```

### Checkbox States

| Syntax | State | Meaning |
|--------|-------|---------|
| `[ ]` | todo | Not started |
| `[/]` | in-progress | Currently working on |
| `[x]` | done | Completed |
| `[-]` | cancelled | Won't do |

### Inline Fields

Dataview-style `[field:: value]` syntax, placed inline after the title:

| Field | Required | Description |
|-------|----------|-------------|
| `[created:: YYYY-MM-DD]` | Yes | When the task was created (auto-added by CLI) |
| `[due:: YYYY-MM-DD]` | No | Hard deadline only — not for "would be nice by" dates |
| `[project:: name]` | No | Project grouping |
| `[priority:: high\|medium\|low]` | No | Priority level |
| `[done:: YYYY-MM-DD]` | Auto | Added when marked done |

### Tags

Standard Obsidian `#tag` syntax, inline with the title:

```markdown
- [ ] Fix DNS on charon-01 #infra #urgent [project:: dr] [created:: 2026-02-07]
```

### Descriptions

Indented lines (2 spaces) immediately following a task are its description:

```markdown
- [ ] Finish upstairs landing floor #home [created:: 2026-02-07]
  Vinyl flooring ~90% done. Need miter saw access.
  See [[floor-replacement]] for full notes.
```

The parser collects these until it hits a non-indented line or another checkbox.

## Sections

Each task file is divided into sections with `## ` headers:

```markdown
## Active

- [/] Thing I'm working on right now [created:: 2026-02-01]

## Backlog

- [ ] Ready to work on when there's time [created:: 2026-02-03]

## Someday

- [ ] Lower priority, can wait [created:: 2026-01-15]

## Done

- [x] Finished task [done:: 2026-02-05] [created:: 2026-02-01]
```

**Section order:** Active → Backlog → Someday → Done

The CLI enforces this order when creating new sections. Tasks in Done should have `[x]` state and a `[done::]` date.

### Philosophy: Priority, Not Dates

Sections represent **concern level**, not deadlines:

- **Active** — In your head right now. High focus.
- **Backlog** — Ready to go, not urgent.
- **Someday** — Might matter eventually.
- **Done** — Completed (with date for history).

Things don't become "overdue" — they're just still in progress. Use `[due::]` only for real external deadlines.

## Frontmatter

Task files should include YAML frontmatter:

```yaml
---
date: 2026-02-01
updated: 2026-02-07
tags:
  - tasks
---
```

The CLI auto-updates the `updated:` field on every write.

## Inbox

`inbox.md` is a quick-capture file. It doesn't need all four section headers — just tasks to be triaged later. The `move` command can relocate tasks to their proper owner/section.
