# Spec: Task Detail View

**Date:** 2026-02-02  
**Status:** Ready for implementation

## Problem

Backlog and someday tasks only show title + status in a compact list. Users can't see the full task details (notes, due dates, project info) without editing the markdown files directly.

Active tasks show full cards with details, but that's too heavy for long lists.

## Solution: Hybrid Inline Expansion + Modal

### Primary: Inline Expansion (Accordion)

Click a task in backlog/someday list → details expand below the item in place.

**Behavior:**
- Click task title or row → toggle expansion
- Expanded view shows: full status, project, due date, notes (rendered as markdown)
- Click again or click another task → collapse
- Multiple tasks can be expanded at once (user preference)
- Smooth slide animation (CSS transition)

**Visual:**
```
Before click:
┌─────────────────────────────────────────┐
│ ▶ Fix the deployment script    Pending  │
└─────────────────────────────────────────┘

After click:
┌─────────────────────────────────────────┐
│ ▼ Fix the deployment script    Pending  │
├─────────────────────────────────────────┤
│ **Project:** Infrastructure             │
│ **Due:** 2026-02-15                     │
│                                         │
│ Notes about the task go here...         │
│                                         │
│                        [Open full view] │
└─────────────────────────────────────────┘
```

### Secondary: Full View Modal

For tasks with lots of content, include an "Open full view" link in the expanded area.

**Behavior:**
- Click "Open full view" → modal overlay appears
- Modal shows full task details with more room
- Close via X button, clicking backdrop, or Escape key
- Modal is optional — most tasks work fine with just inline expansion

**Visual:**
```
┌──────────────────────────────────────────────┐
│  Fix the deployment script              [X]  │
├──────────────────────────────────────────────┤
│  **Status:** Pending                         │
│  **Project:** Infrastructure                 │
│  **Due:** 2026-02-15                         │
│                                              │
│  Full notes rendered as markdown here.       │
│  Can be multiple paragraphs with all the     │
│  context needed.                             │
│                                              │
└──────────────────────────────────────────────┘
```

## Implementation Notes

### HTML Structure

For list items, change from simple `<li>` to expandable structure:

```html
<li class="task-item">
  <div class="task-summary" role="button" tabindex="0">
    <span class="expand-icon">▶</span>
    <span class="task-title">Fix the deployment script</span>
    <span class="task-meta">Pending</span>
  </div>
  <div class="task-details" hidden>
    <div class="task-details-content">
      <!-- Rendered markdown details -->
    </div>
    <button class="open-full-view">Open full view</button>
  </div>
</li>
```

### CSS

- `.task-summary` — clickable row, cursor pointer
- `.task-details` — hidden by default, slides open
- `.task-details[hidden]` — display: none or height: 0 with overflow hidden
- `.expand-icon` — rotates 90° when expanded
- Transition on max-height or use details/summary native element

### JavaScript

- Click handler on `.task-summary` toggles `hidden` attribute and rotates icon
- Store expanded state in memory (don't persist across refresh)
- Modal: create once, populate on demand, show/hide

### Modal

Reuse or create a simple modal component:
- Backdrop with semi-transparent overlay
- Centered content box
- Close on X, backdrop click, Escape key
- Trap focus while open (accessibility)

## Files to Modify

- `app.js` — Update `renderList()` to include expandable structure, add click handlers, add modal logic
- `style.css` — Add styles for expandable items and modal
- `index.html` — Add modal container (if not using JS-created element)

## Testing

1. Load dashboard, go to Tasks tab
2. Click a backlog task → should expand with details
3. Click again → should collapse
4. Click "Open full view" → modal should appear
5. Close modal via X, backdrop, or Escape
6. Verify active cards still render as before (no regression)

## Out of Scope

- Edit functionality (future)
- Move/done actions from UI (future)
- Persisting expanded state
