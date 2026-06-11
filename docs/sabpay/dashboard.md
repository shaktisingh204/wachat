# SabPay — Dashboard Frontend Conventions

The merchant dashboard lives at `src/app/sabpay/**` and is built on the
**20ui** design system (`@/components/sabcrm/20ui`). It is deliberately
uniform: one page container, one list-page recipe, one set of shared atoms.
Copy the existing patterns; do not invent new layouts.

```
src/app/sabpay/
├── layout.tsx                    ← mounts SabpayShell (module sidebar) once
├── page.tsx                      ← Overview (stats + recent payments)
├── actions.ts                    ← server actions (thin pass-throughs to rustClient.sabpay.*)
├── actions/                      ← per-entity action files as new entities land
├── _components/                  ← shared atoms (see below)
├── payments/                     ← THE reference list page + [id] detail
│   ├── page.tsx                  ← server component: fetch via action, render client
│   ├── payments-client.tsx       ← THE canonical list-page client (copy this)
│   └── [id]/page.tsx             ← detail page (DetailRow stack in a Card)
├── developers/                   ← API keys (one-time secret reveal via CodeBlock)
├── webhooks/                     ← endpoints + delivery log + redeliver
├── settings/                     ← merchant branding + test/live mode
└── docs/_content                 ← in-app API reference (keep in sync with docs/sabpay/api-reference.md)
```

## Every page renders inside `<SabpayPage>`

`src/app/sabpay/_components/sabpay-page.tsx` is the ONE page container (a clone
of the proven `WachatPage` frame): one max width, one responsive gutter, one
header → body rhythm, plus the `ui20` scope class and `sabpay-page.css`. Pages
never hand-roll their own gutters or headers.

```tsx
import { SabpayPage } from '../_components/sabpay-page';

export default async function Page() {
  const { merchant, payments } = await getSabpayPayments({});
  return (
    <SabpayPage
      title="Payments"
      description={`Every checkout session in ${merchant.mode} mode.`}
      breadcrumb={[{ label: 'SabPay', href: '/sabpay' }, { label: 'Payments' }]}
    >
      <PaymentsClient initialPayments={payments} mode={merchant.mode} />
    </SabpayPage>
  );
}
```

Props: `breadcrumb`, `eyebrow`, `title`, `description`, `actions`, `bordered`,
`width` (`default | narrow | wide`), and `variant="app"` for full-bleed app
surfaces.

## List pages copy `payments-client.tsx`

`src/app/sabpay/payments/payments-client.tsx` is the reference implementation
every entity list copies:

1. **Server component page** fetches the first page via a server action and
   passes `initialPayments` + `mode` into a `'use client'` component.
2. **`SegmentedControl`** status filter on the left, primary **Create** button
   on the right (wrap both in `<ListToolbar>`; add `<ExportCsvButton>` next to
   Create where the entity has a CSV export).
3. **`Card > CardBody > Table`** with monospace id links to the `[id]` detail
   page, tabular-nums amounts (`formatSabpayAmount`), an
   `<EntityStatusBadge>`/`<PaymentStatusBadge>` status column, and a muted
   empty-state line ("No … payments in test mode yet.").
4. **`Modal` create form** (`Field` + `Input`), rupee input converted to paise
   with `Math.round(parseFloat(v) * 100)`, inline `formError`, busy state on
   the submit button.
5. On success: close the modal, `toast({ … , tone: 'success' })` (copying the
   checkout link to the clipboard where it exists), then **`router.refresh()`**
   so the server component re-fetches. No client-side cache to reconcile.
6. Cursor pagination only — append pages with `<LoadMore>` driven by the
   `before` cursor (the `created_at` of the last row). Never numbered pages.

## Shared atoms — `src/app/sabpay/_components/`

Always reach for these before writing new UI:

| Atom | Use |
| ---- | --- |
| `EntityStatusBadge` | One tone map for every entity status (`paid/succeeded/processed/active/won → success`, `failed/lost/cancelled/halted → danger`, unknown → neutral, so new backend states never crash a list). `PaymentStatusBadge` is the payments specialization. |
| `DetailRow` | Label/value grid row for detail pages — stack inside `Card > CardBody` for a Stripe-style panel. |
| `CopyableId` | Monospace id + copy button (for `pay_`/`order_`/`rfnd_`… ids) with toast confirmation. |
| `ListToolbar` | The list-header flex row: filter left, actions right, wraps on narrow widths. |
| `ConfirmAction` | AlertDialog wrapper for destructive/irreversible actions (revoke key, cancel link, close QR, accept dispute). Stays open + busy until the async `onConfirm` settles. |
| `CodeBlock` | Monospace block with copy button — API snippets, one-time `sk_…`/`whsec_…` reveals. |
| `ExportCsvButton` | Calls a server action returning `{ csv, filename }`, downloads client-side via Blob URL. |
| `LoadMore` | Centered load-more button for `before`-cursor pagination; renders nothing when exhausted. |
| `SabpayShell` / `sabpay-sidebar-config.ts` | The module sidebar (module-sidebars registry pattern) — mounted once in `layout.tsx`, never per page. |

## Server actions

Server actions live in `src/app/sabpay/actions.ts` (overview, payments, keys,
webhooks, settings); new per-entity files go under `src/app/sabpay/actions/`.
The contract:

- `'use server'`, thin pass-throughs to `rustClient.sabpay.*` — **no business
  logic in the Next.js layer**; the Rust engine owns validation and side
  effects.
- Reads `return` (or rethrow) so route error boundaries catch failures;
  **mutations return `{ error }` instead of throwing** so clients render
  inline messages (`errorMessage()` unwraps `RustApiError`).
- Mutations call `revalidatePath('/sabpay/…')` for every page whose data
  changed (e.g. payment create revalidates `/sabpay` and `/sabpay/payments`).
- Auth is implicit: `rustFetch` signs a shared-secret JWT from the SabNode
  session, so every call is scoped to the signed-in merchant. Never accept a
  userId from the client.

## 20ui gotchas (these have all bitten before)

- **No barrel self-cycle.** Anything that is itself re-exported by the 20ui
  barrel must NOT import back through `@/components/sabcrm/20ui` — use relative
  paths. The cycle resolves to a plain object and every shelled route dies with
  "Element type is invalid … got: object". App-level code (like this module)
  may import the barrel.
- **`renderIcon` for icon props.** lucide icons are `forwardRef` *objects*, not
  functions. Any 20ui `icon` prop must be rendered through `renderIcon` from
  `_icon.tsx` (imported relatively) — never `typeof icon === 'function'`
  checks, raw `<Icon/>` interpolation of unknown values, or `{icon}` directly.
- **Scoped CSS uses `:is(.20ui, .ui20)`.** After the ui20 → 20ui scope rename,
  shared CSS must match both scope classes:
  `:is(.20ui, .ui20) .sabpay-foo { … }`. **Never write a bare `.20ui.foo`
  compound** — a leading-digit class is invalid as written and silently kills
  the whole pairing (this is how the page gutters died once).
- Tokens come from the 20ui system (`var(--st-*)`); no raw Tailwind accent
  classes or bespoke palettes inside the dashboard.

## SabFiles rule (project-wide, applies here)

Every file input sources from SabFiles — **never a free-text URL paste**:

- **Payment-page branding image** (`branding_image_url` in the page create/edit
  form) → `<SabFilePickerButton>` from `@/components/sabfiles`.
- **Dispute evidence** (`file_urls` on the contest form) →
  `<SabFilePickerButton>` (multi-select; the chosen SabFiles URLs are what get
  submitted to `POST /v1/disputes/{id}/contest`).
- The picker has Library + Upload modes only; do not re-add a "From URL" tab.
  The merchant logo in Settings follows the same rule.

## Checklist for a new entity page

- [ ] Server `page.tsx` fetches via a server action, renders inside
      `<SabpayPage>` with breadcrumb + title + description.
- [ ] Client component copied from `payments-client.tsx`
      (SegmentedControl filter → Card>Table → Modal create → toast →
      `router.refresh()`), with `ListToolbar` + `LoadMore`.
- [ ] Statuses through `EntityStatusBadge`; ids through `CopyableId`; detail
      page through `DetailRow`; destructive actions through `ConfirmAction`.
- [ ] Actions file under `src/app/sabpay/actions/`, mutations returning
      `{ error }` + `revalidatePath`.
- [ ] Sidebar entry added in `sabpay-sidebar-config.ts`.
- [ ] No barrel self-cycles, icons via `renderIcon`, CSS scoped with
      `:is(.20ui, .ui20)`, file inputs via SabFiles.
- [ ] If the entity has new API endpoints: update
      `docs/sabpay/api-reference.md` **and** `src/app/sabpay/docs/_content`
      together.
