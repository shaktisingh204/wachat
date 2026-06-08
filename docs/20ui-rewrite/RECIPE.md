# SabNode page REDESIGN — the recipe

Goal: every in-app page (dashboard + account/auth) is a **genuine 20ui redesign** —
**re-architected, visually rich, compact, and useful**. This is NOT a restyle or an
import swap and NOT just "make it compact." **Rearrange every element**, rethink the
layout, and make the page look like a finished, premium 20ui product surface.

Hidden modules (CRM, HRM, SEO, SabWa, Website Builder + `sabcrm`/`crm-advanced`/`hrm-advanced`) are **skipped entirely** — do not touch them.

Apply all four skills on every page: `emil-design-eng`, `design-taste-frontend`, `fixing-accessibility`, `systematic-debugging`.

## The redesign mandate (read first)

- **Re-architect, don't preserve.** Reimagine the page's structure from scratch as a
  20ui surface. Regroup content into purposeful sections; reorder by importance; merge
  scattered bits; split overloaded blocks. The old layout is a starting reference, not a
  constraint.
- **Make it feel designed, not generic.** A header band, a KPI/StatCard strip where it
  helps, sectioned Cards with titles + icons, clear primary action. Every page should
  read as "someone designed this on purpose."
- **Visual language — use color + icons (with taste):**
  - Color via tokens only (`--st-accent`, tone soft tints `--st-*-soft`, status colors,
    `Badge` tones, `StatCard` accents). A *little* color to guide the eye — accents on
    primary actions, status badges, stat-tile icon chips, section icons. Never raw hex /
    Tailwind palette; never garish. Restraint = emil/design-taste.
  - Icons everywhere they add meaning: section/card titles, stat tiles, empty states,
    buttons, list rows. Use Lucide via 20ui. Decorative icons `aria-hidden`.
- **Richer building blocks:** prefer `StatCard`, `Badge`, `Card` w/ icon headers,
  `EmptyState` with icon+action, `Separator`, `Progress`, tabs/segmented where they
  clarify — over plain stacked text. But stay compact (density = `/demo20`).

## Hard rules

1. **20ui only.** Import UI solely from `@/components/sabcrm/20ui`. Remove every `@/components/ui`, `clay`, `sab-ui`, `wabasimplify` import, raw Tailwind accent color (`bg-blue-500`, etc.), and inline `style={{…}}` (keep only genuinely dynamic values). Use `--st-*` / `--u-*` tokens for color/spacing/radius.
2. **Icons** via the `renderIcon` pattern — pass a Lucide component or an element; never assume one form. Lucide icons are forwardRef objects.
3. **No new design systems, no bespoke layout.** Compose 20ui primitives.

## Page structure (the skeleton)

```tsx
<PageHeader>
  <PageHeaderHeading>
    <PageEyebrow>Module</PageEyebrow>        {/* optional */}
    <PageTitle>Clear page name</PageTitle>
    <PageDescription>One useful sentence on what this does.</PageDescription>
  </PageHeaderHeading>
  <PageActions>{/* primary action(s) only */}</PageActions>
</PageHeader>

{/* content: Card / Section blocks on the --st-space-* scale, max-width capped */}
```

- One H1 per page (PageTitle). Sections use Card/CardHeader/CardTitle.
- Density target = the `/demo20` showcase. Tighten oversized padding/margins.

## Redesign: rearrange + enrich + declutter

- **Rearrange:** regroup and reorder every element into a deliberate hierarchy (most
  important first). Turn flat text stacks into sectioned Cards; pull primary actions into
  the header; cluster related controls; give the page a clear top-to-bottom flow.
- **Enrich:** add the 20ui visual layer — header band, KPI/StatCard row where data
  exists, icon’d section titles, status `Badge`s, tasteful accent color, a strong
  `EmptyState`. Make a sparse page feel complete and a noisy page feel calm.
- **Declutter:** remove decorative hero banners, lorem, duplicated breadcrumbs/nav, dead
  tabs, and "coming soon" stubs. **Allowed:** cut clearly-unused UI and non-functional
  stub features. Keep all *working* features and their data wiring.
- Every section must answer "what does the user do here?". If it doesn't, cut it or merge it.

## Required states

- **Loading:** `Skeleton` matching the content shape (or `loading.tsx`).
- **Empty:** `EmptyState` with icon + title + one-line description + a primary action.
- **Error:** an `error.tsx` boundary per route segment.

## Accessibility (`fixing-accessibility`)

- Semantic landmarks + a single logical heading order. Labels on every control (`Field`/`Label`). Visible focus. `aria-*` on icon-only buttons. Sufficient contrast (use tokens).

## Verify (`systematic-debugging`) before commit

- No console errors. No RSC→client function-prop passing (Server Components must pass icon **elements** or move interactivity to a client child). No DOM prop leaks (`asChild`, slot props consumed). No icon component-vs-element crashes.
- `next build` (turbo) exits 0. Grep guard: file has zero forbidden imports.

## Layout archetypes (pick one per page)

1. **Overview / dashboard** — PageHeader + StatCard row + a few focused Cards.
2. **List / table** — PageHeader + toolbar (search/filter) + `Table` (or Card list) + pagination + EmptyState.
3. **Detail** — PageHeader (with back + entity title) + tabbed/section Cards.
4. **Form / wizard** — PageHeader + `Field`/`Input`/`Select` in a single focused Card column; sticky action bar.
5. **Settings** — PageHeader + grouped setting rows (label + control), `Separator` between groups.

## Workflow per module

- Batch pages by archetype; one agent per small batch, editing disjoint files.
- After each module: `next build` → grep-guard → spot check → **one commit per module to `main`**.
- Tick the module in `PROGRESS.md`.
