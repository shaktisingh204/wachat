'use client';

import { Layers } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getAssetAssignments,
  saveAssetAssignment,
  deleteAssetAssignment,
} from '@/app/actions/hr.actions';
import type { HrAssetAssignment } from '@/lib/hr-types';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  assigned: 'amber',
  returned: 'green',
};

function formatDate(value: unknown): React.ReactNode {
  if (!value) return <span className="text-clay-ink-muted">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-clay-ink-muted">—</span>;
  return d.toISOString().slice(0, 10);
}

export default function AssetAssignmentsPage() {
  return (
    <HrEntityPage<HrAssetAssignment & { _id: string }>
      title="Asset Assignments"
      subtitle="Track which asset is issued to which employee."
      icon={Layers}
      singular="Assignment"
      getAllAction={getAssetAssignments as any}
      saveAction={saveAssetAssignment}
      deleteAction={deleteAssetAssignment}
      columns={[
        {
          key: 'assetId',
          label: 'Asset',
          render: (row) => (
            <span className="block max-w-[160px] truncate">{row.assetId ? String(row.assetId) : '—'}</span>
          ),
        },
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[160px] truncate">{row.employeeId ? String(row.employeeId) : '—'}</span>
          ),
        },
        {
          key: 'assignedAt',
          label: 'Assigned',
          render: (row) => formatDate(row.assignedAt),
        },
        {
          key: 'returnedAt',
          label: 'Returned',
          render: (row) => formatDate(row.returnedAt),
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
        { name: 'assetId', label: 'Asset ID', required: true },
        { name: 'employeeId', label: 'Employee ID', required: true },
        { name: 'assignedAt', label: 'Assigned At', type: 'date', required: true },
        { name: 'returnedAt', label: 'Returned At', type: 'date' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'assigned', label: 'Assigned' },
            { value: 'returned', label: 'Returned' },
          ],
          defaultValue: 'assigned',
        },
        { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
