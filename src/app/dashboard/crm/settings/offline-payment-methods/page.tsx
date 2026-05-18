'use client';

import { ZoruBadge } from '@/components/zoruui';
import {
  Wallet } from 'lucide-react';

import { HrEntityPage } from '../../_components/hr-entity-page';

import {
  getOfflinePaymentMethods,
  saveOfflinePaymentMethod,
  deleteOfflinePaymentMethod,
} from '@/app/actions/worksuite/payments.actions';
import type { WsOfflinePaymentMethod } from '@/lib/worksuite/payments-types';

type Row = Omit<WsOfflinePaymentMethod, '_id' | 'userId'> & {
  _id: string;
  [k: string]: any;
};

export default function OfflinePaymentMethodsPage() {
  return (
    <HrEntityPage<Row>
      title="Offline Payment Methods"
      subtitle="Cash, cheque, UPI, bank transfer and other non-gateway methods."
      icon={Wallet}
      singular="Method"
      emptyText="No offline methods yet — click Add to create your first one."
      getAllAction={async () => {
        const rows = await getOfflinePaymentMethods();
        return rows as unknown as Row[];
      }}
      saveAction={saveOfflinePaymentMethod}
      deleteAction={deleteOfflinePaymentMethod}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        {
          key: 'is_active',
          label: 'Status',
          render: (row) => (
            <ZoruBadge variant={row.is_active ? 'success' : 'ghost'}>
              {row.is_active ? 'active' : 'inactive'}
            </ZoruBadge>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
        {
          name: 'is_active',
          label: 'Status',
          type: 'select',
          defaultValue: 'true',
          options: [
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ],
        },
      ]}
    />
  );
}
