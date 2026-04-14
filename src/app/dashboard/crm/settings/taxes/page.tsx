'use client';

import { Percent } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getTaxes,
  saveTax,
  deleteTax,
} from '@/app/actions/worksuite/meta.actions';
import type { WsTax } from '@/lib/worksuite/meta-types';

/**
 * Tax settings — maintain named tax codes with a percentage rate.
 * Mirrors Worksuite's `/tax-settings` screen.
 */
export default function TaxesPage() {
  return (
    <HrEntityPage<WsTax & { _id: string }>
      title="Taxes"
      subtitle="Tax codes and rates applied across invoices, estimates, and orders."
      icon={Percent}
      singular="Tax"
      getAllAction={getTaxes as any}
      saveAction={saveTax}
      deleteAction={deleteTax}
      columns={[
        { key: 'tax_name', label: 'Name' },
        {
          key: 'rate_percent',
          label: 'Rate',
          render: (row) => `${Number(row.rate_percent ?? 0)}%`,
        },
        {
          key: 'is_default',
          label: 'Default',
          render: (row) => (
            <ClayBadge tone={row.is_default ? 'green' : 'neutral'}>
              {row.is_default ? 'Yes' : 'No'}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'tax_name', label: 'Tax name', required: true },
        {
          name: 'rate_percent',
          label: 'Rate (%)',
          type: 'number',
          required: true,
          placeholder: '18',
        },
        {
          name: 'is_default',
          label: 'Default',
          type: 'select',
          options: [
            { value: 'false', label: 'No' },
            { value: 'true', label: 'Yes' },
          ],
          defaultValue: 'false',
        },
      ]}
    />
  );
}
