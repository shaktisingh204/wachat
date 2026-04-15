'use client';

import { Flag } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../_components/hr-entity-page';
import {
  getLeadStatuses,
  saveLeadStatus,
  deleteLeadStatus,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadStatus } from '@/lib/worksuite/crm-types';

export default function LeadStatusesPage() {
  return (
    <HrEntityPage<WsLeadStatus & { _id: string }>
      title="Lead Statuses"
      subtitle="Define the funnel stages a lead can move through."
      icon={Flag}
      singular="Status"
      getAllAction={getLeadStatuses as any}
      saveAction={saveLeadStatus}
      deleteAction={deleteLeadStatus}
      columns={[
        {
          key: 'type',
          label: 'Status',
          render: (row) => {
            const color = row.color || '#64748b';
            return (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-clay-border"
                  style={{ backgroundColor: color }}
                />
                <ClayBadge
                  tone="neutral"
                  style={{
                    backgroundColor: color + '20',
                    color,
                    borderColor: color + '40',
                  }}
                >
                  {row.type}
                </ClayBadge>
              </span>
            );
          },
        },
        { key: 'color', label: 'Hex', render: (row) => row.color || '—' },
        { key: 'priority', label: 'Priority' },
        {
          key: 'default',
          label: 'Default',
          render: (row) => {
            const isDefault =
              row.default === true ||
              (row.default as unknown as string) === 'true' ||
              (row.default as unknown as string) === 'yes';
            return (
              <ClayBadge tone={isDefault ? 'amber' : 'neutral'}>
                {isDefault ? 'Yes' : 'No'}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={[
        { name: 'type', label: 'Status Name', required: true },
        {
          name: 'color',
          label: 'Color (hex)',
          placeholder: '#64748b',
          defaultValue: '#64748b',
        },
        { name: 'priority', label: 'Priority', type: 'number', defaultValue: '0' },
        {
          name: 'default',
          label: 'Default Status',
          type: 'select',
          options: [
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ],
          defaultValue: 'no',
        },
      ]}
    />
  );
}
