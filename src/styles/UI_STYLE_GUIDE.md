# IntegraSource UI Style Rules

## Page Backgrounds
- Main page backgrounds must be white or near-white (`#ffffff`).
- Sidebar: `#f8fafc` (light slate) is acceptable for the navigation panel.

## Text Colors
- **Headings / titles**: `#0f172a` (dark navy) — high contrast
- **Body text**: `#111827` or `#1e293b` — dark and readable
- **Secondary / helper text**: `#1f2937` or `#334155` — still dark enough to read easily
- **Links**: `#2563eb` (vivid blue)
- **Metadata / disabled / empty-state text**: `#64748b` only as a last resort. Add a comment explaining why.

### Avoid for meaningful text
Do NOT use these for body, helper, subtitle, nav labels, card descriptions, or accordion text:
- `#94a3b8`
- `#9ca3af`
- `#64748b` (allowed only for disabled/empty/metadata — see above)
- `#6b7280`

## Cards
- Background: `#ffffff`
- Border: `#93c5fd` (visible blue tint) or `#bfdbfe` (softer variant)
- Shadow: `0 8px 20px rgba(15, 23, 42, 0.08)`
- Avoid faint gray card backgrounds unless the card is explicitly disabled.

## Category Chips / Pills
- Must use colored tint backgrounds, not generic gray.
- Examples: Operations → blue, Workforce → teal, Finance → orange, Sales → purple.

## Sidebar
- Nav labels must be dark and readable: `#1f2937` or darker.
- Active state: `#1d4ed8` with `#e0edff` background.
- Footer text (version, copyright) is metadata and may use `#64748b`.

## CSS Variables (defined in `src/index.css`)
Use `var(--is-*)` tokens in new code rather than hardcoded color values:

```css
--is-text-heading: #0f172a;
--is-text-body: #111827;
--is-text-secondary: #1f2937;
--is-text-helper: #334155;
--is-link: #2563eb;
--is-card-bg: #ffffff;
--is-page-bg: #ffffff;
--is-border: #93c5fd;
--is-border-soft: #bfdbfe;
--is-shadow-card: 0 8px 20px rgba(15, 23, 42, 0.08);
```

## Overall Direction
Maintain the modern, colorful **Operational Intelligence Portal** look:
- Bright white pages
- Blue/purple/teal/green accent tints
- Visible card borders and soft shadows
- High-contrast, readable text throughout
- No washed-out or muted gray dominating the UI
