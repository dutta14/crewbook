# Crewbook Design System

> **Author**: Kai, Senior Design Systems Engineer
> **Reference implementation**: `finance-tracking` app (same workspace, same stack)
> **Stack**: React 18 · TypeScript · Vite · encrypted localStorage · CSS custom properties

---

## Part 1 — Design System Strategy

### 1.1 Color Tokens

Crewbook uses semantic CSS custom properties. All colors are defined in `src/styles/colorThemes.css`. Dark mode is toggled via `body.dark` class (not `@media prefers-color-scheme`), matching `finance-tracking`.

#### Brand & Accent

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--accent` | `#0f766e` | `#14b8a6` | Primary actions, active nav, links |
| `--accent-hover` | `#0d6460` | `#2dd4bf` | Hovered primary buttons/links |
| `--accent-subtle` | `rgba(15,118,110,0.08)` | `rgba(20,184,166,0.12)` | Selected row bg, active filters |
| `--accent-ring` | `rgba(15,118,110,0.35)` | `rgba(20,184,166,0.4)` | Focus ring color |

#### Surface & Background

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#f9fafb` | `#0f172a` |
| `--color-surface` | `#ffffff` | `#1e293b` |
| `--color-surface-alt` | `#f1f5f9` | `#334155` |
| `--color-surface-raised` | `#ffffff` | `#273548` |
| `--color-overlay` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` |

#### Text

| Token | Light | Dark |
|---|---|---|
| `--color-text` | `#111827` | `#f1f5f9` |
| `--color-text-secondary` | `#374151` | `#cbd5e1` |
| `--color-text-muted` | `#6b7280` | `#94a3b8` |
| `--color-text-placeholder` | `#9ca3af` | `#64748b` |
| `--color-text-on-accent` | `#ffffff` | `#ffffff` |

#### Borders

| Token | Light | Dark |
|---|---|---|
| `--color-border` | `#e5e7eb` | `#334155` |
| `--color-border-strong` | `#d1d5db` | `#475569` |
| `--color-border-focus` | `var(--accent)` | `var(--accent)` |

#### Status (People Management Semantics)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--status-active` | `#10b981` | `#34d399` | Active team members |
| `--status-active-bg` | `rgba(16,185,129,0.1)` | `rgba(52,211,153,0.15)` | Active badge bg |
| `--status-on-leave` | `#f59e0b` | `#fbbf24` | On leave / PTO |
| `--status-on-leave-bg` | `rgba(245,158,11,0.1)` | `rgba(251,191,36,0.15)` | On-leave badge bg |
| `--status-departing` | `#ef4444` | `#f87171` | Departing / flight risk |
| `--status-departing-bg` | `rgba(239,68,68,0.1)` | `rgba(248,113,113,0.15)` | Departing badge bg |
| `--status-new-hire` | `#3b82f6` | `#60a5fa` | New hires |
| `--status-new-hire-bg` | `rgba(59,130,246,0.1)` | `rgba(96,165,250,0.15)` | New-hire badge bg |

#### Feedback & Severity

| Token | Light | Dark |
|---|---|---|
| `--color-positive` | `#10b981` | `#34d399` |
| `--color-warning` | `#f59e0b` | `#fbbf24` |
| `--color-negative` | `#ef4444` | `#f87171` |
| `--color-info` | `#3b82f6` | `#60a5fa` |

---

### 1.2 Typography

#### Font Stack

```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;
```

#### Size Scale

| Token | Value | Usage |
|---|---|---|
| `--fs-2xs` | `0.6875rem` (11px) | Metadata labels, timestamps |
| `--fs-xs` | `0.75rem` (12px) | Badges, captions, table footnotes |
| `--fs-sm` | `0.875rem` (14px) | Body text in dense UI, table cells |
| `--fs-md` | `1rem` (16px) | Default body, form inputs |
| `--fs-lg` | `1.125rem` (18px) | Section headings, card titles |
| `--fs-xl` | `1.25rem` (20px) | Page sub-headings |
| `--fs-2xl` | `1.5rem` (24px) | Page titles |
| `--fs-3xl` | `1.875rem` (30px) | Dashboard hero numbers |

#### Weights

| Token | Value | Usage |
|---|---|---|
| `--fw-normal` | `400` | Body text |
| `--fw-medium` | `500` | Labels, table headers, nav items |
| `--fw-semibold` | `600` | Card titles, section headings |
| `--fw-bold` | `700` | Page titles, emphasis |

#### Line Heights

| Token | Value | Usage |
|---|---|---|
| `--lh-tight` | `1.25` | Headings, badges |
| `--lh-normal` | `1.5` | Body text |
| `--lh-relaxed` | `1.625` | Long-form content (1:1 notes) |

#### Tabular Numbers

Data-dense views (tables, metrics, dates) use `font-feature-settings: 'tnum'` for aligned columns.

---

### 1.3 Spacing Scale

8px base grid. All spacing uses multiples of 4px for sub-grid flexibility.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `4px` | Inline icon gaps, badge padding-y |
| `--space-2` | `8px` | Compact padding, list item gaps |
| `--space-3` | `12px` | Card padding (compact), input padding-x |
| `--space-4` | `16px` | Card padding (standard), section gaps |
| `--space-5` | `20px` | Form group gaps |
| `--space-6` | `24px` | Section padding, card padding (spacious) |
| `--space-8` | `32px` | Page section margins |
| `--space-10` | `40px` | Page top/bottom padding |
| `--space-12` | `48px` | Major section separators |

---

### 1.4 Border Radii & Shadows

#### Radii

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Badges, small buttons, code blocks |
| `--radius` | `8px` | Cards, modals, dropdowns, inputs |
| `--radius-lg` | `12px` | Large cards, hero panels |
| `--radius-pill` | `9999px` | Pill badges, avatar circles |

#### Shadows

```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
--shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.04);
```

Dark mode shadows use lower opacity and subtle accent glow:
```css
body.dark {
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --shadow-accent-glow: 0 0 20px rgba(20,184,166,0.1);
}
```

---

### 1.5 Motion & Transitions

| Token | Value | Usage |
|---|---|---|
| `--duration-fast` | `120ms` | Button press, toggle, checkbox |
| `--duration-base` | `200ms` | Hover effects, input focus |
| `--duration-slow` | `350ms` | Modal open/close, sidebar collapse |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | General exit/settle |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy enter (toasts, popovers) |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Symmetric transitions |

**Reduced motion**: Wrap all animations in `@media (prefers-reduced-motion: no-preference)`. When reduced motion is preferred, set `transition-duration: 0.01ms`.

---

### 1.6 Component Library

#### Avatar

Circular container with initials fallback. Size variants:

| Size | Dimensions | Font Size | Usage |
|---|---|---|---|
| `xs` | 24×24 | 10px | Inline mentions, dense lists |
| `sm` | 32×32 | 12px | Table rows, compact cards |
| `md` | 40×40 | 14px | List items, standard cards |
| `lg` | 56×56 | 18px | Detail page header |
| `xl` | 80×80 | 24px | Profile hero |

- Background: generate from name hash using `--status-*-bg` palette
- Text color: `--color-text` at `font-weight: 600`
- Border: `2px solid var(--color-surface)` (for overlapping avatar groups)
- Group overlap: negative margin `-8px` with `z-index` stacking

#### Badge

Pill-shaped status indicator.

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
  line-height: var(--lh-tight);
  white-space: nowrap;
}
```

Variants: `active`, `on-leave`, `departing`, `new-hire`, `neutral`.
Each variant uses `color: var(--status-X)` and `background: var(--status-X-bg)`.

#### Button

| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| `primary` | `var(--accent)` | `var(--color-text-on-accent)` | none | Save, Create, Confirm |
| `secondary` | `transparent` | `var(--color-text)` | `var(--color-border)` | Cancel, Back, secondary actions |
| `ghost` | `transparent` | `var(--color-text-muted)` | none | Toolbar icons, inline actions |
| `danger` | `var(--color-negative)` | `#ffffff` | none | Delete, destructive |

Sizes: `sm` (28px height, fs-xs), `md` (36px height, fs-sm), `lg` (44px height, fs-md).

All buttons: `border-radius: var(--radius)`, `font-weight: var(--fw-medium)`, `cursor: pointer`.
Focus: `outline: 2px solid var(--accent-ring); outline-offset: 2px`.
Disabled: `opacity: 0.5; pointer-events: none`.

#### Card

Primary container for grouped content.

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-4);
  box-shadow: var(--shadow-xs);
}
.card:hover { box-shadow: var(--shadow-sm); } /* only for clickable cards */
```

Variants:
- `.card--flush`: `padding: 0` (for cards containing tables or lists with their own padding)
- `.card--compact`: `padding: var(--space-3)` (for dense grids)
- `.card--highlighted`: `border-left: 3px solid var(--accent)` (for selected/active items)

#### Modal / Dialog

Centered overlay using `<dialog>` element for native a11y.

```css
.modal-overlay { background: var(--color-overlay); }
.modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 560px;
  width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  overflow-y: auto;
}
```

- Header: title (`--fs-lg`, `--fw-semibold`) + close button (ghost, 36×36)
- Footer: right-aligned buttons with `gap: var(--space-2)`
- Animation: scale from 0.95 → 1.0, opacity 0 → 1, `--duration-slow`, `--ease-spring`
- Focus trap: first focusable element receives focus on open, Escape closes
- Body scroll lock: `overflow: hidden` on `<body>` while open

#### Toast / Notification

Bottom-right stack. Auto-dismiss after 5 seconds.

```css
.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  min-width: 300px;
  max-width: 420px;
}
```

Variants: `success` (green left border), `error` (red), `warning` (amber), `info` (blue).
Enter: slide up + fade in, `--duration-base`, `--ease-spring`.
Exit: slide right + fade out, `--duration-fast`.

#### Table

Data-dense table for roster, skills matrix, action items.

```css
.table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  font-weight: var(--fw-medium);
  color: var(--color-text-muted);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border-strong);
  position: sticky;
  top: 0;
  background: var(--color-surface);
}
.table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}
.table tr:hover td { background: var(--accent-subtle); }
```

- Sortable columns: header with sort icon, `cursor: pointer`
- Selectable rows: checkbox in first column, selected row gets `--accent-subtle` bg
- Striped variant (optional): even rows get `--color-surface-alt`

#### Form Controls

**Text Input / Textarea:**
```css
.input {
  height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--fs-sm);
  background: var(--color-surface);
  color: var(--color-text);
  transition: border-color var(--duration-base) var(--ease-out),
              box-shadow var(--duration-base) var(--ease-out);
}
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
  outline: none;
}
.input--error { border-color: var(--color-negative); }
```

**Select:** Same styling as input, with custom chevron icon.
**Checkbox / Toggle:** 18×18 checkbox or 40×20 toggle switch, accent colored when checked.
**Labels:** `font-size: var(--fs-sm)`, `font-weight: var(--fw-medium)`, `margin-bottom: var(--space-1)`.

#### Empty State

Centered in the parent container.

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-10) var(--space-6);
  text-align: center;
  color: var(--color-text-muted);
}
.empty-state__icon { font-size: 48px; opacity: 0.4; }
.empty-state__title { font-size: var(--fs-lg); font-weight: var(--fw-semibold); color: var(--color-text-secondary); }
.empty-state__description { font-size: var(--fs-sm); max-width: 360px; }
.empty-state__action { margin-top: var(--space-2); } /* contains a primary button */
```

---

### 1.7 Layout System

#### App Shell

```
┌──────────────────────────────────────────────┐
│  Sidebar (240px)  │  Main Content Area       │
│  ┌─────────────┐  │  ┌───────────────────┐   │
│  │ App Logo     │  │  │ Page Header       │   │
│  │ Nav Items    │  │  │ Page Content      │   │
│  │              │  │  │                   │   │
│  │ Settings     │  │  │                   │   │
│  └─────────────┘  │  └───────────────────┘   │
└──────────────────────────────────────────────┘
```

```css
.app-layout {
  display: flex;
  min-height: 100vh;
}
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: var(--space-4) 0;
  display: flex;
  flex-direction: column;
}
.main-content {
  flex: 1;
  min-width: 0;
  padding: var(--space-6);
  max-width: var(--max-width);
}
```

#### Responsive Breakpoints

| Breakpoint | Width | Behavior |
|---|---|---|
| `mobile` | `< 640px` | Sidebar hidden (hamburger toggle), single column, full-width cards |
| `tablet` | `640–1023px` | Sidebar collapsed (icons only, 64px), 2-column grids |
| `desktop` | `≥ 1024px` | Full sidebar (240px), multi-column layouts |

Mobile sidebar: slides in from left as overlay with `--color-overlay` backdrop.

#### Page Header Pattern

```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
  gap: var(--space-3);
}
.page-header__title { font-size: var(--fs-2xl); font-weight: var(--fw-bold); }
.page-header__actions { display: flex; gap: var(--space-2); }
```

---

### 1.8 Status System

Team member status drives badge color, avatar ring, and filter chip styling.

| Status | Token prefix | Dot color | Usage context |
|---|---|---|---|
| `active` | `--status-active` | Green dot | Default state, fully present |
| `on_leave` | `--status-on-leave` | Amber dot | PTO, parental leave, sabbatical |
| `departing` | `--status-departing` | Red dot | Notice period, transfer out |
| `new_hire` | `--status-new-hire` | Blue dot | First 90 days |

Status dot: `8px` circle, absolutely positioned at bottom-right of avatar.
Pulse animation on `new_hire` dot: subtle scale 1→1.3 loop over 2s (respects reduced motion).

---

### 1.9 Data Density Guidelines

Crewbook is a manager's daily tool. Optimize for information density over whitespace.

- **Tables**: Default to compact (`--space-2` padding) with an option for comfortable (`--space-3`)
- **Cards in grids**: `gap: var(--space-4)` in standard view, `gap: var(--space-3)` in compact
- **Lists**: 44px minimum row height (touch target compliance) with tight padding
- **Metrics/numbers**: Monospace (`font-feature-settings: 'tnum'`), right-aligned in columns
- **Truncation**: Long text uses `text-overflow: ellipsis` with title attribute for full text
- **Dense mode toggle** (settings): Reduces base font to `--fs-xs`, tightens padding by 25%

---

### 1.10 Privacy Indicators

Crewbook holds sensitive people data. Privacy must be visually communicated.

- **Lock icon** (🔒): Shown next to app title in sidebar and on encryption setup screen
- **Private fields**: `color: var(--color-text-muted)` with `font-style: italic` and lock icon inline
- **Shareable view strip**: When generating a share link, private fields are visually struck through in preview before export
- **Encryption badge**: Small shield icon in footer: "End-to-end encrypted · Browser only"
- **Data never leaves device**: Reinforce in onboarding, settings, and empty states

---

### 1.11 Icons

Use inline SVG icons for tree-shaking. Recommended set: [Lucide Icons](https://lucide.dev/) (MIT licensed, consistent 24×24 grid, 1.5px stroke).

Standard sizes: `16px` (inline with text), `20px` (buttons, nav), `24px` (page headers), `32px` (empty states).

Key icons needed:
- Navigation: `Users`, `Calendar`, `ClipboardList`, `MessageSquare`, `TrendingUp`, `Shield`, `Settings`, `Search`
- Actions: `Plus`, `Edit`, `Trash2`, `Download`, `Upload`, `Share2`, `Filter`, `SortAsc`/`SortDesc`
- Status: `CheckCircle`, `AlertTriangle`, `XCircle`, `Clock`, `Star`
- Privacy: `Lock`, `ShieldCheck`, `Eye`, `EyeOff`

---

### 1.12 Accessibility Foundations

- **Focus visible**: `outline: 2px solid var(--accent-ring); outline-offset: 2px` on all interactive elements. Never use `outline: none` without a visible replacement.
- **Color is not the only indicator**: Status badges include text labels, not just color. Chart data uses patterns in addition to color.
- **Touch targets**: Minimum 44×44px for all interactive elements (WCAG 2.5.5).
- **Landmarks**: `<nav>` for sidebar, `<main>` for content, `<header>` for page header, `<footer>` for app footer.
- **Heading hierarchy**: One `<h1>` per page (page title), `<h2>` for sections, `<h3>` for subsections. Never skip levels.
- **Live regions**: `aria-live="polite"` for toast notifications, search result counts, filter updates.
- **Skip link**: "Skip to main content" as first focusable element.
- **Keyboard shortcuts**: All features accessible without shortcuts. Shortcuts are accelerators, not requirements.
- **Screen reader text**: Use `.sr-only` class for icon-only buttons.

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---
---

## Part 2 — Per-Issue Design Specs

Each spec below maps to a GitHub issue. Specs reference tokens and components from Part 1.

---

### Issue #2 — Define Core Data Models & TypeScript Types

**Goal**: Establish all TypeScript interfaces and types that every downstream feature depends on.

**Design impact**: Types drive the shape of every UI component. No visual spec, but type names appear in code comments and prop types throughout the system.

**Key types to define** (referenced by later specs):

```typescript
type MemberStatus = 'active' | 'on_leave' | 'departing' | 'new_hire';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  team: string;
  status: MemberStatus;
  startDate: string;        // ISO date
  email?: string;
  location?: string;
  manager?: string;
  avatarUrl?: string;
  notes?: string;           // private
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface OneOnOneNote {
  id: string;
  memberId: string;
  date: string;
  mood?: 'great' | 'good' | 'neutral' | 'struggling';
  topics: string[];
  notes: string;            // markdown
  private: boolean;
  actionItems?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ActionItem {
  id: string;
  memberId: string;
  noteId?: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackEntry {
  id: string;
  memberId: string;
  type: 'praise' | 'constructive' | 'peer' | 'upward';
  source?: string;
  content: string;
  date: string;
  private: boolean;
  tags?: string[];
  createdAt: string;
}

interface GrowthGoal {
  id: string;
  memberId: string;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'paused';
  targetDate?: string;
  milestones?: { title: string; completed: boolean }[];
  createdAt: string;
  updatedAt: string;
}

interface PTOEntry {
  id: string;
  memberId: string;
  type: 'vacation' | 'sick' | 'personal' | 'holiday' | 'other';
  startDate: string;
  endDate: string;
  notes?: string;
}

interface SkillRating {
  memberId: string;
  skill: string;
  level: 1 | 2 | 3 | 4 | 5;
  updatedAt: string;
}
```

**Components consumed by**: Every issue from #4 onward.

**Dark mode**: N/A (types only).

**Responsive**: N/A.

---

### Issue #3 — Encrypted localStorage Layer

**Goal**: Implement AES-GCM encryption for all persisted data, gating the app behind a passphrase.

**Visual spec — Passphrase screen** (the "gate"):

```
┌──────────────────────────────────────┐
│          🔒 Crewbook                 │
│                                      │
│   Your data stays on this device,    │
│   encrypted with your passphrase.    │
│                                      │
│   ┌──────────────────────────────┐   │
│   │ Enter passphrase...          │   │
│   └──────────────────────────────┘   │
│                                      │
│        [ Unlock Crewbook ]           │
│                                      │
│   ┌──────────────────────────────┐   │
│   │ 🛡 AES-256 encryption        │   │
│   │ 🌐 Never leaves your browser │   │
│   │ 🔑 No account needed        │   │
│   └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

- **Layout**: Centered vertically and horizontally, max-width `400px`
- **Lock icon**: 48px, `color: var(--accent)`, `margin-bottom: var(--space-4)`
- **Title**: `--fs-2xl`, `--fw-bold`
- **Subtitle**: `--fs-sm`, `--color-text-muted`, max-width `320px`, `text-align: center`
- **Input**: Full width, `height: 44px`, type `password`, `--fs-md`, centered
- **Button**: Full width, primary variant, `height: 44px`
- **Trust badges**: 3 items in a bordered card, `--fs-xs`, `--color-text-muted`, icon + text rows, `gap: var(--space-2)`
- **Error state**: Input border turns `--color-negative`, shake animation (3px horizontal, 300ms), error message below in `--color-negative`, `--fs-xs`
- **First-time**: Show "Create passphrase" with confirm field; returning users see "Enter passphrase"
- **Dark mode**: `--color-bg` background, card uses `--color-surface`, input uses `--color-surface`
- **Responsive**: Stays centered, padding adjusts. Below 640px, card takes `width: calc(100vw - 32px)`

---

### Issue #4 — Team Member CRUD Operations

**Goal**: Create, read, update, delete team members with form validation.

**Create / Edit Form (Modal)**:

```
┌─────────────────────────────────────────┐
│ ✕  Add Team Member                      │
├─────────────────────────────────────────┤
│  Name *            [________________]   │
│  Role *            [________________]   │
│  Team              [________________]   │
│  Status            [▾ Active       ]    │
│  Start Date        [📅 Pick date   ]    │
│  Email             [________________]   │
│  Location          [________________]   │
│  Tags              [________________]   │
│                                         │
│  Notes (private 🔒)                     │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│              [ Cancel ] [ Save ]        │
└─────────────────────────────────────────┘
```

- **Modal**: Standard modal component, max-width `560px`
- **Form layout**: Single column, `gap: var(--space-5)` between groups
- **Labels**: `--fs-sm`, `--fw-medium`, required fields marked with red asterisk
- **Inputs**: Full width, `height: 36px`, standard input styling
- **Status select**: Dropdown with colored dots matching `--status-*` tokens
- **Notes textarea**: `min-height: 80px`, resize vertical, `🔒` icon after label in `--color-text-muted`
- **Tags input**: Comma-separated, rendered as pill badges below input
- **Validation**: Inline errors below each field, `--color-negative`, `--fs-xs`, with `aria-describedby`
- **Delete**: Accessible from edit mode only. Opens confirm dialog: "Delete [Name]? This cannot be undone." with danger button.
- **Dark mode**: Modal surface `--color-surface`, inputs `--color-surface-alt` background
- **Responsive**: Modal becomes full-screen sheet on mobile (slides up from bottom, `border-radius` only on top)

---

### Issue #5 — Team Roster: List View

**Goal**: Display all team members in a sortable, filterable table.

**Layout**:

```
┌──────────────────────────────────────────────────────┐
│  Team Roster                        [+ Add] [⊞ Grid]│
├──────────────────────────────────────────────────────┤
│  🔍 Search...    [Status ▾] [Team ▾] [Sort ▾]       │
├──────────────────────────────────────────────────────┤
│  NAME ▲          ROLE          TEAM     STATUS  ...  │
│  ──────────────────────────────────────────────────  │
│  🟢 Ada Lovelace  Sr. Engineer  Platform  Active     │
│  🔵 Bob Chen      New Grad      Mobile    New Hire   │
│  🟡 Carol Diaz    Staff Eng     Platform  On Leave   │
│  🔴 Dan Evans     Sr. Engineer  Backend   Departing  │
│  ...                                                 │
├──────────────────────────────────────────────────────┤
│  Showing 4 of 12 members                            │
└──────────────────────────────────────────────────────┘
```

- **Page header**: Title (`--fs-2xl`, `--fw-bold`) + action buttons right-aligned
- **View toggle**: Icon buttons (list/grid), `ghost` variant, active state uses `--accent-subtle` bg
- **Search bar**: `width: 280px`, icon inside left, `--fs-sm`
- **Filters**: Dropdown selects styled as pills/chips with count badges
- **Table**: Standard table component. Columns: Avatar+Name (linked), Role, Team, Status (badge), Start Date, Actions (⋯ menu)
- **Sortable headers**: Click to sort, arrow indicator, `cursor: pointer`
- **Row hover**: `--accent-subtle` background
- **Row click**: Navigate to member detail page
- **Status column**: Badge component with status variant
- **Actions menu**: Popover with Edit, View, Delete options
- **Footer**: Result count in `--color-text-muted`, `--fs-xs`
- **Empty state**: Standard empty-state component — "No team members yet. Add your first team member to get started."
- **Dark mode**: Table alternating rows use `--color-surface` / `--color-surface-alt`
- **Responsive**: Below 768px, hide Team and Start Date columns. Below 640px, switch to card list layout (stacked cards instead of table rows).

---

### Issue #6 — Team Roster: Grid/Card View

**Goal**: Alternative card-based view of the team roster.

**Layout (desktop, 3-column grid)**:

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│    (AV)    │  │    (AV)    │  │    (AV)    │
│  Ada L.    │  │  Bob C.    │  │  Carol D.  │
│  Sr. Eng   │  │  New Grad  │  │  Staff Eng │
│  Platform  │  │  Mobile    │  │  Platform  │
│ ● Active   │  │ ● New Hire │  │ ● On Leave │
└────────────┘  └────────────┘  └────────────┘
```

- **Grid**: `display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-4)`
- **Card**: Standard card component (`--compact` variant), `text-align: center`, `padding: var(--space-6) var(--space-4)`
- **Avatar**: `lg` size (56×56), centered, `margin-bottom: var(--space-3)`
- **Name**: `--fs-md`, `--fw-semibold`, truncate with ellipsis
- **Role**: `--fs-sm`, `--color-text-secondary`
- **Team**: `--fs-xs`, `--color-text-muted`
- **Status badge**: Centered below team, standard badge component
- **Card hover**: Lift effect — `transform: translateY(-2px)`, `--shadow-md`, `--duration-base`
- **Card click**: Navigate to member detail
- **Selection**: Checkbox in top-right corner (visible on hover or when bulk mode is active)
- **Dark mode**: Cards use `--color-surface`, hover shadow includes accent glow
- **Responsive**: 3 cols on desktop, 2 on tablet, 1 on mobile. Cards stretch to full width on mobile.

---

### Issue #7 — Member Detail Page

**Goal**: Comprehensive detail page for a single team member with tabbed sections.

**Layout**:

```
┌──────────────────────────────────────────────────────┐
│  ← Back to Roster                                    │
├──────────────────────────────────────────────────────┤
│  ┌──────┐                                            │
│  │ (AV) │  Ada Lovelace              [Edit] [⋯]     │
│  │  xl  │  Sr. Engineer · Platform                   │
│  └──────┘  ● Active  · Started Jan 2023              │
│            ada@company.com · San Francisco            │
├──────────────────────────────────────────────────────┤
│  [1:1 Notes] [Action Items] [Feedback] [Growth] ... │
├──────────────────────────────────────────────────────┤
│                                                      │
│  (Tab content area — see individual issue specs)     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **Back link**: Ghost button with `←` icon, `--fs-sm`, `--color-text-muted`
- **Header section**: Flex row, avatar `xl` (80×80) on left, info stacked on right
  - Name: `--fs-2xl`, `--fw-bold`
  - Role + Team: `--fs-md`, `--color-text-secondary`, separated by `·`
  - Status badge + tenure: `--fs-sm`, `--color-text-muted`
  - Contact + location: `--fs-sm`, `--color-text-muted`, icon-prefixed
  - Actions: right-aligned, `Edit` (secondary button) + `⋯` (ghost, opens delete/share/export menu)
- **Tab bar**: Horizontal tabs, bottom border style
  ```css
  .tab { padding: var(--space-2) var(--space-4); font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--color-text-muted); border-bottom: 2px solid transparent; }
  .tab--active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab:hover { color: var(--color-text); }
  ```
- **Tab content**: Below tab bar, `padding-top: var(--space-6)`
- **Dark mode**: Standard token usage, no special overrides
- **Responsive**: Below 640px, avatar shrinks to `lg` (56px), tabs become horizontally scrollable (hide scrollbar). Below 480px, header stacks vertically (avatar above name).

---

### Issue #8 — 1:1 Meeting Notes

**Goal**: Log and browse 1:1 meeting notes for each team member.

**Layout (within Member Detail "1:1 Notes" tab)**:

```
┌──────────────────────────────────────────────────────┐
│  1:1 Notes                             [+ New Note]  │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐  │
│  │ Mar 15, 2024                    😊 Great  🔒  │  │
│  │ Topics: Career Growth, Project Alpha           │  │
│  │                                                │  │
│  │ Discussed promotion timeline. Ada is on track  │  │
│  │ for the next cycle. Key areas to focus on:     │  │
│  │ system design and cross-team influence...      │  │
│  │                                  [Read more]   │  │
│  │                                                │  │
│  │ Action Items: 2 open                           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ Mar 1, 2024                     😐 Neutral     │  │
│  │ Topics: Sprint Retro, PTO Planning             │  │
│  │ ...                                            │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Note card**: Standard card, `padding: var(--space-4)`
  - **Header row**: Date (`--fs-sm`, `--fw-semibold`) left, mood emoji + privacy lock right
  - **Topics**: Pills/tags below date, `--fs-xs`, `--color-text-muted` bg, `--radius-sm`
  - **Content**: `--fs-sm`, `--lh-relaxed`, truncated to 3 lines with "Read more" link
  - **Action items summary**: `--fs-xs`, `--color-text-muted`, linked count
  - **Card spacing**: `gap: var(--space-3)` between note cards
- **Mood indicators**: Emoji + text label — 😊 Great (green), 🙂 Good (teal), 😐 Neutral (gray), 😟 Struggling (amber)
- **New Note modal**: Standard modal with fields: Date (default today), Mood (select), Topics (tag input), Notes (rich textarea with markdown preview), Private toggle
  - Notes field: `min-height: 200px`, monospace font option for markdown
- **Privacy**: 🔒 icon on private notes, slightly muted card border (`opacity: 0.7` on border)
- **Dark mode**: Note cards use `--color-surface`, mood colors remain vibrant
- **Responsive**: Cards full-width, stack vertically. Modal becomes bottom sheet on mobile.

---

### Issue #9 — Action Items Tracker

**Goal**: Track action items across all team members with status, priority, and due dates.

**Layout (standalone page + member detail tab)**:

**Standalone page — all action items:**
```
┌──────────────────────────────────────────────────────┐
│  Action Items                          [+ New Item]  │
├──────────────────────────────────────────────────────┤
│  🔍 Search...  [Status ▾] [Priority ▾] [Person ▾]   │
├──────────────────────────────────────────────────────┤
│  ☐  Fix deploy pipeline        Ada L.  🔴 High  3/20│
│  ☑  Update team wiki           Bob C.  🟡 Med   3/18│
│  ☐  Prepare perf review        Carol   🔴 High  3/25│
│  ☐  Shadow on-call rotation    Dan E.  🟢 Low   4/01│
├──────────────────────────────────────────────────────┤
│  4 items · 1 done · 1 overdue                        │
└──────────────────────────────────────────────────────┘
```

**Member detail tab — filtered to that member:**
Same table but without the "Person" column, and no person filter.

- **Table**: Standard table component
  - **Checkbox column**: 18×18 checkbox, toggles done/open
  - **Title**: `--fs-sm`, `--fw-medium`. Done items: `text-decoration: line-through`, `--color-text-muted`
  - **Person**: Avatar `xs` + name, `--fs-xs`
  - **Priority**: Colored dot (🔴 high = `--color-negative`, 🟡 medium = `--color-warning`, 🟢 low = `--status-active`)
  - **Due date**: `--fs-xs`, `font-feature-settings: 'tnum'`. Overdue: `--color-negative`, `--fw-semibold`
- **Overdue indicator**: Row gets subtle `--color-negative` left border (3px)
- **Inline edit**: Click title to edit inline, Enter to save, Escape to cancel
- **New Item modal**: Title*, Description (optional), Assign to (member select), Priority (select), Due date (date picker), Link to 1:1 note (optional select)
- **Filters**: Status (open/done/all), Priority (high/med/low), Person (avatar + name list)
- **Bulk actions**: Select multiple → Mark done, Change priority, Delete
- **Dark mode**: Standard tokens, overdue red remains vivid
- **Responsive**: Below 640px, due date moves below title in same cell. Priority becomes icon-only.

---

### Issue #10 — Feedback Log

**Goal**: Record praise, constructive feedback, peer feedback, and upward feedback for each member.

**Layout (within Member Detail "Feedback" tab)**:

```
┌──────────────────────────────────────────────────────┐
│  Feedback                              [+ Add]       │
│  [All] [Praise] [Constructive] [Peer] [Upward]      │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐  │
│  │ 🌟 Praise                         Mar 15 🔒   │  │
│  │ Source: Quarterly Review                       │  │
│  │                                                │  │
│  │ "Ada consistently mentors junior engineers     │  │
│  │  and drives technical excellence across..."    │  │
│  │                                                │  │
│  │ #leadership  #mentoring                        │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 💬 Constructive                    Feb 28      │  │
│  │ Source: 1:1 Discussion                         │  │
│  │                                                │  │
│  │ "Could improve on communicating blockers       │  │
│  │  earlier in the sprint cycle..."               │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Filter tabs**: Horizontal pill buttons, `--fs-xs`, active tab uses `--accent` text + `--accent-subtle` bg
- **Feedback card**: Standard card
  - **Type badge**: Icon + label — 🌟 Praise (green), 💬 Constructive (amber), 👥 Peer (blue), ⬆️ Upward (purple)
  - **Date**: Right-aligned, `--fs-xs`, `--color-text-muted`
  - **Source**: `--fs-xs`, `--color-text-muted`, italic
  - **Content**: `--fs-sm`, `--lh-relaxed`, rendered in a subtle quote style (`border-left: 3px solid var(--color-border)`, `padding-left: var(--space-3)`)
  - **Tags**: Bottom row, pill badges, `--fs-xs`, clickable for filtering
  - **Privacy**: 🔒 icon, same treatment as 1:1 notes
- **Add Feedback modal**: Type (select with icons), Source (text), Content (textarea, min-height 120px), Tags (tag input), Private toggle
- **Dark mode**: Type colors remain vibrant. Quote border uses `--color-border-strong`.
- **Responsive**: Cards full-width. Filter tabs scroll horizontally on mobile.

---

### Issue #11 — Growth & Career Tracking

**Goal**: Track career goals, milestones, and development plans per member.

**Layout (within Member Detail "Growth" tab)**:

```
┌──────────────────────────────────────────────────────┐
│  Growth & Goals                          [+ New Goal]│
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐  │
│  │  📈 Improve System Design Skills               │  │
│  │  Status: In Progress        Target: Jun 2024   │  │
│  │  ┌──────────────────────────────────────┐      │  │
│  │  │ ████████████░░░░░░░░ 60%             │      │  │
│  │  └──────────────────────────────────────┘      │  │
│  │                                                │  │
│  │  Milestones:                                   │  │
│  │  ✅ Complete system design course               │  │
│  │  ✅ Lead design review for Project Alpha        │  │
│  │  ☐  Present architecture proposal              │  │
│  │  ☐  Mentor junior on design patterns           │  │
│  │                                    [Edit]      │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Goal card**: Standard card, `padding: var(--space-4)`
  - **Title**: `--fs-md`, `--fw-semibold`, icon prefix
  - **Meta row**: Status badge (uses action item status palette) + target date, `--fs-xs`
  - **Progress bar**: `height: 8px`, `border-radius: var(--radius-pill)`, track `--color-surface-alt`, fill `--accent`. Width = `(completed milestones / total) * 100%`
  - **Milestones**: Checklist style, `--fs-sm`, completed items get `--color-text-muted` + strikethrough
  - **Edit button**: Ghost, right-aligned at card bottom
- **Goal statuses**: `not_started` (gray badge), `in_progress` (blue), `completed` (green), `paused` (amber)
- **Add/Edit Goal modal**: Title*, Description (textarea), Target date, Milestones (dynamic list — add/remove/reorder)
  - Milestone input: text + checkbox + delete button, `gap: var(--space-2)`
  - Add milestone: ghost button with `+` icon
- **Completed goals**: Collapsed by default, expandable section at bottom, `--color-text-muted`
- **Dark mode**: Progress bar fill uses `--accent` (brighter in dark). Track uses `--color-surface-alt`.
- **Responsive**: Full-width cards. Modal becomes bottom sheet on mobile.

---

### Issue #12 — PTO & Availability Calendar

**Goal**: Calendar view showing team PTO, holidays, and availability at a glance.

**Layout**:

```
┌──────────────────────────────────────────────────────┐
│  Availability                    [+ Add PTO] ◀ Mar ▶│
├──────────────────────────────────────────────────────┤
│  Mon    Tue    Wed    Thu    Fri                      │
│  ┌──────┬──────┬──────┬──────┬──────┐                │
│  │      │      │      │      │  1   │                │
│  │      │      │      │      │      │                │
│  ├──────┼──────┼──────┼──────┼──────┤                │
│  │  4   │  5   │  6   │  7   │  8   │                │
│  │ Ada🏖│ Ada🏖│      │      │      │                │
│  │      │ Bob🤒│ Bob🤒│      │      │                │
│  ├──────┼──────┼──────┼──────┼──────┤                │
│  │ ...                                               │
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  Legend: 🏖 Vacation  🤒 Sick  📋 Personal  🎉 Holiday│
└──────────────────────────────────────────────────────┘
```

- **Calendar grid**: CSS grid, 5 columns (Mon–Fri), dynamic rows per month
- **Day cell**: `min-height: 80px`, `padding: var(--space-1)`, border `--color-border`
  - Day number: `--fs-xs`, `--fw-medium`, top-left
  - Today: Day number gets `--accent` bg circle (pill)
  - PTO entries: Colored bars spanning days
    - Vacation: `--status-on-leave` (amber)
    - Sick: `--color-negative` (red, muted)
    - Personal: `--color-info` (blue)
    - Holiday: `--status-active` (green)
  - Multi-day: Bar spans across cells with `grid-column: span N`
- **Month navigation**: Centered month/year (`--fs-lg`, `--fw-semibold`), arrow buttons left/right
- **Add PTO modal**: Member (select), Type (select with emoji icons), Start/End dates (date pickers), Notes (optional text)
- **Team summary sidebar** (desktop only, right side): List of who's out today/this week with avatar + name + type
- **Dark mode**: Calendar cells use `--color-surface`, PTO bars slightly more opaque. Today circle uses `--accent`.
- **Responsive**: Below 768px, switch to list view grouped by week. Each day shows avatar stack + PTO type. Below 480px, show daily agenda view.

---

### Issue #13 — Flight Risk Indicators

**Goal**: Visual system for tracking and displaying flight risk levels.

**Layout (integrated into roster + member detail)**:

**Roster table — additional column:**
```
NAME            ROLE          STATUS    RISK
Ada Lovelace    Sr. Engineer  Active    🟢 Low
Bob Chen        New Grad      Active    🟡 Medium
Carol Diaz      Staff Eng     Active    🔴 High
```

**Member detail — risk panel (sidebar or below header):**
```
┌────────────────────────────────────┐
│  Flight Risk Assessment     [Edit] │
│                                    │
│  Risk Level: 🔴 High               │
│                                    │
│  Signals:                          │
│  • Declined last 2 stretch opps    │
│  • Compensation below band         │
│  • Reduced engagement in meetings  │
│                                    │
│  Last assessed: Mar 10, 2024       │
│  ⚠️  This section is private       │
└────────────────────────────────────┘
```

- **Risk levels**: `low` (green dot), `medium` (amber dot), `high` (red dot), `not_assessed` (gray dot)
- **Risk badge**: Same pattern as status badge but uses severity colors
- **Risk panel**: Card with `--highlighted` variant (left border color matches risk level)
  - Title + edit button in header row
  - Risk level: Badge component
  - Signals: Bulleted list, `--fs-sm`, `--lh-normal`
  - Last assessed: `--fs-xs`, `--color-text-muted`
  - Privacy warning: `--fs-xs`, `--color-warning`, with ⚠️ icon
- **Privacy**: Flight risk is always private. Card has subtle lock icon in corner. In shareable views, this section is completely hidden.
- **Edit modal**: Risk level (select), Signals (dynamic text list — add/remove), Notes (textarea)
- **Dark mode**: Risk colors remain vivid. Panel background `--color-surface`.
- **Responsive**: Panel full-width on mobile, appears as collapsible section.

---

### Issue #14 — Skills Matrix

**Goal**: Grid view of team skills with proficiency ratings for gap analysis.

**Layout**:

```
┌──────────────────────────────────────────────────────────┐
│  Skills Matrix                    [+ Add Skill] [Export] │
├──────────────────────────────────────────────────────────┤
│              React  TypeScript  Go  System  Leadership   │
│  Ada L.      ●●●●○  ●●●●●     ●●○  ●●●○○   ●●●●○       │
│  Bob C.      ●●●○○  ●●●○○     ○○○  ●○○○○   ●○○○○       │
│  Carol D.    ●●●●●  ●●●●○     ●●●  ●●●●●   ●●●●●       │
│  Dan E.      ●●○○○  ●●●○○     ●●●  ●●●○○   ●●○○○       │
├──────────────────────────────────────────────────────────┤
│  Team avg:   3.5    3.75       2.0   3.0     2.75        │
│  Gap:                          ⚠️    ⚠️                  │
└──────────────────────────────────────────────────────────┘
```

- **Table**: Specialized table variant, sticky first column + header
  - **Name column**: Avatar `xs` + name, `width: 160px`, sticky left
  - **Skill columns**: Centered, `width: 100px` each
  - **Rating display**: 5 dots — filled dots use `--accent`, unfilled use `--color-border`
    - 1: Novice, 2: Beginner, 3: Intermediate, 4: Advanced, 5: Expert
  - **Click to edit**: Clicking a cell opens inline rating selector (5 clickable dots)
  - **Team average row**: `--fw-semibold`, `--color-text-secondary`, `font-feature-settings: 'tnum'`
  - **Gap indicator**: ⚠️ icon when team average < 2.5 for a skill, `--color-warning`
- **Add Skill modal**: Skill name (text), optional category (text)
- **Horizontal scroll**: Container scrolls horizontally when skills overflow, with sticky name column
- **Sort**: Click skill header to sort team by that skill (highest first)
- **Dark mode**: Filled dots use brighter `--accent`. Unfilled dots use `--color-surface-alt`.
- **Responsive**: Below 768px, switch to card view per person showing their skills as a vertical list. Or allow horizontal scroll with sticky name column.

---

### Issue #15 — Peer Connections & Org Chart

**Goal**: Visualize team relationships, reporting lines, and peer connections.

**Layout — Org Chart view:**

```
┌──────────────────────────────────────────────────────┐
│  Team Structure                    [Tree] [List]     │
├──────────────────────────────────────────────────────┤
│                    ┌──────────┐                      │
│                    │ You (EM) │                      │
│                    └────┬─────┘                      │
│            ┌────────────┼────────────┐               │
│       ┌────┴────┐  ┌────┴────┐  ┌───┴─────┐         │
│       │ Ada L.  │  │ Bob C.  │  │ Carol D. │         │
│       │ Sr. Eng │  │ New Grad│  │ Staff Eng│         │
│       └─────────┘  └─────────┘  └──────────┘        │
└──────────────────────────────────────────────────────┘
```

- **Tree view**: CSS-based tree with connector lines
  - Node: Card-like box, `padding: var(--space-2) var(--space-3)`, `--radius`, `--shadow-xs`
  - Node content: Avatar `sm` + name + role, stacked
  - Connector lines: `2px solid var(--color-border)`, using `::before`/`::after` pseudo-elements
  - Your node (the EM): `--accent` border, slightly larger
- **List view**: Flat list with indentation showing hierarchy
  - Each row: Avatar `sm` + name + role + status badge
  - Indent: `padding-left: var(--space-6)` per level
- **Peer connections**: Optional dotted lines between peers who collaborate frequently
  - Connection data: Stored as `peerIds: string[]` on TeamMember
  - Visual: Dashed `1px var(--color-border)` connecting lines
- **View toggle**: Same pattern as list/grid toggle on roster page
- **Dark mode**: Connector lines use `--color-border`. Nodes use `--color-surface`.
- **Responsive**: Below 768px, force list view only (tree becomes too cramped). Nodes become full-width cards.

---

### Issue #16 — Shareable 1:1 View

**Goal**: Generate a stripped-down, read-only view of 1:1 notes that can be shared (e.g., to the team member themselves).

**Layout — shareable view (separate route, minimal chrome):**

```
┌──────────────────────────────────────────────────────┐
│  Crewbook · 1:1 Notes                                │
│  Ada Lovelace · Sr. Engineer                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  March 15, 2024                                      │
│  Topics: Career Growth, Project Alpha                │
│                                                      │
│  Discussed promotion timeline...                     │
│                                                      │
│  Action Items:                                       │
│  ☐ Prepare design doc for Project Beta               │
│  ☑ Complete system design course                     │
│                                                      │
│  ─────────────────────────────────────               │
│                                                      │
│  March 1, 2024                                       │
│  Topics: Sprint Retro                                │
│  ...                                                 │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Generated by Crewbook · [date] · Private fields     │
│  excluded                                            │
└──────────────────────────────────────────────────────┘
```

- **No sidebar**: Full-width, single-column layout
- **No navigation**: Only a minimal header with app name
- **Max width**: `720px`, centered, `padding: var(--space-6)`
- **Header**: Member name (`--fs-xl`, `--fw-bold`) + role (`--fs-md`, `--color-text-secondary`)
- **Notes**: Chronological, separated by `<hr>` (`1px solid var(--color-border)`, `margin: var(--space-6) 0`)
- **Private content excluded**: Notes/fields marked private are completely omitted. Footer note: "Private fields excluded" in `--fs-xs`, `--color-text-muted`
- **No mood indicators**: Mood is private — excluded from shareable view
- **No edit controls**: No buttons, no hover states, purely read-only
- **Print-optimized**: `@media print` styles — no shadows, borders only, black text
- **Share mechanism**: Export as self-contained HTML blob or copy-to-clipboard as markdown
- **Dark mode**: Follows system preference (since this is a standalone view)
- **Responsive**: Already single-column, just adjust padding on mobile.

---

### Issue #17 — Data Import/Export

**Goal**: Import from and export to JSON/CSV for backup and portability.

**Layout — Settings sub-page or modal:**

```
┌──────────────────────────────────────────────────────┐
│  Data Management                                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Export                                              │
│  ┌────────────────────────────────────────────────┐  │
│  │  📥 Export All Data                             │  │
│  │  Download a complete backup of your Crewbook   │  │
│  │  data as an encrypted JSON file.               │  │
│  │                                                │  │
│  │  Format:  [JSON ▾]    [ Export ]               │  │
│  │                                                │  │
│  │  Last export: Mar 15, 2024                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Import                                              │
│  ┌────────────────────────────────────────────────┐  │
│  │  📤 Import Data                                │  │
│  │  Import from a Crewbook backup file.           │  │
│  │  ⚠️  This will merge with existing data.       │  │
│  │                                                │  │
│  │  ┌──────────────────────────────────────┐      │  │
│  │  │  Drop file here or click to browse   │      │  │
│  │  │         .json, .csv                  │      │  │
│  │  └──────────────────────────────────────┘      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Danger Zone                                         │
│  ┌────────────────────────────────────────────────┐  │
│  │  🗑 Clear All Data                              │  │
│  │  Permanently delete all Crewbook data.         │  │
│  │  This cannot be undone.                        │  │
│  │                              [ Delete All ]    │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Section cards**: Each section is a card with icon, title (`--fs-lg`, `--fw-semibold`), description (`--fs-sm`, `--color-text-muted`)
- **Export card**: Format select (JSON/CSV) + Export button (primary)
  - Last export timestamp: `--fs-xs`, `--color-text-muted`
  - JSON export: Encrypted by default (uses same passphrase)
  - CSV export: Plaintext warning — show amber alert before proceeding
- **Import card**: Drag-and-drop zone
  - Drop zone: Dashed border `2px dashed var(--color-border)`, `--radius`, `padding: var(--space-8)`, centered text
  - Hover/drag-over: Border color → `--accent`, bg → `--accent-subtle`
  - File selected: Show filename, size, validation status
  - Import button: Primary, only enabled after valid file selected
  - Merge warning: `--color-warning` text with ⚠️ icon
- **Danger zone card**: `border-color: var(--color-negative)`, red-tinted
  - Delete button: Danger variant
  - Confirmation: Two-step — first click shows "Type DELETE to confirm" input
- **Progress**: Show progress bar during import/export operations
- **Dark mode**: Standard token usage. Danger zone border stays red.
- **Responsive**: Cards stack vertically, full-width. Drop zone adjusts padding.

---

### Issue #18 — Search & Filtering System

**Goal**: Global search and contextual filtering across all data types.

**Layout — Global search (triggered by `⌘K` or search icon in sidebar):**

```
┌──────────────────────────────────────────────────────┐
│  🔍 Search Crewbook...                          ⌘K  │
├──────────────────────────────────────────────────────┤
│  People                                              │
│  ┌────────────────────────────────────────────────┐  │
│  │ (av) Ada Lovelace · Sr. Engineer · Active      │  │
│  │ (av) Bob Chen · New Grad · New Hire            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  1:1 Notes                                           │
│  ┌────────────────────────────────────────────────┐  │
│  │ 📝 "promotion timeline" — Ada, Mar 15          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Action Items                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │ ☐ Fix deploy pipeline — Ada, Due Mar 20        │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Command palette style**: Modal overlay, no backdrop blur, centered top-third of viewport
  - Input: Full width, `height: 48px`, `--fs-md`, no border (only bottom separator), auto-focus
  - `⌘K` badge: Right-aligned in input, `--fs-xs`, `--color-text-muted`, `--color-surface-alt` bg, `--radius-sm`
- **Results**: Grouped by type with section headers
  - Section header: `--fs-xs`, `--color-text-muted`, `text-transform: uppercase`, `letter-spacing: 0.05em`
  - Result row: `padding: var(--space-2) var(--space-3)`, `--fs-sm`
  - Highlighted match: `<mark>` tag, `background: var(--accent-subtle)`, `--fw-semibold`
  - Keyboard nav: Arrow keys move selection, Enter opens, Escape closes
  - Selected result: `--accent-subtle` background
- **Empty results**: "No results for '[query]'" in `--color-text-muted`
- **Debounce**: 150ms debounce on input
- **Contextual filters on list pages**: Reusable filter bar component
  ```css
  .filter-bar {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    align-items: center;
  }
  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    cursor: pointer;
  }
  .filter-chip--active {
    background: var(--accent-subtle);
    border-color: var(--accent);
    color: var(--accent);
  }
  ```
- **Dark mode**: Search modal uses `--color-surface-raised`. Match highlight uses brighter accent.
- **Responsive**: Search modal becomes full-screen on mobile (slide down from top).

---

### Issue #19 — Dark Mode

**Goal**: Full dark mode support toggled via UI, persisted in settings.

**Implementation strategy** (mirrors `finance-tracking`):

- Toggle: `body.dark` class (not media query)
- All colors via CSS custom properties (already defined in §1.1)
- Toggle location: Sidebar footer, sun/moon icon button
- Persist: Store preference in encrypted localStorage settings

**Toggle component:**
```css
.theme-toggle {
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}
.theme-toggle:hover { background: var(--color-surface-alt); }
```

- **Icon**: Sun icon in light mode, Moon icon in dark mode
- **Animation**: Icon crossfade with rotation, `--duration-base`
- **System preference respect**: On first visit (no stored preference), detect `prefers-color-scheme` and apply. After user explicitly toggles, stored preference takes precedence.

**Dark mode audit checklist** (for every component):
- [ ] All hardcoded colors replaced with CSS variables
- [ ] Shadows adjusted (higher opacity in dark mode)
- [ ] Borders visible (check contrast against dark surfaces)
- [ ] Form inputs readable (check placeholder contrast)
- [ ] Status colors remain distinguishable
- [ ] Focus rings visible against dark backgrounds
- [ ] Scrollbar styled for dark mode

---

### Issue #20 — Responsive Design & Mobile Support

**Goal**: Fully functional on mobile devices with touch-optimized UI.

**Breakpoint system** (defined in §1.7):

| Breakpoint | Width | Major changes |
|---|---|---|
| `mobile` | `< 640px` | Sidebar overlay, stacked layouts, bottom sheet modals |
| `tablet` | `640–1023px` | Collapsed sidebar (icons), 2-col grids |
| `desktop` | `≥ 1024px` | Full sidebar, multi-column |

**Mobile-specific patterns:**

- **Bottom navigation bar** (mobile only):
  ```css
  .mobile-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: 100;
    padding-bottom: env(safe-area-inset-bottom);
  }
  ```
  Items: Roster, Action Items, Calendar, Settings (icon + label, `--fs-2xs`)

- **Bottom sheet modals**: On mobile, modals slide up from bottom
  ```css
  @media (max-width: 639px) {
    .modal {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-height: 85vh;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      animation: slideUp var(--duration-slow) var(--ease-spring);
    }
  }
  ```

- **Touch targets**: All buttons, links, interactive elements ≥ 44×44px
- **Swipe gestures**: Optional swipe-to-dismiss on cards, swipe left for quick actions on list items
- **Pull-to-refresh**: Not needed (localStorage, no server)
- **Viewport**: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- **Safe areas**: `env(safe-area-inset-*)` for notched devices

**Tablet sidebar (collapsed):**
```css
@media (min-width: 640px) and (max-width: 1023px) {
  .sidebar {
    width: 64px;
    align-items: center;
  }
  .sidebar__label { display: none; }
  .sidebar__icon { font-size: 24px; }
}
```

---

### Issue #21 — Accessibility (WCAG 2.1 AA)

**Goal**: Meet WCAG 2.1 AA compliance across all features.

**This is not a single feature but a cross-cutting requirement. Every issue spec above includes accessibility notes. This issue tracks the holistic audit and remaining gaps.**

**Checklist:**

1. **Landmarks & Structure**
   - `<nav>` for sidebar navigation
   - `<main>` for primary content area
   - `<header>` for page headers
   - `<section>` with `aria-labelledby` for logical sections
   - Skip link as first focusable element: "Skip to main content"
   - Single `<h1>` per page, no skipped heading levels

2. **Keyboard Navigation**
   - All interactive elements focusable via Tab
   - Visible focus indicator: `2px solid var(--accent-ring)`, `outline-offset: 2px`
   - Escape closes modals, popovers, dropdowns
   - Enter/Space activates buttons and links
   - Arrow keys navigate within tab bars, select lists, skill ratings
   - Focus trapped inside open modals
   - Focus restored to trigger element when modal closes

3. **Screen Reader Support**
   - Icon-only buttons: `aria-label` or `.sr-only` text
   - Status badges: `role="status"`, `aria-label="Status: Active"`
   - Dynamic content: `aria-live="polite"` for toasts, search results count, filter updates
   - Form errors: `aria-describedby` linking to error message, `aria-invalid="true"`
   - Tables: `<caption>`, `<th scope="col|row">`, `aria-sort` on sortable headers
   - Tabs: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`
   - Modal: `role="dialog"`, `aria-labelledby`, `aria-modal="true"`

4. **Color & Contrast**
   - All text meets 4.5:1 contrast ratio (normal text) or 3:1 (large text)
   - Status is never conveyed by color alone (always includes text label or icon)
   - Focus indicators meet 3:1 contrast against adjacent colors
   - Light mode: verified against `--color-bg` and `--color-surface`
   - Dark mode: verified against dark equivalents

5. **Motion**
   - `@media (prefers-reduced-motion: reduce)` disables all animations
   - No auto-playing animations that can't be paused
   - Toast auto-dismiss still works (it's a timing concern, not motion)

6. **Touch & Pointer**
   - Minimum 44×44px touch targets
   - No hover-only functionality (all hover features have tap equivalents)
   - No drag-only interactions (drag-to-reorder has button alternatives)

---

### Issue #22 — Onboarding & Empty States

**Goal**: Guide first-time users and provide helpful empty states for every data type.

**First-run experience:**

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│         Welcome to Crewbook 👋                       │
│                                                      │
│   Your private people management notebook.           │
│   Everything stays in your browser, encrypted.       │
│                                                      │
│   Let's get started:                                 │
│                                                      │
│   1. ☐ Add your first team member                    │
│   2. ☐ Log a 1:1 note                               │
│   3. ☐ Set up a growth goal                         │
│                                                      │
│         [ Add First Team Member ]                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **Welcome card**: Centered in main content area, `max-width: 480px`, `text-align: center`
  - Icon: 👋 or waving hand, 48px
  - Title: `--fs-2xl`, `--fw-bold`
  - Subtitle: `--fs-md`, `--color-text-secondary`
  - Checklist: Left-aligned within card, `--fs-sm`, checkboxes auto-complete as user takes actions
  - CTA: Primary button, full-width within card
- **Dismissible**: "Skip tour" link below, `--fs-xs`, `--color-text-muted`
- **Progress persisted**: Store onboarding completion state in settings

**Per-section empty states** (using empty-state component from §1.6):

| Section | Icon | Title | Description | CTA |
|---|---|---|---|---|
| Roster | 👥 | No team members yet | Add people to start tracking your team | Add Team Member |
| 1:1 Notes | 📝 | No notes yet | Record your 1:1 conversations here | Add First Note |
| Action Items | ☐ | All clear! | No open action items. Nice work! | (none) |
| Feedback | 💬 | No feedback recorded | Start capturing feedback for this person | Add Feedback |
| Growth | 📈 | No goals set | Track career development and growth plans | Add Goal |
| Calendar | 📅 | No PTO entries | Track availability and time off | Add PTO |
| Skills | ⭐ | No skills tracked | Build your team's skill matrix | Add Skill |

- **Dark mode**: Same tokens, no special handling.
- **Responsive**: Empty states center and adjust padding on mobile.

---

### Issue #23 — Bulk Operations

**Goal**: Select multiple team members or items for batch actions.

**Selection UI:**

```
┌──────────────────────────────────────────────────────┐
│  ☑ 3 selected              [Mark Active] [Delete]   │
├──────────────────────────────────────────────────────┤
│  ☑  Ada Lovelace    Sr. Engineer   Active            │
│  ☐  Bob Chen        New Grad       New Hire          │
│  ☑  Carol Diaz      Staff Eng      On Leave          │
│  ☑  Dan Evans       Sr. Engineer   Departing         │
└──────────────────────────────────────────────────────┘
```

- **Selection mode**: Activated when first checkbox is checked, or via "Select" button in page header
- **Selection bar**: Sticky bar at top of list/table
  ```css
  .selection-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    background: var(--accent-subtle);
    border-bottom: 1px solid var(--accent);
    font-size: var(--fs-sm);
  }
  ```
  - Count: `--fw-semibold`, `--accent` color
  - Actions: Secondary/danger buttons for bulk operations
  - "Select all" / "Deselect all" links
- **Checkbox**: Appears in first column of table, or top-left of card in grid view
  - In grid: visible on hover or when selection mode is active
  - `Shift+click`: Select range
- **Available bulk actions**:
  - Team members: Change status, Delete, Export selected
  - Action items: Mark done, Change priority, Delete
  - PTO entries: Delete selected
- **Confirmation**: Destructive bulk actions show confirm dialog with count: "Delete 3 team members? This cannot be undone."
- **Dark mode**: Selection bar uses `--accent-subtle` (works in both themes). Checked rows have subtle accent tint.
- **Responsive**: Selection bar becomes fixed bottom bar on mobile (above bottom nav). Actions collapse into "⋯" menu if space is tight.

---

### Issue #24 — Notification & Reminder System

**Goal**: In-app notifications for upcoming events, overdue items, and reminders.

**Notification bell (sidebar):**

```
┌──────────┐
│ 🔔 (3)   │
└──────────┘
```

**Notification panel (dropdown from bell):**

```
┌──────────────────────────────────────────┐
│  Notifications                  Mark all │
├──────────────────────────────────────────┤
│  🔴 Overdue: Fix deploy pipeline         │
│     Ada Lovelace · Due Mar 20            │
│                              2 hours ago │
├──────────────────────────────────────────┤
│  🟡 Upcoming: Bob's 90-day check-in      │
│     Bob Chen · Mar 25                    │
│                              1 day ago   │
├──────────────────────────────────────────┤
│  📅 PTO Tomorrow: Carol Diaz             │
│     Vacation · Mar 17–21                 │
│                              1 day ago   │
├──────────────────────────────────────────┤
│  No more notifications                   │
└──────────────────────────────────────────┘
```

- **Bell icon**: In sidebar, with badge count (red circle, `--color-negative`, white text, 16px diameter, positioned top-right of icon)
  - Badge: `min-width: 16px`, `height: 16px`, `font-size: 10px`, `--fw-bold`, centered text
  - Pulse animation when new notification arrives (respects reduced motion)
- **Panel**: Popover positioned right of bell (desktop) or bottom sheet (mobile)
  - `width: 380px`, `max-height: 400px`, `overflow-y: auto`
  - Header: "Notifications" + "Mark all read" link (`--fs-xs`, `--accent`)
- **Notification row**: `padding: var(--space-3)`, `border-bottom: 1px solid var(--color-border)`
  - Icon: Type-specific (🔴 overdue, 🟡 upcoming, 📅 PTO, ✅ completed)
  - Title: `--fs-sm`, `--fw-medium`
  - Subtitle: `--fs-xs`, `--color-text-muted`
  - Timestamp: `--fs-xs`, `--color-text-muted`, right-aligned
  - Unread: Left border `3px solid var(--accent)`, `--fw-semibold` title
  - Click: Navigate to relevant item
- **Notification types** (generated client-side from data):
  - Overdue action items (check daily)
  - Upcoming milestones (7 days, 1 day before)
  - PTO starting tomorrow/this week
  - New hire 30/60/90 day check-in reminders
- **No server push**: All notifications computed client-side from stored data on app load
- **Dark mode**: Panel uses `--color-surface-raised`. Badge red remains vivid.
- **Responsive**: Panel becomes bottom sheet on mobile, full-width.

---

### Issue #25 — Dashboard / Overview Page

**Goal**: At-a-glance dashboard showing team health, upcoming events, and key metrics.

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  Dashboard                               Good morning│
├──────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │  12      │ │   3      │ │   1      │ │  2      ││
│  │ Members  │ │ On Leave │ │ ⚠️ Risk  │ │ Overdue ││
│  └──────────┘ └──────────┘ └──────────┘ └─────────┘│
├──────────────────────────────────────────────────────┤
│  ┌──────────────────────┐ ┌────────────────────────┐│
│  │ This Week            │ │ Recent 1:1s            ││
│  │                      │ │                        ││
│  │ Mon: Bob 1:1         │ │ Ada — Mar 15 ��        ││
│  │ Wed: Carol 1:1       │ │ Bob — Mar 12 😐        ││
│  │ Thu: Team standup    │ │ Carol — Mar 10 🙂      ││
│  │ Fri: Ada PTO starts  │ │                        ││
│  │                      │ │ [View all]             ││
│  └──────────────────────┘ └────────────────────────┘│
├──────────────────────────────────────────────────────┤
│  ┌──────────────────────┐ ┌────────────────────────┐│
│  │ Open Action Items    │ │ Team Mood Trend        ││
│  │                      │ │                        ││
│  │ 🔴 Fix deploy (Ada)  │ │ ██ ██ ██ ██ ██ ██     ││
│  │ 🔴 Perf review (Carol│ │ Great ████████████     ││
│  │ 🟡 Update wiki (Bob) │ │ Good  ██████           ││
│  │                      │ │ ...                    ││
│  │ [View all]           │ │                        ││
│  └──────────────────────┘ └────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

- **Metric cards**: Row of 4, equal width
  ```css
  .metric-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-4);
    text-align: center;
  }
  .metric-card__value {
    font-size: var(--fs-3xl);
    font-weight: var(--fw-bold);
    font-feature-settings: 'tnum';
    color: var(--color-text);
  }
  .metric-card__label {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
    margin-top: var(--space-1);
  }
  ```
  - "⚠️ Risk" card: Value in `--color-warning` when > 0
  - "Overdue" card: Value in `--color-negative` when > 0
  - Clickable: Navigate to relevant filtered view

- **Content cards**: 2-column grid below metrics, `gap: var(--space-4)`
  - **This Week**: Timeline/agenda style, `--fs-sm`, date labels in `--fw-medium`
  - **Recent 1:1s**: List with avatar, name, date, mood emoji. "View all" link at bottom.
  - **Open Action Items**: Top 5 by priority, same row style as action items table. "View all" link.
  - **Team Mood Trend**: Simple horizontal bar chart or sparkline. Last 4 weeks of average mood. Uses `--accent` for bars.

- **Greeting**: "Good morning/afternoon/evening" based on time, `--fs-lg`, `--color-text-muted`, right-aligned in header
- **Dark mode**: Metric cards use `--color-surface`. Chart colors remain vibrant.
- **Responsive**: Metric cards: 4-col → 2-col on tablet → stacked on mobile. Content cards: 2-col → stacked. Mood chart hidden on mobile (not enough space to be useful).

---

### Issue #26 — Settings Page

**Goal**: Central settings for app preferences, data management, and encryption.

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  Settings                                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Appearance                                          │
│  ┌────────────────────────────────────────────────┐  │
│  │  Theme          [Light ▾]                      │  │
│  │  Dense mode     [○ Off]                        │  │
│  │  Accent color   [● Teal] ○ Blue ○ Purple       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Data & Privacy                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Change passphrase    [ Change ]               │  │
│  │  Auto-lock            [5 min ▾]                │  │
│  │  Export data           [ Export ]               │  │
│  │  Import data           [ Import ]              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  About                                               │
│  ┌────────────────────────────────────────────────┐  │
│  │  Crewbook v1.0.0                               │  │
│  │  Your data is encrypted and never leaves       │  │
│  │  this browser.                                 │  │
│  │                                                │  │
│  │  🔒 AES-256-GCM encryption                    │  │
│  │  🌐 No server, no account                     │  │
│  │  📱 Works offline                              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Danger Zone                                         │
│  ┌────────────────────────────────────────────────┐  │
│  │  Clear all data          [ Delete Everything ] │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Section layout**: Vertical stack of cards, each with a heading (`--fs-lg`, `--fw-semibold`)
- **Setting rows**: Flex row, label left (`--fs-sm`, `--fw-medium`), control right
  - Gap between rows: `var(--space-4)`, separated by `1px solid var(--color-border)`
- **Theme select**: Dropdown with options: Light, Dark, System
- **Dense mode toggle**: Toggle switch component
- **Accent color**: Radio group with colored circles (teal, blue, purple, indigo)
  - Selected: Ring around circle, `2px solid var(--color-text)`, `outline-offset: 2px`
- **Change passphrase**: Opens modal with Current + New + Confirm fields
- **Auto-lock**: Select with timeout options (1 min, 5 min, 15 min, 30 min, Never)
- **About section**: Read-only info card, `--color-surface-alt` background, `--fs-sm`
- **Danger zone**: Same pattern as Issue #17, red border, confirmation required
- **Dark mode**: Standard tokens throughout.
- **Responsive**: Full-width cards. Setting rows stack vertically on mobile (label above control).

---

### Issue #27 — Keyboard Shortcuts

**Goal**: Power-user keyboard shortcuts for navigation and common actions.

**Shortcut overlay (triggered by `?`):**

```
┌──────────────────────────────────────────────────────┐
│  Keyboard Shortcuts                              ✕   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Navigation                                          │
│  ⌘K          Search                                  │
│  G then R    Go to Roster                            │
│  G then D    Go to Dashboard                         │
│  G then A    Go to Action Items                      │
│  G then C    Go to Calendar                          │
│  G then S    Go to Settings                          │
│                                                      │
│  Actions                                             │
│  N           New (context-sensitive)                  │
│  E           Edit selected                           │
│  ⌫           Delete selected                        │
│  ⌘⇧D        Toggle dark mode                        │
│  ?           Show this help                          │
│  Esc         Close modal / deselect                  │
│                                                      │
│  Lists                                               │
│  J / ↓       Move down                               │
│  K / ↑       Move up                                 │
│  X           Toggle selection                        │
│  Enter       Open selected                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **Overlay**: Modal component, `max-width: 520px`
- **Layout**: Two-column within each section — key combo left, description right
  - Key combo: `<kbd>` element styling:
    ```css
    kbd {
      display: inline-block;
      padding: 2px 6px;
      font-size: var(--fs-xs);
      font-family: var(--font-mono);
      background: var(--color-surface-alt);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      box-shadow: 0 1px 0 var(--color-border);
      min-width: 22px;
      text-align: center;
    }
    ```
  - Description: `--fs-sm`, `--color-text-secondary`
  - Section headers: `--fs-xs`, `--color-text-muted`, `text-transform: uppercase`, `letter-spacing: 0.05em`
- **Implementation**: Use a `useKeyboardShortcuts` hook. Don't fire shortcuts when user is typing in an input/textarea.
- **Dark mode**: `kbd` uses `--color-surface-alt` bg (darker in dark mode). Box-shadow uses `--color-border`.
- **Responsive**: Same layout on all sizes. On mobile, shortcuts are informational only (no physical keyboard expected).

---

### Issue #28 — Print Styles

**Goal**: Print-friendly output for 1:1 notes, member profiles, and action items.

**Print stylesheet** (`@media print`):

```css
@media print {
  /* Hide non-essential UI */
  .sidebar,
  .mobile-nav,
  .theme-toggle,
  .toast-container,
  .selection-bar,
  .filter-bar,
  button:not(.no-print-hide),
  .notification-bell { display: none !important; }

  /* Reset colors to print-friendly */
  body, body.dark {
    background: white !important;
    color: black !important;
  }

  /* Cards without shadows */
  .card {
    box-shadow: none !important;
    border: 1px solid #ddd !important;
    break-inside: avoid;
  }

  /* Full-width layout */
  .main-content {
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Page breaks */
  .page-header { page-break-after: avoid; }
  .member-detail__header { page-break-after: avoid; }
  h2, h3 { page-break-after: avoid; }

  /* Links show URL */
  a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
    color: #666;
  }

  /* Status badges - text only */
  .badge {
    background: none !important;
    border: 1px solid #999 !important;
    color: black !important;
  }

  /* Table borders */
  .table th, .table td {
    border: 1px solid #ccc !important;
  }

  /* Hide private indicators in print */
  .privacy-indicator { display: none !important; }

  /* Footer with timestamp */
  @page { margin: 1.5cm; }
}
```

- **Print button**: Ghost button in page header, only visible on screens where print makes sense (member detail, action items, 1:1 notes)
- **Print preview**: Use `window.print()` — no custom preview needed
- **Private content**: Excluded from print by default. Option to include with warning.
- **Responsive**: N/A (print is its own medium)

---

### Issue #29 — Performance Optimization

**Goal**: Fast load times and smooth interactions despite encrypted localStorage.

**No visual spec — this is an engineering concern. Design system implications:**

- **Lazy loading**: All routes lazy-loaded with `React.lazy()` + `Suspense`
  - Loading fallback: Skeleton screens matching the actual layout
  ```css
  .skeleton {
    background: var(--color-surface-alt);
    border-radius: var(--radius);
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }
  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  ```
  - Skeleton variants: `skeleton-text` (lines), `skeleton-avatar` (circle), `skeleton-card` (rectangle)

- **Virtualized lists**: For rosters with 50+ members, use virtual scrolling
  - Maintain the same row height (44px) for accurate virtual scroll calculation
  - Show actual count in footer regardless of visible window

- **Debounced inputs**: Search and filter inputs debounce at 150ms

- **CSS containment**: Add `contain: content` to cards and list items to limit layout recalculation

- **Font loading**: `font-display: swap` to avoid invisible text during font load

- **Encryption performance**: Decrypt data once on unlock, keep decrypted in React state/context. Re-encrypt on write only.

---

### Issue #30 — Team Member Tags & Categories

**Goal**: User-defined tags for flexible grouping beyond the fixed team field.

**Tag input component:**

```css
.tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  min-height: 36px;
  align-items: center;
  cursor: text;
}
.tag-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
.tag-input__tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px 8px;
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
  font-size: var(--fs-xs);
  color: var(--color-text-secondary);
}
.tag-input__tag-remove {
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 12px;
}
.tag-input__field {
  border: none;
  outline: none;
  font-size: var(--fs-sm);
  flex: 1;
  min-width: 80px;
  background: transparent;
}
```

- **Autocomplete**: As user types, show dropdown of existing tags from across all members
- **Create new**: If no match, pressing Enter creates a new tag
- **Remove**: Click `×` on tag or Backspace when input is empty removes last tag
- **In roster filters**: Tags appear as filter chips in the filter bar
- **In member card**: Tags shown below role in grid view, in a "Tags" column in list view
- **Color coding**: Optional — user can assign a color to a tag from a predefined palette (8 colors: teal, blue, purple, pink, red, orange, amber, green). Default is neutral gray.
- **Dark mode**: Tag pills use `--color-surface-alt` (adapts automatically).
- **Responsive**: Tag input wraps naturally. Tags in cards truncate with `+N more`.

---

### Issue #31 — Meeting Templates

**Goal**: Predefined templates for common 1:1 meeting types to speed up note-taking.

**Template selector (in New Note modal):**

```
┌──────────────────────────────────────────────────────┐
│  Start from template:                                │
│                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ 📋 Regular │ │ 🎯 Career  │ │ 🔄 Retro   │       │
│  │    1:1     │ │   Growth   │ │            │       │
│  └────────────┘ └────────────┘ └────────────┘       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ 🆕 New Hire│ │ ⚡ Quick   │ │ ➕ Custom  │       │
│  │  Check-in  │ │   Sync     │ │            │       │
│  └────────────┘ └────────────┘ └────────────┘       │
└──────────────────────────────────────────────────────┘
```

- **Template cards**: Grid of small cards, `padding: var(--space-3)`, `text-align: center`
  - Icon: 24px emoji/icon
  - Label: `--fs-xs`, `--fw-medium`
  - Hover: `--accent-subtle` background, `--accent` border
  - Click: Populates the note textarea with template content (markdown)
- **Built-in templates**:
  - Regular 1:1: Topics prompt, wins, challenges, action items sections
  - Career Growth: Goals check-in, skill development, career aspirations
  - Retro: What went well, what could improve, action items
  - New Hire Check-in: Onboarding progress, questions, 30/60/90 day goals
  - Quick Sync: Brief update, blockers, next steps
- **Custom templates**: User can create/save their own. Stored in settings.
  - Manage templates: Accessible from Settings page, section for "Meeting Templates"
  - Edit template: Modal with name, icon (emoji picker), content (markdown textarea)
- **Dark mode**: Template cards use `--color-surface`. Hover uses `--accent-subtle`.
- **Responsive**: Template grid goes from 3-col to 2-col on mobile. Cards maintain touch target.

---

### Issue #32 — Data Visualization: Simple Charts

**Goal**: Basic charts for team health trends (mood over time, skill distribution, PTO usage).

**Chart components (CSS/SVG-based, no heavy chart library):**

**Mood trend (sparkline):**
```
  Great ──────────────  ●
  Good  ────── ●──●──────
  Neutral ● ──────────────
  Struggling ──────────────
         W1  W2  W3  W4
```

- **Implementation**: SVG polyline or CSS grid bars
- **Container**: Card component, `padding: var(--space-4)`
- **Axes**: `--fs-2xs`, `--color-text-muted`
- **Line/bars**: `stroke: var(--accent)` / `fill: var(--accent)`, `stroke-width: 2`
- **Data points**: Circles, `r=4`, `fill: var(--accent)`, hover shows tooltip with value

**Skill distribution (horizontal bar):**
```
  React        ████████████████  4.0
  TypeScript   ██████████████    3.5
  Go           ████████          2.0
  Leadership   ██████████████    3.5
```

- **Bar**: `height: 24px`, `border-radius: var(--radius-sm)`, `background: var(--accent)`
- **Track**: `height: 24px`, `background: var(--color-surface-alt)`, full width
- **Label**: Left-aligned, `--fs-sm`, `--fw-medium`
- **Value**: Right-aligned, `--fs-xs`, `font-feature-settings: 'tnum'`

**PTO usage (stacked bar by month):**
- Horizontal bars per person, color-coded by PTO type
- Uses status colors: vacation (amber), sick (red), personal (blue)

**Design principles for charts:**
- No heavy library dependencies (no Chart.js, no D3 for basic charts)
- All colors from CSS variables (dark mode compatible)
- Tooltips: Standard card styling, positioned above data point, `--shadow-md`
- Accessible: Include `<title>` and `<desc>` in SVGs, provide data table alternative
- Responsive: Charts resize with container. Below 480px, some charts switch to simplified view.

---

### Issue #33 — Org-Wide Notes & Announcements

**Goal**: Space for notes that apply to the whole team, not a specific member.

**Layout (sidebar nav item + dedicated page):**

```
┌──────────────────────────────────────────────────────┐
│  Team Notes                            [+ New Note]  │
├──────────────────────────────────────────────────────┤
│  📌 Pinned                                           │
│  ┌────────────────────────────────────────────────┐  │
│  │ Q1 2024 Team Goals                   Jan 5 📌  │  │
│  │ Focus areas: reliability, velocity, hiring...  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Recent                                              │
│  ┌────────────────────────────────────────────────┐  │
│  │ Reorg Update                          Mar 12   │  │
│  │ Platform and Mobile merging into...            │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │ Hiring Pipeline Notes                 Mar 1    │  │
│  │ 3 candidates in pipeline for Sr. Eng...        │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Note card**: Standard card, same style as 1:1 notes
  - Title: `--fs-md`, `--fw-semibold`
  - Date: Right-aligned, `--fs-xs`, `--color-text-muted`
  - Preview: `--fs-sm`, 2-line truncation
  - Pin icon: 📌 in header, `--color-text-muted`. Pinned notes always appear first.
- **Note detail**: Click opens full note in a reading view (or expands card)
  - Content: Markdown rendered, `--fs-sm`, `--lh-relaxed`, `max-width: 720px`
  - Actions: Edit, Pin/Unpin, Delete — ghost buttons in header
- **New/Edit note modal**: Title (text input), Content (markdown textarea, `min-height: 240px`), Pin toggle
- **Search**: Filter notes via the global search (Issue #18) or a local search bar
- **Dark mode**: Standard card tokens.
- **Responsive**: Cards full-width, stack vertically. Note detail is a full page on mobile.

---

### Issue #34 — Activity Timeline

**Goal**: Chronological feed of all actions taken for a team member (notes added, feedback logged, goals updated, etc.).

**Layout (within Member Detail, as a tab or sidebar panel):**

```
┌──────────────────────────────────────────────────────┐
│  Activity                                            │
├──────────────────────────────────────────────────────┤
│  Today                                               │
│  ├─ 📝 1:1 note added                    10:30 AM   │
│  │     "Discussed promotion timeline..."             │
│  │                                                   │
│  ├─ ☐ Action item created                 10:35 AM   │
│  │     "Prepare design doc for Project Beta"         │
│  │                                                   │
│  Yesterday                                           │
│  ├─ 🌟 Feedback logged                    3:15 PM    │
│  │     Praise: "Consistently mentors junior..."      │
│  │                                                   │
│  Mar 12                                              │
│  ├─ ✅ Action item completed               2:00 PM   │
│  │     "Complete system design course"               │
│  │                                                   │
│  ├─ 📈 Goal milestone completed            2:05 PM   │
│  │     "Lead design review" in "System Design"       │
│  └───────────────────────────────────────────────────┘
```

- **Timeline**: Vertical line with event nodes
  ```css
  .timeline { position: relative; padding-left: var(--space-6); }
  .timeline::before {
    content: '';
    position: absolute;
    left: 11px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--color-border);
  }
  .timeline-event {
    position: relative;
    padding-bottom: var(--space-4);
  }
  .timeline-event__dot {
    position: absolute;
    left: calc(-1 * var(--space-6) + 6px);
    top: 4px;
    width: 12px;
    height: 12px;
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    border: 2px solid var(--color-border);
  }
  ```
- **Date headers**: `--fs-xs`, `--fw-semibold`, `--color-text-muted`, `text-transform: uppercase`
- **Event content**: `--fs-sm`, icon prefix matching event type
  - Note: 📝, Action item: ☐/✅, Feedback: 🌟/💬, Goal: 📈, PTO: 📅, Status change: 🔄
- **Preview text**: `--fs-xs`, `--color-text-muted`, truncated to 1 line
- **Click**: Navigate to the full item (note detail, action item, etc.)
- **Pagination**: "Load more" button at bottom, loads older events
- **Dark mode**: Timeline line uses `--color-border`. Dots use `--color-surface` center with `--color-border` ring.
- **Responsive**: Full-width, timeline line moves to far left. Padding-left decreases slightly on mobile.

---

### Issue #35 — Quick Actions & Command Bar

**Goal**: Extend the search bar (Issue #18) into a full command palette for power users.

**Layout (same modal as search, with command mode):**

```
┌──────────────────────────────────────────────────────┐
│  > Add team member                              ⌘K  │
├──────────────────────────────────────────────────────┤
│  Commands                                            │
│  ┌────────────────────────────────────────────────┐  │
│  │ ➕ Add team member                             │  │
│  │ 📝 New 1:1 note...                    ⌘⇧N     │  │
│  │ ☐  New action item...                          │  │
│  │ 💬 Add feedback...                             │  │
│  │ 📅 Add PTO entry...                            │  │
│  │ 🌙 Toggle dark mode                   ⌘⇧D     │  │
│  │ ⚙️  Open settings                     G S      │  │
│  │ 📥 Export data                                  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Trigger**: `>` as first character in search switches to command mode
  - Or access directly via separate shortcut if desired
- **Command results**: Same list styling as search results
  - Icon: Left, type-specific, `20px`
  - Label: `--fs-sm`, `--fw-medium`
  - Shortcut: Right-aligned, `<kbd>` styling, `--fs-xs`, `--color-text-muted`
  - Selected: `--accent-subtle` background
- **Sub-commands**: Some commands open a second step (e.g., "New 1:1 note" → member select → note form)
  - Member select: Same command palette but filtered to member list
  - Breadcrumb: Show "New 1:1 note > Select member" at top
- **Recent commands**: Show last 3 used commands when palette opens with `>` and no further input
- **Fuzzy matching**: Filter commands as user types after `>`
- **Dark mode**: Same as search modal (Issue #18).
- **Responsive**: Same as search — full-screen on mobile.

---

### Issue #36 — Reporting & Summaries

**Goal**: Generate summary reports (e.g., weekly team summary, individual performance snapshot).

**Layout — Report generator page:**

```
┌──────────────────────────────────────────────────────┐
│  Reports                               [ Generate ] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Report Type     [Weekly Team Summary ▾]             │
│  Date Range      [Mar 11 – Mar 17, 2024]            │
│  Members         [All ▾]                             │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Preview                                             │
│  ┌────────────────────────────────────────────────┐  │
│  │  Weekly Team Summary                           │  │
│  │  March 11 – March 17, 2024                     │  │
│  │                                                │  │
│  │  Team Size: 12 members                         │  │
│  │  1:1s Completed: 4 of 6 scheduled              │  │
│  │  Action Items: 3 created, 5 closed, 2 overdue  │  │
│  │  PTO: Carol Diaz (Mar 17–21)                   │  │
│  │  Highlights: Ada promoted to Staff Eng          │  │
│  │                                                │  │
│  │  [Copy as Markdown] [Download PDF] [Print]     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **Report types**: Weekly Team Summary, Individual Snapshot, Quarterly Goals Review, PTO Summary
- **Configuration**: Form at top — report type (select), date range (date range picker), member filter (multi-select)
- **Preview card**: Rendered report below config, `--color-surface-alt` background, `padding: var(--space-6)`, `max-width: 720px`
  - Report content: `--fs-sm`, `--lh-relaxed`, structured with headings and lists
  - Generated from stored data (client-side aggregation)
- **Export actions**: Row of ghost buttons below preview
  - Copy as Markdown: Clipboard API, show "Copied!" toast
  - Download PDF: Use `window.print()` with print-optimized styles
  - Print: Same as PDF essentially
- **Report history**: Below generator, list of previously generated reports with timestamps (stored in settings/localStorage)
- **Dark mode**: Preview card uses `--color-surface-alt`. Report text uses standard color tokens.
- **Responsive**: Config form stacks vertically. Preview card full-width. Export buttons stack on mobile.

---

### Issue #37 — Comprehensive Testing & Polish

**Goal**: Final polish pass — consistent styling, animation smoothness, edge case handling.

**No visual spec — this is a quality issue. Design system checklist for the polish pass:**

**Visual consistency audit:**
- [ ] All colors use CSS variables (no hardcoded hex values in components)
- [ ] All spacing uses `--space-*` tokens (no arbitrary px values)
- [ ] All font sizes use `--fs-*` tokens
- [ ] All border radii use `--radius-*` tokens
- [ ] All shadows use `--shadow-*` tokens
- [ ] All transitions use `--duration-*` and `--ease-*` tokens
- [ ] All buttons follow the variant system (primary/secondary/ghost/danger)
- [ ] All cards follow the card variant system (standard/flush/compact/highlighted)

**Animation & transition audit:**
- [ ] No janky transitions (test on 60fps target)
- [ ] Modal open/close is smooth
- [ ] Sidebar collapse/expand is smooth
- [ ] Toast enter/exit feels natural
- [ ] Loading skeletons pulse smoothly
- [ ] All animations respect `prefers-reduced-motion`

**Responsive audit:**
- [ ] All pages tested at 320px, 375px, 640px, 768px, 1024px, 1440px
- [ ] No horizontal overflow at any breakpoint
- [ ] Touch targets ≥ 44×44px on mobile
- [ ] Modals become bottom sheets on mobile
- [ ] Tables scroll horizontally or switch to card layout on mobile
- [ ] Text is readable without zooming at all breakpoints

**Dark mode audit:**
- [ ] Every page visually inspected in dark mode
- [ ] No white flashes during route transitions
- [ ] Shadows adjusted for dark backgrounds
- [ ] Form inputs have sufficient contrast
- [ ] Status/severity colors remain distinguishable
- [ ] Focus rings visible against dark surfaces
- [ ] Scrollbar styled for dark mode

**Accessibility audit:**
- [ ] Tab through every page — all interactive elements reachable
- [ ] Focus indicators visible on every interactive element
- [ ] Screen reader tested: page structure, form labels, status announcements
- [ ] Color contrast: all text meets 4.5:1 (normal) or 3:1 (large)
- [ ] All images/icons have alt text or aria-label
- [ ] All modals trap focus correctly
- [ ] All modals restore focus on close

**Edge cases:**
- [ ] Empty states render correctly for every section
- [ ] Very long names/text truncate gracefully (no layout breaking)
- [ ] 100+ team members: performance acceptable, virtual scroll active
- [ ] Date formatting: handles timezone correctly
- [ ] Encryption: wrong passphrase shows clear error, doesn't corrupt data
- [ ] Import: malformed files show clear error, don't crash app
- [ ] Browser back/forward navigation works correctly
- [ ] Multiple tabs: localStorage sync or conflict warning

---

## Appendix: CSS File Structure

Following `finance-tracking` pattern — one CSS file per component in `src/styles/`, flat directory:

```
src/styles/
├── colorThemes.css       # All color tokens, dark mode overrides
├── typography.css         # Font families, sizes, weights, line-heights
├── spacing.css            # Spacing scale tokens
├── shadows.css            # Shadow and radius tokens
├── transitions.css        # Motion tokens, reduced-motion
├── app.css                # App shell, sidebar, main layout, scrollbar
├── avatar.css             # Avatar component
├── badge.css              # Badge/status component
├── button.css             # Button variants
├── card.css               # Card variants
├── modal.css              # Modal/dialog
├── toast.css              # Toast notifications
├── table.css              # Data table
├── form.css               # Input, select, checkbox, toggle, textarea
├── empty-state.css        # Empty state component
├── filter-bar.css         # Filter chips and search
├── timeline.css           # Activity timeline
├── calendar.css           # PTO calendar
├── chart.css              # Chart/visualization
├── tag-input.css          # Tag input component
├── command-palette.css    # Search/command palette
├── skeleton.css           # Loading skeletons
├── print.css              # Print styles
└── utilities.css          # sr-only, truncate, tnum, etc.
```

---

*End of Crewbook Design System Specification*
