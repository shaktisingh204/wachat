'use client';

import { RefreshCcw } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getContractRenewals,
  saveContractRenewal,
  deleteContractRenewal,
} from '@/app/actions/worksuite/contracts-ext.actions';
import type { WsContractRenew } from '@/lib/worksuite/contracts-ext-types';

export default function ContractRenewalsPage() {
  return (
    <HrEntityPage<WsContractRenew & { _id: string }>
      title="Contract Renewals"
      subtitle="Track renewed contract periods and updated values."
      icon={RefreshCcw}
      singular="Renewal"
      getAllAction={getContractRenewals as any}
      saveAction={saveContractRenewal}
      deleteAction={deleteContractRenewal}
      columns={[
        { key: 'contract_id', label: 'Contract' },
        {
          key: 'from_date',
          label: 'From',
          render: (r) => (r.from_date ? new Date(r.from_date).toLocaleDateString() : '—'),
        },
        {
          key: 'to_date',
          label: 'To',
          render: (r) => (r.to_date ? new Date(r.to_date).toLocaleDateString() : '—'),
        },
        { key: 'new_value', label: 'New Value' },
      ]}
      fields={[
        { name: 'contract_id', label: 'Contract ID', required: true, fullWidth: true },
        { name: 'from_date', label: 'From Date', type: 'date' },
        { name: 'to_date', label: 'To Date', type: 'date' },
        { name: 'new_value', label: 'New Value', type: 'number' },
      ]}
    />
  );
}
