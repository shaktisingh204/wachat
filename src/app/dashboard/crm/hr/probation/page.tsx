'use client';

import { ShieldCheck } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getProbations,
  saveProbation,
  deleteProbation,
} from '@/app/actions/hr.actions';
import type { HrProbation } from '@/lib/hr-types';

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
      fields={[
        { name: 'employeeId', label: 'Employee ID' },
        { name: 'startDate', label: 'Start Date', type: 'date', required: true },
        { name: 'endDate', label: 'End Date', type: 'date', required: true },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { value: 'active', label: 'Active' },
            { value: 'passed', label: 'Passed' },
            { value: 'extended', label: 'Extended' },
            { value: 'terminated', label: 'Terminated' },
          ],
          defaultValue: 'active',
        },
        { name: 'reviewerName', label: 'Reviewer Name' },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}
