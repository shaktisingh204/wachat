import 'server-only';

import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getCachedSession } from '@/lib/server-cache';

/**
 * SabBI active-tenant resolution.
 *
 * SabBI is a general `/dashboard` analytics tool (not a kind-specific project
 * module like SabChat/SabSMS), so it scopes to the user's **shared active
 * project** — `session.user.activeProjectId`, the same tenant key
 * `rbac-server.ts` and `crm/access-scope.ts` use for the general dashboard.
 *
 * The id is forwarded to Rust as the JWT `tid` claim via {@link runWithRustTenant};
 * every `sabbi-*` crate filters its collections by `tenant_id` (the JWT `tid`),
 * so all BI artefacts (datasets, charts, workbooks, joins, schedules, embeds)
 * isolate per workspace.
 *
 * Fallback: when no active project is resolvable we return the acting user's
 * own id, which makes `runWithRustTenant` a no-op equivalent (the fetcher
 * already defaults `tid` to the user id) — i.e. legacy single-tenant-per-user
 * behaviour, so nothing breaks before a project is selected.
 */
export async function getSabbiWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const user = session?.user as
    | { _id?: unknown; activeProjectId?: unknown }
    | undefined;

  const active = user?.activeProjectId;
  if (active && typeof active === 'string' && active.length > 0) return active;

  const uid = user?._id;
  return uid ? String(uid) : null;
}

/**
 * Run `fn` with every nested Rust call scoped to the active SabBI workspace.
 * Wrap every SabBI server action body in this so the `sabbi-*` crates isolate
 * data per project. A no-op (still runs `fn`) when no tenant is resolvable.
 */
export async function runWithSabbiTenant<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabbiWorkspaceId();
  if (!wsId) return fn();
  return runWithRustTenant(wsId, fn);
}
