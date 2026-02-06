# AGENTS.md — AI Development Guide

Instructions for AI coding agents working on Argos.

## Project Structure

```
argos/
├── index.html          # Dashboard HTML
├── app.js              # Dashboard JavaScript (main application logic)
├── style.css           # Styles
├── cli/
│   ├── task            # Python CLI for vault-format task CRUD
│   └── task-legacy     # Legacy bash CLI (deprecated)
├── config.example.json # Configuration template
├── specs/              # Feature specifications
└── docs/               # Design history and internal specs
```

## Architecture

- **Static web app** — no build step, no framework, no server-side rendering
- **Data via HTTP** — all data fetched from `/data/` prefix (configurable)
- **CLI is Python** — vault-task CLI, no external dependencies beyond stdlib
- **Config-driven** — deployment-specific settings in config.json (gitignored)

## Task Format

Tasks use Obsidian Dataview checkbox format. See README.md for full spec.

Key parsing rules:
- `## Section` headers define task grouping (Active/Backlog/Someday/Done)
- `- [state] Title #tags [field:: value]` is a task line
- 2-space indented lines after a task are its description
- YAML frontmatter is preserved exactly on writes

## Working on the CLI

```bash
# Test after changes
python3 cli/task list
python3 cli/task health

# Set custom vault directory
export ARGOS_VAULT_DIR="/path/to/vault"
python3 cli/task list
```

## Working on the Dashboard

The dashboard is plain HTML/JS/CSS. To test locally:

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

Note: data widgets won't load without a proper data directory configured.

## Conventions

- No external JS dependencies (vanilla JS only)
- No build step — edit and reload
- Config values never hardcoded — use config.json
- Python CLI uses only stdlib (no pip dependencies)
- Commit messages: descriptive, imperative mood
