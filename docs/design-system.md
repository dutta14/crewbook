# Crewbook Design System

> **Direction:** Option C — "Warm & Personal"  
> **Philosophy:** Cream backgrounds, warm grays, teal accent. People-first visual weight with larger avatars and softer edges. Feels like Basecamp or Cron — a tool that cares about humans, not tickets.

---

## Color Tokens

All colors via CSS variables. Never hardcode hex. Dark mode via `body.dark` class.

### Light Mode

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#fffbf5` | Page background |
| `--bg2` | `#faf5ee` | Sidebar, secondary surfaces |
| `--fg` | `#292524` | Primary text |
| `--fg2` | `#78716c` | Secondary/muted text |
| `--border` | `#e7e0d6` | Borders, dividers |
| `--card-bg` | `#ffffff` | Cards, modals |
| `--card-shadow` | `0 2px 8px rgba(0,0,0,0.06)` | Card elevation |
| `--accent` | `#0f766e` | Primary actions, links, active nav, brand |
| `--accent-hover` | `#0d6460` | Hovered buttons/links |
| `--accent-subtle` | `rgba(15,118,110,0.08)` | Selected rows, active filters |
| `--overlay` | `rgba(0,0,0,0.4)` | Modal backdrop |

### Dark Mode (`body.dark`)

| Token | Value |
|---|---|
| `--bg` | `#1c1917` |
| `--bg2` | `#292524` |
| `--fg` | `#fafaf9` |
| `--fg2` | `#a8a29e` |
| `--border` | `#44403c` |
| `--card-bg` | `#292524` |
| `--card-shadow` | `0 2px 8px rgba(0,0,0,0.3)` |

### Status Colors

| Status | Light BG | Light FG | Dark BG | Dark FG |
|---|---|---|---|---|
| Active | `#d1fae5` | `#065f46` | `#064e3b` | `#6ee7b7` |
| On Leave | `#fef3c7` | `#92400e` | `#78350f` | `#fcd34d` |
| Departing | `#fee2e2` | `#991b1b` | `#7f1d1d` | `#fca5a5` |
| New Hire | `#ccfbf1` | `#115e59` | `#134e4a` | `#5eead4` |

### Danger/Error Colors

| Context | Light | Dark |
|---|---|---|
| Error text/border | `#dc2626` | `#f87171` |
| Error background | `#fee2e2` | `#7f1d1d` |

> **Note:** `#dc2626` fails AA contrast on dark `--card-bg` (#292524) at 3.1:1. Use `#f87171` (5.6:1) in dark mode.

### Avatar Palette (deterministic from name hash)

`#0f766e`, `#b45309`, `#7c3aed`, `#0369a1`, `#be123c`, `#6d28d9`, `#c2410c`, `#7e22ce`, `#0e7490`, `#9f1239`

> **Note:** `#4f46e5` (indigo) replaced with `#6d28d9` — original failed AA contrast against white text (3.95:1). New value passes at 5.4:1.

---

## Typography

- **Font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
- **Monospace:** `'SF Mono', 'Cascadia Code', 'Consolas', monospace`
- **Data:** Use `font-feature-settings: 'tnum'` for numbers in tables/stats

| Role | Size | Weight | Line-height |
|---|---|---|---|
| Page title | `1.5rem` (24px) | 700 | 1.3 |
| Section heading | `1rem` (16px) | 600 | 1.4 |
| Body | `0.875rem` (14px) | 400 | 1.6 |
| Caption/meta | `0.75rem` (12px) | 400 | 1.5 |
| Badge text | `0.75rem` (12px) | 500 | 1 |
| Button | `0.875rem` (14px) | 500 | 1 |

---

## Spacing

4px base scale.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `4px` | Tight gaps (icon-to-text) |
| `--space-2` | `8px` | Inline spacing, badge padding |
| `--space-3` | `12px` | Card internal padding (small) |
| `--space-4` | `16px` | Standard padding, form gaps |
| `--space-5` | `20px` | Section gaps |
| `--space-6` | `24px` | Card padding |
| `--space-8` | `32px` | Page padding, major section gaps |
| `--space-10` | `40px` | Page top margin |

---

## Border Radius

| Element | Radius |
|---|---|
| Cards, modals | `16px` |
| Buttons, inputs | `8px` |
| Badges | `999px` (pill) |
| Avatars | `50%` (circle) |
| Sidebar nav items | `8px` |

---

## Shadows

| Level | Value |
|---|---|
| Card | `0 2px 8px rgba(0,0,0,0.06)` |
| Modal | `0 8px 32px rgba(0,0,0,0.12)` |
| Dropdown | `0 4px 16px rgba(0,0,0,0.08)` |
| Focus ring | `0 0 0 3px var(--accent-subtle)` |

---

## Layout

- **Sidebar:** 220px fixed, left side, `var(--bg2)` background
- **Main content:** Flex-grow, `28px 32px` padding
- **Dashboard cards:** CSS Grid, `repeat(auto-fit, minmax(300px, 1fr))`, `16px` gap
- **Max content width:** `1200px` centered within main area
- **Mobile (< 768px):** Sidebar collapses to hamburger menu, single column layout
- **Tablet (768–1024px):** Sidebar stays, cards stack to 1-2 columns

---

## Core Components

### Avatar
- Sizes: `sm` (32px), `md` (40px), `lg` (64px)
- Circle, white text, deterministic background from name hash
- `aria-label` with full name

### Badge (Status)
- Pill shape (`border-radius: 999px`)
- `padding: 2px 10px`, `font-size: 12px`, `font-weight: 500`
- Color pairs from Status Colors table above

### Card
- `background: var(--card-bg)`, `border: 1px solid var(--border)`
- `border-radius: 16px`, `box-shadow: var(--card-shadow)`
- `padding: 20px`
- Section title: `h3`, `font-size: 12px`, `text-transform: uppercase`, `letter-spacing: 0.05em`, `color: var(--fg2)`

### Button
- **Primary:** `background: var(--accent)`, `color: white`, `border-radius: 8px`, `padding: 8px 16px`
- **Secondary:** `background: transparent`, `border: 1px solid var(--border)`, `color: var(--fg)`
- **Ghost:** No border, `color: var(--accent)`, hover shows `var(--accent-subtle)` bg
- **Danger:** `background: #dc2626`, `color: white`
- All buttons: `font-weight: 500`, `font-size: 14px`, `cursor: pointer`

### Modal
- Centered, `max-width: 480px`, `border-radius: 16px`
- Backdrop: `var(--overlay)`
- Header: title + close button (X icon, top-right)
- Footer: action buttons right-aligned
- Escape to close, focus trapped inside

### Toast
- Bottom-right, `border-radius: 8px`, `padding: 12px 16px`
- Auto-dismiss after 5s, manual dismiss via X
- Types: success (teal bg), error (red bg), info (neutral)

### Form Inputs
- `border: 1px solid var(--border)`, `border-radius: 8px`, `padding: 8px 12px`
- Focus: `border-color: var(--accent)`, `box-shadow: var(--focus-ring)`
- Label: `font-size: 12px`, `font-weight: 500`, `color: var(--fg2)`, above input
- Error: `border-color: #dc2626`, error text below in red

### Inline Form (Expand Pattern)
- Used for add/edit-in-place (skills, todos, action items, document links)
- **Collapsed:** Ghost button ("+ Add item") or edit icon
- **Expand:** `max-height` transition from `0` → content height, `var(--transition-normal) var(--ease-out)`. Focus moves to first input.
- **Collapse:** `var(--transition-fast) var(--ease-in)`. Focus returns to trigger button.
- **Reduced motion:** Opacity crossfade `150ms`, no spatial movement
- **Keyboard:** Enter submits, Escape cancels and collapses
- **CSS:** `transition: max-height var(--transition-normal) var(--ease-out), opacity var(--transition-fast) var(--ease-out);`

### Empty State
- Centered in container, `max-width: 320px`
- Stroke icon (48px), muted text, primary CTA button
- `color: var(--fg2)`, `padding: 48px`

---

## Privacy Visual Language

| Context | Visual Treatment |
|---|---|
| Private notes | Lock icon (stroke), `opacity: 0.7` text, dashed left border `var(--border)` |
| Shared notes | Eye icon (stroke), normal styling |
| Flight risk indicator | Small colored dot on roster avatar: green/amber/red, 8px, positioned bottom-right |
| Private section header | `🔒 Private Notes` label with muted background `var(--bg2)` |
| Confirmation dialogs | Yellow warning banner inside modal for privacy-changing actions |

### Flight risk notes (private by design)

- Notes and the derived level live only in the private envelope (`flightRisk` key, `src/data/privateStore.ts`). Notes are append-only: no edit, no single delete; they are purged when the member is deleted.
- The dot (`FlightRiskIndicator`) puts the level in no attribute or class name. Screen readers get a visually hidden "Flight risk: High" text node, so it must never render inside a shared or exported view.
- The section header uses `var(--card-bg)` rather than `var(--bg2)`: `--fg2` text on `--bg2` is 4.42:1, below WCAG AA.
- Seam for sharing, export and summary features: never import `privateStore`, `PrivateNotes` or `FlightRiskIndicator` from share or export code, and build those payloads from an allowlist of fields.
- The section collapses on tab blur and after five minutes idle (`usePrivateViewGuard`, timeout is a parameter for a future auto-lock setting). Envelope-level auto-lock is not part of this feature.

### Feedback log (private by design)

- Entries live only in the private envelope (`feedback` key, `src/data/feedbackStore.ts`) and are purged when the member is deleted. `src/data/feedbackIsolation.test.ts` fails if share, export or summary code imports the store or its hooks; extend its allowlist only on purpose.
- Type colours: positive uses `--status-active-*`, constructive uses `--status-on-leave-*`, neutral uses `--bg2` with `--fg` and a border (`--fg2` on `--bg2` is below AA). Constructive cards also say "For your eyes only" so the type never rests on colour alone.
- The tab count badge (`Tabs` `badge` prop, `.tabs__badge`) adds visually hidden "entries" text so it reads as "Feedback 2 entries".
- Quick-add: the `useFeedbackQuickAdd` hook backs the dashboard and roster buttons, the profile header and `FeedbackFab`. The FAB is 48px, sits at `--z-fab` (30, below the modal layers) and is hidden from 768px up, where each page has its own button. Roster row buttons appear on hover or focus where hover exists, and always on touch.
- Promo packet output is plain text built by `formatPromoPacket` from `getPromoPacketEntries` (positive only, oldest first). It is the only route feedback text takes out of the app, and the clipboard toast never echoes it.
- Filters live in component state only, never in the URL or storage.

---

## Motion

### Motion Tokens

| CSS Variable | Value | Use |
|---|---|---|
| `--transition-fast` | `150ms` | Micro-interactions: hover, toggle, checkbox, badge |
| `--transition-normal` | `250ms` | State transitions: modal open, panel expand, page enter |
| `--transition-slow` | `350ms` | Layout shifts: list reorder, chart entrance, stagger sequences |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Elements entering view (modal open, toast appear, card mount) |
| `--ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Elements leaving view (modal close, toast dismiss, panel collapse) |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | Continuous motion: tab slide, view toggle, drag reorder |

### Motion Patterns

- **Micro-interactions:** `var(--transition-fast) var(--ease-out)` (hover, toggle, badge change)
- **Layout shifts:** `var(--transition-normal) var(--ease-out)` (panel open/close, card appear)
- **Modal enter:** `var(--transition-normal) var(--ease-out)` (scale 0.95→1, opacity 0→1)
- **Modal exit:** `var(--transition-fast) var(--ease-in)` (scale 1→0.95, opacity 1→0)
- **List stagger:** `var(--transition-slow)` with `30–50ms` delay between siblings
- **Skeleton loading:** Pulse animation, `var(--bg2)` to `var(--border)` gradient
- **Respect `prefers-reduced-motion`:** Replace all spatial movement with `opacity` crossfade at `var(--transition-fast)`. No transforms, no slides, no scale.

---

## Icons

- Stroke-based SVGs only (`fill="none" stroke="currentColor" stroke-width="2"`)
- No emoji in UI (except mood tracking: those are data, not decoration)
- Size: `20px` default, `16px` inline, `48px` empty states

---

## CSS Architecture

One CSS file per component in `src/styles/`. No CSS modules, no Tailwind.

```
src/styles/
├── tokens.css          # All variables (colors, spacing, shadows, radii)
├── app.css             # App shell, sidebar, main layout
├── avatar.css
├── badge.css
├── button.css
├── card.css
├── modal.css
├── toast.css
├── table.css
├── form.css
├── empty-state.css
├── timeline.css
├── calendar.css
├── chart.css
└── utilities.css       # sr-only, truncate, tnum
```

---

*Approved direction: Option C — Warm & Personal. All engineers implement against these tokens and components.*
