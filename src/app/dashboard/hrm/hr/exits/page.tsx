'use client';

import { LogOut } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getExits,
  saveExit,
  deleteExit,
} from '@/app/actions/hr.actions';
import type { HrExit } from '@/lib/hr-types';

const REASON_TONES: Record<string, 'neutral' | 'amber' | 'red' | 'rose-soft'> = {
  resignation: 'amber',
  termination: 'red',
  retirement: 'neutral',
  'contract-end': 'rose-soft',
};

const CLEARANCE_TONES: Record<string, 'amber' | 'green'> = {
  pending: 'amber',
  cleared: 'green',
};

const FNF_TONES: Record<string, 'amber' | 'green'> = {
  pending: 'amber',
  processed: 'green',
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
          key: 'reason',
          label: 'Reason',
          render: (row) => (
            <ClayBadge tone={REASON_TONES[(row as any).reason] || 'neutral'}>
              {(row as any).reason || '—'}
            </ClayBadge>
          ),
        },
        {
          key: 'exit_date',
          label: 'Exit Date',
          render: (row) => {
            const d = (row as any).exit_date;
            return d ? new Date(d).toLocaleDateString() : '—';
          },
        },
        {
          key: 'clearance_status',
          label: 'Clearance',
          render: (row) => {
            const v = (row as any).clearance_status || 'pending';
            return (
              <ClayBadge tone={CLEARANCE_TONES[v] || 'amber'} dot>
                {v}
              </ClayBadge>
            );
          },
        },
        {
          key: 'fnf_status',
          label: 'FnF',
          render: (row) => {
            const v = (row as any).fnf_status || 'pending';
            return (
              <ClayBadge tone={FNF_TONES[v] || 'amber'} dot>
                {v}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={[
        { name: 'employeeId', label: 'Employee ID', required: true },
        { name: 'exit_date', label: 'Exit Date', type: 'date', required: true },
        {
          name: 'reason',
          label: 'Reason',
          type: 'select',
          required: true,
          options: [
            { value: 'resignation', label: 'Resignation' },
            { value: 'termination', label: 'Termination' },
            { value: 'retirement', label: 'Retirement' },
            { value: 'contract-end', label: 'Contract End' },
          ],
          defaultValue: 'resignation',
        },
        {
          name: 'exit_interview_date',
          label: 'Exit Interview Date',
          type: 'date',
        },
        {
          name: 'clearance_status',
          label: 'Clearance Status',
          type: 'select',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'cleared', label: 'Cleared' },
          ],
          defaultValue: 'pending',
        },
        {
          name: 'fnf_status',
          label: 'FnF Status',
          type: 'select',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'processed', label: 'Processed' },
          ],
          defaultValue: 'pending',
        },
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
