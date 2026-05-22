# Permission Groups — runtime enforcement

HRM permission groups (`hrm_permission_groups` + `hrm_employee_groups`) are
stored configuration today. This module bridges *config → runtime* with a
small set of read helpers used by server components / server actions /
client-bound RSCs.

## Mental model

- Each tenant can define **permission groups** (e.g. "Managers",
  "Sales reps", "Read-only auditors"). Each group has a list of
  `{ module, actions[] }` entries.
- Each employee can be assigned to **one** group via
  `hrm_employee_groups`.
- Tenant owners (logged-in users without a `crm_employees` record) are
  considered **unrestricted** — they always pass the check. This is
  back-compat: tenants that haven't bothered to set up groups keep
  working unchanged.
- Employees **without** a group assignment are also unrestricted
  (deliberately permissive — opt-in narrowing). To lock someone down,
  put them in a group with the desired permissions.

## API

```ts
import {
  hasPermissionGroup,
  getCurrentUserPermissions,
  hasPortalAccess,
} from '@/lib/permission-groups/check';

// Per-call check — preferred in server actions and route handlers.
const canDelete = await hasPermissionGroup('crm_invoices', 'delete');
if (!canDelete) return { ok: false, error: 'Not allowed.' };

// Bulk check — preferred in server components that gate many UI bits.
const perms = await getCurrentUserPermissions();
const canEdit = perms.has('crm_leads:edit');

// Portal entry gate.
if (!(await hasPortalAccess())) redirect('/dashboard');
```

## Where it's wired today

The wiring is **deliberately surgical** — we add the helper, demonstrate
it in 3-5 places, and document the pattern. Extending it to every page
is a follow-up.

| Location                                                     | Check                           | Effect                                   |
| ------------------------------------------------------------ | ------------------------------- | ---------------------------------------- |
| `src/app/dashboard/hrm/portal/layout.tsx`                    | `hasPortalAccess()`             | Redirects to `/dashboard` on denial.     |
| `src/app/actions/crm-tasks.actions.ts` → `bulkCrmTaskAction` | `hasPermissionGroup('crm_tasks','delete')`   | Bulk-delete is gated.                    |
| `src/app/actions/crm-leads.actions.ts` → bulk delete         | `hasPermissionGroup('crm_leads','delete')`   | Bulk-delete is gated.                    |
| `src/components/crm/assignment-control.tsx`                  | (future)                        | Hide picker when `…:edit` is false.      |

## How to extend

1. Pick a `module` key matching one of the HRM permission-group module
   keys (these are `crm_*` collection names by convention).
2. Decide on the gating point: server action, route handler, server
   component, or layout. Prefer server actions for mutations.
3. Call `hasPermissionGroup(module, action)` early. On `false`, return
   the standard `{ ok: false, error: 'Not allowed.' }` shape — matching
   `crm-assignment.actions.ts`.
4. Do **not** call this in tight loops. The helper hits Mongo three
   times; for many-call paths, hoist the resolved `Set` from
   `getCurrentUserPermissions()` once and call `.has()` on it.

## What this does NOT do

- It does **not** replace `requirePermission()` from
  `@/lib/rbac-server`. That gates tenant-scoped feature access
  (plan limits, billing, etc.). Permission groups are a *second layer*
  for tenant-internal RBAC.
- It does **not** propagate to the Rust BFF. Rust-side calls still
  enforce their own `requirePermission`. If you need defense-in-depth
  in Rust, mirror the check there.
- It does **not** version-track changes. Group edits take effect on
  the next request — no caching, no propagation delay.

## See also

- `src/app/actions/hrm-permission-groups.actions.ts` — CRUD + admin UI
- `src/app/dashboard/hrm/permission-groups/` — admin pages
