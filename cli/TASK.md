# Task CLI: Cross-Owner Move & List Filtering

## Overview

Add two features to the `task` CLI (`cli/task`):

1. **`--to-owner` flag on `move` command** — move tasks between owner files (e.g., inbox → work, personal → work)
2. **`--tag` and `--project` filters on `list` command** — filter tasks by tag or project field

## Context

- The CLI is a single Python 3 file at `cli/task` (885 lines)
- Task files are Obsidian vault markdown using Dataview checkbox format
- File locations are defined in `TASK_FILES` dict and `INBOX_FILE` constant near the top of the file
- Valid owners: `work`, `personal`, `zag`, `inbox`
- Valid sections: `Active`, `Backlog`, `Someday`, `Done`
- Tasks can have tags (`#tag`), projects (`[project:: name]`), and other Dataview fields
- The `VaultTask` dataclass already has `owner`, `tags`, and `project` fields

## Feature 1: `--to-owner` on `move`

### Current behavior
`task move "Task title" --to Active` moves a task between sections **within the same file**.

### New behavior
`task move "Task title" --to Active --to-owner work` moves a task to a **different owner's file** and into the specified section.

### Requirements

1. Add `--to-owner` optional argument to the `move` subparser
2. When `--to-owner` is provided:
   - Validate it's a valid owner (keys of `TASK_FILES` or `"inbox"`)
   - Find the task in its current file (using existing `fuzzy_match_task`)
   - Remove the task (and its description lines) from the source file
   - Add the task to the target owner's file in the specified section
   - If the task came from inbox, the source file is `INBOX_FILE`
   - If moving TO inbox, the target file is `INBOX_FILE` (unlikely but handle it)
3. Print confirmation: `✓ Moved 'Task title' from inbox → work/Active`
4. Both `--to` (section) is still required when `--to-owner` is used

### Edge cases
- If `--to-owner` matches the task's current owner, behave like normal move (just change section)
- Inbox tasks have owner="inbox" — make sure fuzzy match works on inbox tasks too
- Target section must exist in destination file (use existing `ensure_section_exists`)

## Feature 2: `--tag` and `--project` on `list`

### Current behavior
`task list` can filter by `--owner` and `--section` only.

### New behavior
- `task list --tag health` — show only tasks with `#health` tag
- `task list --project dr` — show only tasks with `[project:: dr]`
- Filters combine with existing `--owner` and `--section` (AND logic)

### Requirements

1. Add `--tag` and `--project` optional arguments to the `list` subparser
2. Filter the task list after loading:
   - `--tag`: match if the tag appears in `task.tags` list (case-insensitive)
   - `--project`: match if `task.project` equals the value (case-insensitive)
3. Multiple `--tag` flags should be OR (match any tag), not AND
4. `--project` and `--tag` together should be AND (must match both)

## Testing

After implementation, verify these work:

```bash
# Cross-owner move
task add --owner zag --section backlog "Test cross-owner move"
task move "Test cross-owner" --to active --to-owner work
task list --owner work --section active  # Should show the task

# Filter by tag
task list --tag health
task list --tag health --owner personal

# Filter by project
task list --project dr
task list --project dr --section active

# Clean up
task done "Test cross-owner"
```

## Implementation notes

- The `read_file` and `write_file` helpers already handle file I/O
- `ensure_section_exists` already creates missing sections
- `find_insert_point` already finds where to insert in a section
- For cross-owner move, you're basically doing a remove from file A + add to file B
- The existing `cmd_move` already handles extracting task + description lines — reuse that logic
- Don't change the `VaultTask` dataclass or `parse_tasks` function — they already have all needed fields
