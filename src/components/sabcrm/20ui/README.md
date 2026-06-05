# 20ui — SabCRM's design system

**Twenty as the foundation; 20ui as the modern, minimal, comprehensive system on top.**

20ui is a real component library: typed React components with co-located styles,
one barrel export, built on the Twenty design tokens (`--st-*`) and the
`src/styles/20ui.css` motion / elevation / focus layer.

> This directory **is** the system. It is not the scattered, per-route CSS it
> replaces — every component shares one token set, one motion language, one
> focus ring, and one set of conventions.

## Conventions (every component follows these)

1. **Files** — one module per component: `20ui/<name>.tsx` + co-located
   `20ui/<name>.css`. The `.tsx` imports its `.css` as a side effect. The
   barrel (`index.ts`) re-exports every component.
2. **Namespace** — component classes are prefixed `u-` (e.g. `.u-card`,
   `.u-btn`) and scoped under `.sabcrm-twenty` so they inherit the Twenty
   tokens. Render 20ui inside a `.sabcrm-twenty` subtree.
3. **Tokens** — never hardcode colours/spacing. Use:
   - surfaces/text/borders/accent/danger: `--st-bg`, `--st-bg-secondary`,
     `--st-text`, `--st-text-secondary`, `--st-text-tertiary`, `--st-border`,
     `--st-border-light`, `--st-accent`, `--st-accent-soft`, `--st-accent-hover`,
     `--st-accent-grad`, `--st-danger`, `--st-danger-soft`, `--st-status-ok`,
     `--st-warn`, `--st-hover`, `--st-active`.
   - shape/space/type: `--st-radius` (6), `--st-radius-sm`, `--st-radius-lg`,
     `--st-radius-pill`, `--st-space-1..6`, `--st-font-size`,
     `--st-font-size-sm|xs|lg|xl`, `--st-fw-regular|medium|semibold`.
   - motion/elevation/focus (from `20ui.css`): `--u-ease-out`, `--u-ease-in-out`,
     `--u-dur-fast|--u-dur|--u-dur-slow`, `--u-elev-1|2|3`, `--u-focus-ring`.
4. **API** — function components; typed props; spread the rest onto the root
   DOM node; accept + merge `className`; `forwardRef` for inputs/buttons;
   `'use client'` only when interactive (state/handlers).
5. **Variants & sizes** — expose `variant` and (where relevant) `size` props that
   map to modifier classes (`.u-btn--primary`, `.u-btn--sm`). Sensible defaults
   so the unstyled call is already beautiful.
6. **Motion (Emil)** — animate transform/opacity only, custom `--u-ease-out`,
   <250ms. Pressables `scale(0.97)` on `:active`. Overlays scale-in from their
   edge; modals from centre. Never animate constantly-seen / keyboard actions.
   The global `20ui.css` + `prefers-reduced-motion` already handle reduced motion.
7. **Accessibility** — native elements first (`button`, `input`, `a`); ARIA only
   when a native element can't express it; every control has an accessible name;
   icon-only buttons need `aria-label`; decorative icons `aria-hidden`; visible
   `:focus-visible` (the global ring); errors linked via `aria-describedby` +
   `aria-invalid`; `role`/`aria-*` complete on custom widgets (tabs, switch,
   menu, dialog); modals trap focus + restore + Escape-to-close.

## Aesthetic

Twenty's calm, dense, near-monochrome surface — refined: softer radii, soft
low-contrast elevation, one accent (Twenty blue), generous-but-tight spacing,
Inter 13px base. Minimal by default; colour is used sparingly and on purpose
(status, accent, tag dots, colourful avatar fallbacks). 100× more polished than
the raw Twenty CSS, never louder.

## Components

Layout/containers: `Card` (+ `CardHeader`/`CardBody`/`CardFooter`, variants
elevated/outlined/ghost/interactive), `StatCard`, `MediaCard`, `Separator`,
`Surface`.
Actions: `Button` (primary/secondary/ghost/outline/danger · sm/md/lg · icon ·
loading · block), `IconButton`, `ButtonGroup`, `SegmentedControl`, `Menu`
(dropdown), `Kbd`.
Inputs: `Input`, `Textarea`, `Select` (re-export `StSelect`), `Switch`,
`Checkbox`, `Radio`, `Field` (label + help + error wrapper).
Data display: `Badge`, `Tag`, `Avatar` (+ `AvatarGroup`), `Chip`, `Progress`
(bar + ring), `Stat`.
Feedback: `Banner`/`Alert`, `Callout`, `EmptyState`, `Skeleton`, `Spinner`,
`Tooltip`, `Toast` (optional).
Navigation: `Tabs`, `Breadcrumb`.

Every component is demoed on `/sabcrm/20ui`.
