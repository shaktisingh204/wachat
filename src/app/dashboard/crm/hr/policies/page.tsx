'use client';

import { FileText } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
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
      basePath="/dashboard/crm/hr/policies"
      getAllAction={getPolicies as any}
      saveAction={savePolicy}
      deleteAction={deletePolicy}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'category', label: 'Category' },
        { key: 'version', label: 'Version' },
        {
          key: 'effectiveDate',
          label: 'Effective Date',
          render: (row) => <span>{formatDate(row.effectiveDate)}</span>,
        },
      ]}
      fields={fields}
    />
  );
}
