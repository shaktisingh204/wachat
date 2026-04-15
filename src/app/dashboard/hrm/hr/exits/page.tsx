'use client';

import { LogOut } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getExits,
  saveExit,
  deleteExit,
} from '@/app/actions/hr.actions';
import type { HrExit } from '@/lib/hr-types';

const FNF_TONES: Record<string, 'amber' | 'green'> = {
  pending: 'amber',
  cleared: 'green',
};

export default function ExitsPage() {
  return (
    <HrEntityPage<HrExit & { _id: string }>
      title="Exits"
      subtitle="Offboarding, resignations, and full-and-final settlements."
      icon={LogOut}
      singular="Exit"
      getAllAction={getExits as any}
      saveAction={saveExit}
      deleteAction={deleteExit}
      columns={[
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[160px] truncate">{String(row.employeeId)}</span>
          ),
        },
        {
          key: 'exitType',
          label: 'Type',
          render: (row) => (
            <ClayBadge tone="rose-soft">{row.exitType}</ClayBadge>
          ),
        },
        {
          key: 'lastWorkingDate',
          label: 'Last Working Day',
          render: (row) =>
            row.lastWorkingDate
              ? new Date(row.lastWorkingDate).toLocaleDateString()
              : '—',
        },
        {
          key: 'fnfStatus',
          label: 'FnF',
          render: (row) => (
            <ClayBadge tone={FNF_TONES[row.fnfStatus || 'pending'] || 'amber'} dot>
              {row.fnfStatus}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'employeeId', label: 'Employee ID', required: true },
        {
          name: 'exitType',
          label: 'Exit Type',
          type: 'select',
          options: [
            { value: 'resignation', label: 'Resignation' },
            { value: 'termination', label: 'Termination' },
            { value: 'retirement', label: 'Retirement' },
            { value: 'contract-end', label: 'Contract End' },
          ],
          defaultValue: 'resignation',
        },
        { name: 'resignationDate', label: 'Resignation Date', type: 'date' },
        {
          name: 'lastWorkingDate',
          label: 'Last Working Date',
          type: 'date',
          required: true,
        },
        {
          name: 'reason',
          label: 'Reason',
          type: 'textarea',
          fullWidth: true,
        },
        {
          name: 'interviewNotes',
          label: 'Interview Notes',
          type: 'textarea',
          fullWidth: true,
        },
        { name: 'fnfAmount', label: 'FnF Amount', type: 'number' },
        {
          name: 'fnfStatus',
          label: 'FnF Status',
          type: 'select',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'cleared', label: 'Cleared' },
          ],
          defaultValue: 'pending',
        },
      ]}
    />
  );
}
