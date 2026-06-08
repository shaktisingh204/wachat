# SabNode page rewrite — the recipe

Goal: every in-app page (dashboard + account/auth) is **compact, useful, and 20ui-only**.
Hidden modules (CRM, HRM, SEO, SabWa, Website Builder + `sabcrm`/`crm-advanced`/`hrm-advanced`) are **skipped entirely** — do not touch them.

Apply all four skills on every page: `emil-design-eng`, `design-taste-frontend`, `fixing-accessibility`, `systematic-debugging`.

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

## Compact & useful (declutter)

- Remove: decorative hero banners, empty/placeholder sections, lorem, duplicated breadcrumbs/nav, dead tabs, "coming soon" stubs that do nothing.
- **Allowed:** cut clearly-unused UI and non-functional stub features (per product decision). Keep all *working* features and their data wiring.
- Every section must answer "what does the user do here?". If it doesn't, cut it.

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
