/**
 * SabCRM — Form submissions (`/sabcrm/forms/[formId]/submissions`), 20ui.
 *
 * Server entry: loads the form (for the field/column plan) and its
 * submissions through the gated actions (`getSabcrmForm` +
 * `listSabcrmFormSubmissions`), narrows both into flat serializable
 * shapes, and renders the client table with per-row "Convert to lead"
 * and bulk CSV export.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`; the Rust engine being down renders as an inline error.
 */

import * as React from 'react';

import {
  getSabcrmForm,
  listSabcrmFormSubmissions,
} from '@/app/actions/sabcrm-forms.actions';
import type { SabcrmFormSubmissionRow } from '@/app/actions/sabcrm-forms.actions.types';
import { SubmissionsClient, type SubmissionColumn } from './submissions-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Submissions — SabCRM Forms',
};

/** Stringify a submitted value for table display. */
function displayValue(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
}

export default async function SabcrmFormSubmissionsPage(props: {
  params: Promise<{ formId: string }>;
}): Promise<React.JSX.Element> {
  const { formId } = await props.params;

  const [formRes, subsRes] = await Promise.all([
    getSabcrmForm(formId),
    listSabcrmFormSubmissions(formId),
  ]);

  const error = !formRes.ok
    ? formRes.error
    : !subsRes.ok
      ? subsRes.error
      : null;

  const columns: SubmissionColumn[] = formRes.ok
    ? (formRes.data.fields ?? []).map((f) => ({
        key: f.name,
        label: f.label || f.name,
      }))
    : [];

  const targetObject = formRes.ok
    ? formRes.data.settings?.targetObject?.trim() || 'leads'
    : 'leads';

  const rows: SabcrmFormSubmissionRow[] = subsRes.ok
    ? subsRes.data.map((doc) => ({
        id: doc._id,
        values: Object.fromEntries(
          Object.entries(doc.data ?? {}).map(([k, v]) => [k, displayValue(v)]),
        ),
        status: doc.status ?? 'new',
        createdAt: doc.createdAt,
        sourceUrl: doc.sourceUrl ?? '',
      }))
    : [];

  return (
    <SubmissionsClient
      formId={formId}
      formName={formRes.ok ? formRes.data.name : 'Form'}
      targetObject={targetObject}
      columns={columns}
      initialRows={rows}
      initialError={error}
    />
  );
}
