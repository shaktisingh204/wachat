/**
 * SabCRM — Forms (`/sabcrm/forms`), 20ui.
 *
 * Server entry for the Sales suite's web-to-lead forms: lists the active
 * project's forms through the gated `listSabcrmForms` action (full
 * session → project → RBAC → plan pipeline, then the project-scoped Rust
 * mount `/v1/sabcrm/forms`).
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`. The Rust engine may be down at dev time — the action
 * normalises that into `{ ok: false, error }`, which renders as an inline
 * error state instead of crashing the route.
 *
 * Documents are narrowed to the flat row shape the client component
 * renders, so the `server-only` rust-client types never enter the client
 * bundle. The FULL builder payload for editing is re-fetched on demand
 * via `getSabcrmForm` from the client.
 */

import * as React from 'react';

import { listSabcrmForms } from '@/app/actions/sabcrm-forms.actions';
import type { SabcrmFormRow } from '@/app/actions/sabcrm-forms.actions.types';
import { FormsClient } from './forms-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Forms — SabCRM',
};

export default async function SabcrmFormsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmForms();

  const rows: SabcrmFormRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        name: doc.name,
        description:
          typeof doc.settings?.description === 'string'
            ? doc.settings.description
            : '',
        status: doc.status ?? 'draft',
        submissionCount: doc.submissionCount ?? 0,
        publicId: doc.slug || doc._id,
        fieldCount: doc.fields?.length ?? 0,
        createdAt: doc.createdAt,
      }))
    : [];

  return (
    <FormsClient initialRows={rows} initialError={res.ok ? null : res.error} />
  );
}
