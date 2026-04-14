'use client';

import { ShieldCheck } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getProbations,
  saveProbation,
  deleteProbation,
} from '@/app/actions/hr.actions';
import type { HrProbation } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  active: 'amber',
  passed: 'green',
  extended: 'amber',
  terminated: 'red',
};

export default function ProbationPage() {
  return (
    <HrEntityPage<HrProbation & { _id: string }>
      title="Probation"
      subtitle="Track probation periods, reviewers, and outcomes."
      icon={ShieldCheck}
      singular="Probation"
      basePath="/dashboard/crm/hr/probation"
      getAllAction={getProbations as any}
      saveAction={saveProbation}
      deleteAction={deleteProbation}
      columns={[
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => {
            const id = row.employeeId ? String(row.employeeId) : '';
            return id ? (
              <span className="font-mono text-[12px]">
                {id.length > 10 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id}
              </span>
            ) : (
              <span className="text-clay-ink-muted">—</span>
            );
          },
        },
        { key: 'reviewerName', label: 'Reviewer' },
        {
          key: 'startDate',
          label: 'Start',
          render: (row) =>
            row.startDate ? new Date(row.startDate).toLocaleDateString() : '—',
        },
        {
          key: 'endDate',
          label: 'End',
          render: (row) =>
            row.endDate ? new Date(row.endDate).toLocaleDateString() : '—',
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
              {row.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={fields}
    />
  );
}
