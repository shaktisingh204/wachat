'use client';

import { FileText } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getPolicies,
  savePolicy,
  deletePolicy,
} from '@/app/actions/hr.actions';
import type { HrPolicy } from '@/lib/hr-types';

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
      fields={[
        { name: 'title', label: 'Title', required: true, fullWidth: true },
        { name: 'category', label: 'Category' },
        { name: 'version', label: 'Version' },
        { name: 'effectiveDate', label: 'Effective Date', type: 'date' },
        {
          name: 'body',
          label: 'Body',
          type: 'textarea',
          required: true,
          fullWidth: true,
        },
      ]}
    />
  );
}
