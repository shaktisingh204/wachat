'use client';

import { FileText } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getPolicies,
  savePolicy,
  deletePolicy,
} from '@/app/actions/hr.actions';
import type { HrPolicy } from '@/lib/hr-types';
import { fields } from './_config';

function formatDate(value: unknown) {
  if (!value) return '—';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

export default function PoliciesPage() {
  return (
    <HrEntityPage<HrPolicy & { _id: string }>
      title="Policies"
      subtitle="Company policies, handbooks, and versioned guidelines."
      icon={FileText}
      singular="Policy"
      basePath="/dashboard/hrm/hr/policies"
      getAllAction={getPolicies as any}
      saveAction={savePolicy}
      deleteAction={deletePolicy}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'category', label: 'Category' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => {
            const tone =
              row.status === 'active'
                ? 'green'
                : row.status === 'draft'
                  ? 'amber'
                  : 'neutral';
            return row.status ? (
              <ClayBadge tone={tone} dot>
                {row.status}
              </ClayBadge>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
        },
        {
          key: 'appliesTo',
          label: 'Applies To',
          render: (row) =>
            row.appliesTo ? (
              <ClayBadge tone="neutral">{row.appliesTo}</ClayBadge>
            ) : (
              <span className="text-muted-foreground">all</span>
            ),
        },
        { key: 'version', label: 'Version' },
        {
          key: 'effectiveDate',
          label: 'Effective Date',
          render: (row) => <span>{formatDate(row.effectiveDate)}</span>,
        },
        {
          key: 'attachmentUrl',
          label: 'Document',
          render: (row) =>
            row.attachmentUrl ? (
              <a
                href={String(row.attachmentUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-accent-foreground underline-offset-2 hover:underline"
              >
                View
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ]}
      fields={fields}
    />
  );
}
