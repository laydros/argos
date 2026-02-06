# Zag Dashboard v2 - Tabbed Interface

## Overview

Expand from task-only dashboard to a full Zag home dashboard with tabbed navigation.

## Tabs

1. **Tasks** (default) - Current task dashboard view
2. **Files** - Workspace file browser
3. **OpenClaw** - Embedded or linked OpenClaw web UI

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🔥 Zag Dashboard                                           │
│  ┌────────┐ ┌────────┐ ┌──────────┐                        │
│  │ Tasks  │ │ Files  │ │ OpenClaw │           [Refresh]    │
│  └────────┘ └────────┘ └──────────┘                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Tab content area - switches based on selected tab]        │
│                                                             │
│  Tasks tab:    Current task cards/lists (active/backlog/    │
│                inbox/someday)                               │
│                                                             │
│  Files tab:    Directory listing of workspace               │
│                Click folders to navigate                    │
│                Click files to view (or download)            │
│                Breadcrumb navigation                        │
│                                                             │
│  OpenClaw tab: iframe embedding /claw/ OR                   │
│                simple "Open OpenClaw" button/link           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Technical Approach

### Tab Switching
- Pure JS, no framework
- Show/hide content divs based on active tab
- URL hash for deep linking (#tasks, #files, #openclaw)
- Remember last tab in localStorage

### Tasks Tab
- Keep existing task loading/rendering logic
- Already works, just wrap in a tab container

### Files Tab
- Fetch directory listing from `/data/` path
- Caddy's `file_server browse` returns HTML listing
- Parse and render nicely, or use iframe
- Better: fetch JSON listing if possible, or scrape HTML listing

### OpenClaw Tab
- Option A: iframe to `/claw/` (may have issues)
- Option B: Large button "Open OpenClaw in new tab"
- Start with Option B (simpler, always works)

## File Changes

- `index.html` - Add tab structure, wrap task content
- `style.css` - Add tab styles
- `app.js` - Add tab switching logic, file browser logic

## Design

- Keep existing dark mode aesthetic
- Tabs should feel native to current design
- Active tab highlighted with accent color
- Smooth transitions between tabs

## Rollback

If this doesn't work: `git checkout argos-v1 -- projects/argos/`
