# Task Dashboard Spec v3

**Last Updated:** 2026-02-02

## Overview

Dashboard for Zag workspace with four tabs: Home (default), Tasks, Files, OpenClaw.

## Tabs

### Home (Default)
The landing page showing current state at a glance.

**Widgets:**
- **📍 Context** - First section from today's memory log (`memory/YYYY-MM-DD.md`)
- **📅 Today** - Calendar events (placeholder - needs backend integration)
- **🔥 Active Now** - All active tasks from work/personal/agent with owner badges
- **📊 Projects** - Vine status + Zag's active work items
- **⚡ Quick Stats** - Active/Backlog/Inbox counts
- **🌤️ Weather** - Current weather from wttr.in (configured location)

### Tasks
Full task management view.

**Structure:**
- **Active** (cards) - All active tasks from work/personal/agent with owner badges
- **Backlog** (list) - Combined backlog with owner badges
- **Inbox** (list) - Unsorted items
- **Someday** (collapsible list) - Lower priority items with owner badges

**Task sources:**
```
/data/tasks/work/active.md
/data/tasks/work/backlog.md
/data/tasks/work/someday.md
/data/tasks/personal/active.md
/data/tasks/personal/backlog.md
/data/tasks/personal/someday.md
/data/tasks/agent/active.md
/data/tasks/agent/backlog.md
/data/tasks/agent/someday.md
/data/tasks/inbox.md
```

### Files
Workspace file browser.

- Directory listing from `/data/`
- Breadcrumb navigation
- Parent directory link (↑ ..)
- Click to open files/folders

### OpenClaw
Link to OpenClaw web UI.

- Opens `http://localhost:18789/?token=...` directly (not proxied - WebSocket issues)

## Eyebrows

Each tab has its own eyebrow text:
- Home: "Welcome back"
- Tasks: "Focus now"
- Files: "Browse files"
- OpenClaw: "Control panel"

## URL

Served at `http://localhost/` via Caddy.

## Tech Stack

- Vanilla HTML/CSS/JS
- marked.js for markdown rendering
- wttr.in for weather
- Caddy file_server browse for /data/

## Evolution

- **v1:** Task-only dashboard (active/backlog/someday/inbox)
- **v2:** Added tabs (Tasks, Files, OpenClaw), file browser
- **v3:** New task structure (work/personal/agent), Home tab with widgets, owner badges, weather
