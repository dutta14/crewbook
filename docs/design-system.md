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

### Avatar Palette (deterministic from name hash)

`#0f766e`, `#b45309`, `#7c3aed`, `#0369a1`, `#be123c`, `#4f46e5`, `#c2410c`, `#7e22ce`, `#0e7490`, `#9f1239`

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
- Sizes: `sm` (32px), `md` (36px), `lg` (64px)
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
- Auto-dismiss after 4s, manual dismiss via X
- Types: success (teal bg), error (red bg), info (neutral)

### Form Inputs
- `border: 1px solid var(--border)`, `border-radius: 8px`, `padding: 8px 12px`
- Focus: `border-color: var(--accent)`, `box-shadow: var(--focus-ring)`
- Label: `font-size: 12px`, `font-weight: 500`, `color: var(--fg2)`, above input
- Error: `border-color: #dc2626`, error text below in red

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

---

## Motion

- **Micro-interactions:** `150ms ease` (hover, toggle, badge change)
- **Layout shifts:** `250ms ease-out` (panel open/close, card appear)
- **Modal enter:** `200ms ease-out` (scale 0.95→1, opacity 0→1)
- **Skeleton loading:** Pulse animation, `var(--bg2)` to `var(--border)` gradient
- **Respect `prefers-reduced-motion`:** Disable all transitions when set

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
