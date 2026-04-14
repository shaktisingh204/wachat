'use client';

import { Radio } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getLeadSources,
  saveLeadSource,
  deleteLeadSource,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadSource } from '@/lib/worksuite/crm-types';

export default function LeadSourcesPage() {
  return (
    <HrEntityPage<WsLeadSource & { _id: string }>
      title="Lead Sources"
      subtitle="Track where your leads come from (e.g. website, referral, ads)."
      icon={Radio}
      singular="Source"
      getAllAction={getLeadSources as any}
      saveAction={saveLeadSource}
      deleteAction={deleteLeadSource}
      columns={[
        { key: 'type', label: 'Source' },
        {
          key: 'color',
          label: 'Color',
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
                  {color}
                </ClayBadge>
              </span>
            );
          },
        },
      ]}
      fields={[
        { name: 'type', label: 'Source Name', required: true, fullWidth: true },
        {
          name: 'color',
          label: 'Color (hex)',
          placeholder: '#64748b',
          defaultValue: '#64748b',
        },
      ]}
    />
  );
}
