# Task: Add --description flag to `task add`

## Context
The `task` CLI (`cli/task`) manages Obsidian vault-format tasks. Currently `task add` creates a checkbox line but has no way to add description lines. Description lines are 2-space indented lines below the checkbox, already supported by the parser.

## Requirements

Add a `--description` / `-d` flag to the `add` subcommand.

### Behavior
1. `--description "Some text"` adds a single 2-space indented description line below the new task checkbox line
2. Multiple `-d` flags should be supported to add multiple description lines:
   ```
   task add -o work -s active "Fix DNS" -d "Check charon-01 first" -d "May need to restart bind"
   ```
3. Each description value becomes one `  <text>` line (2-space indent prefix)
4. Description lines are inserted immediately after the checkbox line, before any subsequent tasks or blank lines

### Implementation Details
- In `build_parser()`: Add `--description` / `-d` to `p_add` with `action="append"` and `default=None`
- In `cmd_add()`: After inserting the task_line, also insert description lines if `args.description` is not None
- Each description line should be formatted as `  {text}` (2-space indent)
- The insert logic already handles positioning; descriptions just need to be inserted on consecutive lines after the task line

### Example
```bash
task add -o zag -s backlog "Add --description flag to task CLI" -d "Support multiple -d flags" -d "2-space indent format"
```

Produces in the markdown file:
```markdown
- [ ] Add --description flag to task CLI [created:: 2026-02-07]
  Support multiple -d flags
  2-space indent format
```

### Testing
- Run `task add -o zag -s backlog "Test desc" -d "line one" -d "line two"` and verify the file output
- Run `task add -o zag -s backlog "Test no desc"` and verify it still works without -d
- Run `task list` and verify descriptions display correctly under the task
- Run `task health` to confirm no format issues introduced

## Files to modify
- `cli/task` — the only file that needs changes
