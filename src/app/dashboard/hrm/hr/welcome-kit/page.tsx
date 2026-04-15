'use client';

import { Heart } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getWelcomeKits,
  saveWelcomeKit,
  deleteWelcomeKit,
} from '@/app/actions/hr.actions';
import type { HrWelcomeKit } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'amber' | 'green'> = {
  pending: 'amber',
  sent: 'green',
};

export default function WelcomeKitPage() {
  return (
    <HrEntityPage<HrWelcomeKit & { _id: string }>
      title="Welcome Kits"
      subtitle="Curate swag, docs, and thoughtful first-day items."
      icon={Heart}
      singular="Kit"
      basePath="/dashboard/hrm/hr/welcome-kit"
      getAllAction={getWelcomeKits as any}
      saveAction={saveWelcomeKit}
      deleteAction={deleteWelcomeKit}
      columns={[
        { key: 'employee_id', label: 'Employee ID' },
        { key: 'name', label: 'Kit Name' },
        {
          key: 'items',
          label: 'Items',
          render: (row) =>
            Array.isArray(row.items) ? `${row.items.length} item(s)` : '0',
        },
        {
          key: 'sent_date',
          label: 'Sent Date',
          render: (row) => {
            const d = (row as any).sent_date;
            return d ? new Date(d).toLocaleDateString() : '—';
          },
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => {
            const v = (row as any).status || 'pending';
            return (
              <ClayBadge tone={STATUS_TONES[v] || 'amber'} dot>
                {v}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={fields}
    />
  );
}
