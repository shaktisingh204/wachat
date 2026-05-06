'use client';
import { ZoruBadge, ZoruButton } from '@/components/zoruui';
import { Award } from 'lucide-react';
import Link from 'next/link';
import { HrEntityPage } from '../../_components/hr-entity-page';

import {
  getAwards,
  saveAward,
  deleteAward,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsAward } from '@/lib/worksuite/knowledge-types';

export default function AwardsPage() {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex justify-end">
        <Link href="/dashboard/crm/workspace/awards/appreciations">
          <ZoruButton variant="outline">View Appreciations</ZoruButton>
        </Link>
      </div>
      <HrEntityPage<WsAward & { _id: string }>
        title="Awards"
        subtitle="Define awards that recognise outstanding contributions."
        icon={Award}
        singular="Award"
        getAllAction={getAwards as any}
        saveAction={saveAward}
        deleteAction={deleteAward}
        columns={[
          {
            key: 'icon',
            label: 'Icon',
            render: (row) => <span className="text-[18px]">{row.icon || '🏆'}</span>,
          },
          { key: 'title', label: 'Title' },
          {
            key: 'frequency',
            label: 'Frequency',
            render: (row) => <ZoruBadge variant="warning">{row.frequency}</ZoruBadge>,
          },
        ]}
        fields={[
          { name: 'title', label: 'Title', required: true, fullWidth: true },
          { name: 'summary', label: 'Summary', type: 'textarea', fullWidth: true },
          { name: 'icon', label: 'Icon (emoji)', placeholder: '🏆', defaultValue: '🏆' },
          {
            name: 'frequency',
            label: 'Frequency',
            type: 'select',
            options: [
              { value: 'one-time', label: 'One-time' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'annual', label: 'Annual' },
            ],
            defaultValue: 'one-time',
          },
        ]}
      />
    </div>
  );
}
