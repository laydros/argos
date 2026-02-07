# Task CLI: Edit Command

## Overview

Add an `edit` subcommand that modifies properties of an existing task in-place, without moving it between sections or files.

## Context

- The CLI is a single Python 3 file at `cli/task` (~930 lines)
- Tasks are Obsidian vault markdown using Dataview checkbox format
- A task line looks like: `- [ ] Fix DNS #infra [priority:: high] [due:: 2026-03-01] [project:: dr] [created:: 2026-02-01]`
- Description lines are 2-space indented lines immediately following the checkbox line
- The `build_task_line()` function already constructs task lines from components
- The `VaultTask` dataclass has all fields: title, state, tags, due, project, priority, done_date, created, description
- `fuzzy_match_task()` already handles finding tasks by partial title match
- `read_file()` / `write_file()` handle file I/O
- The `raw_line` field on VaultTask stores the original checkbox line text
- The `line_number` field stores the 0-indexed line number in the file

## Feature: `task edit`

### Usage

```bash
task edit "Fix DNS" --title "Fix DNS on charon-01"
task edit "Fix DNS" --due 2026-03-15
task edit "Fix DNS" --project dr --priority high
task edit "Fix DNS" --tags infra,network
task edit "Fix DNS" --add-tag urgent
task edit "Fix DNS" --remove-tag infra
task edit "Fix DNS" --due ""              # Clear due date
task edit "Fix DNS" --description "New description line"
task edit "Fix DNS" --add-description "Another line"
task edit "Fix DNS" --clear-description
```

### Requirements

1. Add `edit` subparser with:
   - `title` (positional, required) — fuzzy match to find the task
   - `--title` — new title (rename)
   - `--due` — set/change/clear due date (empty string = clear)
   - `--project` — set/change/clear project
   - `--priority` — set/change/clear priority (choices: high, medium, low, or empty to clear)
   - `--tags` — replace ALL tags with this comma-separated list
   - `--add-tag` — add a single tag (repeatable with `action="append"`)
   - `--remove-tag` — remove a single tag (repeatable with `action="append"`)
   - `--description` / `-d` — replace ALL description lines (repeatable, each flag = one line)
   - `--add-description` — append a description line (repeatable)
   - `--clear-description` — remove all description lines (flag, `action="store_true"`)
   - `--vault-dir` — standard override

2. At least one modification flag is required. If none provided, print help and exit.

3. Implementation approach — **THE CRITICAL PART:**
   - Find the task via `fuzzy_match_task(load_all_tasks(), args.title_query)` (the positional arg)
   - Read the file lines via `read_file(filepath)`
   - Identify the task line at `task.line_number` and description lines following it
   - Build a NEW task line using `build_task_line()` with the merged fields:
     - Start with existing task's fields as defaults
     - Override with any provided flags
     - For tags: handle --tags (replace all), --add-tag (union), --remove-tag (difference)
   - Replace the old task line with the new one
   - Handle description lines:
     - `--clear-description` → remove all description lines
     - `--description` → replace all description lines with provided ones
     - `--add-description` → append to existing description lines
     - If none of these flags, keep existing description lines unchanged
   - Write file back via `write_file(filepath, lines)`

4. Print confirmation with what changed:
   ```
   ✓ Edited 'Fix DNS on charon-01'
     title: Fix DNS → Fix DNS on charon-01
     due: (none) → 2026-03-15
     project: (none) → dr
   ```

## CRITICAL: How to Reconstruct the Task Line

**DO NOT try to regex-replace parts of the raw line.** That's fragile and will break.

**DO use `build_task_line()` with the merged field values.** This function already knows the correct field order and format.

The approach:
```python
# Start with existing values
new_title = args.new_title if args.new_title else task.title
new_tags = task.tags[:]  # copy

# Apply tag modifications
if args.tags is not None:
    new_tags = [t.lstrip("#") for t in args.tags.split(",")]
if args.add_tag:
    for t in args.add_tag:
        tag = t.lstrip("#")
        if tag not in new_tags:
            new_tags.append(tag)
if args.remove_tag:
    for t in args.remove_tag:
        tag = t.lstrip("#")
        new_tags = [x for x in new_tags if x != tag]

new_due = args.due if args.due is not None else task.due
if new_due == "":
    new_due = None

new_project = args.project if args.project is not None else task.project
if new_project == "":
    new_project = None

new_priority = args.priority if args.priority is not None else task.priority
if new_priority == "":
    new_priority = None

# Build the replacement line
new_line = build_task_line(
    title=new_title,
    state=task.state,
    tags=new_tags if new_tags else None,
    priority=new_priority,
    due=new_due,
    project=new_project,
    created=task.created,
    done_date=task.done_date,
)
```

**IMPORTANT:** The `title` field on VaultTask has already been cleaned (fields/tags stripped). But `build_task_line()` expects the clean title and adds fields/tags itself. So using `task.title` as the base is correct.

## Edge Cases

- **Clearing a field:** `--due ""` should REMOVE the `[due:: ...]` field entirely, not set it to empty.
  Same for `--project ""` and `--priority ""`.
- **No changes detected:** If all provided values match existing values, print "No changes made" and exit cleanly (no file write).
- **Title rename:** When `--title` is used, the positional `title` is the search query, `--title` is the new value.
  Name the positional arg `title_query` or similar to avoid collision with the `--title` flag.
- **Ambiguous match:** `fuzzy_match_task` already handles this (prints matches and exits). No extra work needed.
- **Description lines:** Description lines in the file start with 2 spaces. When writing new description lines, prepend `"  "` if the user's input doesn't already start with spaces.
- **Preserve `created` date:** Never touch the `[created:: ...]` field during edit — always carry it forward from the original task.
- **Preserve `done` date:** Same — carry forward `[done:: ...]` if it exists.

## Argparse Setup

```python
p_edit = sub.add_parser("edit", help="Edit task properties")
p_edit.add_argument("title_query", metavar="title", help="Task title (fuzzy match)")
p_edit.add_argument("--title", dest="new_title", help="New title")
p_edit.add_argument("--due", help="Due date (YYYY-MM-DD, or empty to clear)")
p_edit.add_argument("--project", help="Project name (or empty to clear)")
p_edit.add_argument("--priority", help="Priority (high/medium/low, or empty to clear)")
p_edit.add_argument("--tags", help="Replace all tags (comma-separated)")
p_edit.add_argument("--add-tag", action="append", default=None, help="Add a tag (repeatable)")
p_edit.add_argument("--remove-tag", action="append", default=None, help="Remove a tag (repeatable)")
p_edit.add_argument("--description", "-d", action="append", default=None, help="Replace description (repeatable, each = one line)")
p_edit.add_argument("--add-description", action="append", default=None, help="Append description line (repeatable)")
p_edit.add_argument("--clear-description", action="store_true", help="Remove all description lines")
p_edit.add_argument("--vault-dir", help="Override vault directory (or set ARGOS_VAULT_DIR).")
```

**Don't forget** to add `p_edit.set_defaults(func=cmd_edit)` and handle it in the dispatch section at the bottom of the file (look at how other commands are dispatched).

## Testing

After implementation, verify with the REAL vault (not --vault-dir /tmp):

```bash
# Check a task exists first
python3 cli/task list --owner personal --section backlog --compact

# Test editing a low-risk task (the sample completed one)
python3 cli/task list --owner personal --section done --compact

# Test help
python3 cli/task edit --help

# Test error: no modification flags
python3 cli/task edit "Sample"

# Test --add-tag on a real task (safe, additive)
python3 cli/task edit "Dentist" --add-tag health
python3 cli/task list --tag health --compact
# Should show the dentist task

# Clean up: remove the tag
python3 cli/task edit "Dentist" --remove-tag health

# Test --due clear
python3 cli/task edit "Dentist" --due ""
python3 cli/task list --owner personal --compact | grep -i dentist
# Should show no due date

# Restore it
python3 cli/task edit "Dentist" --due 2026-02-15
```

**CRITICAL: Do NOT edit tasks destructively during testing. Only add/remove tags and dates that can be easily restored. Do NOT rename tasks or change their descriptions unless you restore them.**
