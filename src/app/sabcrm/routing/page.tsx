/**
 * SabCRM — Assignment routing (`/sabcrm/routing`), 20ui.
 *
 * Server entry for the Sales suite's assignment rules: lists the active
 * project's routing rules through the gated `listSabcrmRoutingRules` action
 * (full session → project → RBAC → plan pipeline, then the project-scoped
 * Rust mount `/v1/sabcrm/routing`).
 *
 * The editor needs two catalogues, fetched in parallel and narrowed to flat
 * client shapes (the `server-only` rust-client values never enter the client
 * bundle):
 *   - workspace members (`listMembersAction`) → assignees multi-select;
 *   - CRM objects + fields (`listObjectsTw`, system objects excluded) →
 *     object Select + per-object condition-field Select.
 * Both are best-effort: a failure degrades the editor (empty Select) rather
 * than failing the page.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`. The Rust engine may be down at dev time — the action
 * normalises that into `{ ok: false, error }`, which renders as an inline
 * error state instead of crashing the route.
 */

import * as React from 'react';

import { listMembersAction } from '@/app/actions/sabcrm.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import { listSabcrmRoutingRules } from '@/app/actions/sabcrm-routing.actions';
import {
  RoutingClient,
  type RoutingMemberOption,
  type RoutingObjectOption,
} from './routing-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Routing — SabCRM',
};

export default async function SabcrmRoutingPage(): Promise<React.JSX.Element> {
  const [rulesRes, membersRes, objectsRes] = await Promise.all([
    listSabcrmRoutingRules(),
    listMembersAction(),
    listObjectsTw(),
  ]);

  // Defensive: the engine returns rules `position` asc already.
  const rules = rulesRes.ok
    ? [...rulesRes.data].sort((a, b) => a.position - b.position)
    : [];

  // Best-effort: the editor degrades gracefully without members/objects.
  const members: RoutingMemberOption[] = membersRes.ok
    ? membersRes.data.map((m) => ({
        userId: m.userId,
        label: m.name || m.email,
      }))
    : [];

  const objects: RoutingObjectOption[] = objectsRes.ok
    ? objectsRes.data
        .filter((o) => !o.isSystem)
        .map((o) => ({
          slug: o.slug,
          label: o.labelPlural || o.slug,
          fields: (o.fields ?? []).map((f) => ({
            key: f.key,
            label: f.label || f.key,
          })),
        }))
    : [];

  return (
    <RoutingClient
      initialRules={rules}
      members={members}
      objects={objects}
      initialError={rulesRes.ok ? null : rulesRes.error}
    />
  );
}
