# Task Dashboard - Design Spec

## Purpose
A simple web dashboard to visualize the user's task system. ADHD-friendly: clear focus, minimal clutter, show what matters NOW.

## Data Sources
Parse markdown files from `../../tasks/`:
- `active.md` - In-flight tasks (PRIMARY FOCUS)
- `backlog.md` - Ready to work on
- `someday.md` - Lower priority
- `inbox.md` - Raw capture, needs sorting

## Tech Stack
Keep it simple:
- **Static HTML/CSS/JS** - no build step, just open in browser
- **Single page** - everything visible at once
- Parse markdown client-side (use marked.js or similar)
- Serve locally or just open file:// directly

## Layout

```
┌─────────────────────────────────────────────────────┐
│  📋 Task Dashboard                        [Refresh] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔥 ACTIVE (2)                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ ⚠️ Widget Alpha - 45 published, 77% ratio   │   │
│  │ 📦 DB Migration - testing phase        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  📝 BACKLOG (8)           📥 INBOX (3)             │
│  ┌───────────────────┐    ┌───────────────────┐   │
│  │ • Item 1          │    │ • Raw item 1      │   │
│  │ • Item 2          │    │ • Raw item 2      │   │
│  │ • Item 3          │    │ ...               │   │
│  │ ...               │    └───────────────────┘   │
│  └───────────────────┘                             │
│                                                     │
│  💭 SOMEDAY (12) [collapsed by default]            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Design Principles

1. **Active tasks dominate** - largest section, most visual weight
2. **Counts visible** - see how big each pile is at a glance
3. **Inbox visible** - don't let raw capture pile up unseen
4. **Someday collapsed** - there but not distracting
5. **Dark mode** - easier on eyes, looks good
6. **No frameworks** - vanilla JS, minimal dependencies

## Parsing Rules

The task files use markdown with `##` headers for task names:
- Extract `## Task Name` as task titles
- Everything under a `##` until next `##` is task details
- Look for `⚠️` or `URGENT` to flag priority
- Look for `**Status:**` lines for status info

## File Structure

```
argos/
├── SPEC.md          # This file
├── index.html       # Main dashboard
├── style.css        # Styles (dark mode)
├── app.js           # Logic: fetch, parse, render
└── README.md        # How to use
```

## Nice-to-haves (later)
- Auto-refresh every 30s
- Keyboard shortcuts
- Click to expand task details
- Last modified timestamps
