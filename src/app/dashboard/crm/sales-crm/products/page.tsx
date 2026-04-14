'use client';

import { Package } from 'lucide-react';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getLeadProducts,
  saveLeadProduct,
  deleteLeadProduct,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadProduct } from '@/lib/worksuite/crm-types';

export default function LeadProductsPage() {
  return (
    <HrEntityPage<WsLeadProduct & { _id: string }>
      title="Lead Products"
      subtitle="Line items linking leads to the products they're interested in."
      icon={Package}
      singular="Line Item"
      getAllAction={getLeadProducts as any}
      saveAction={saveLeadProduct}
      deleteAction={deleteLeadProduct}
      columns={[
        { key: 'lead_id', label: 'Lead' },
        { key: 'product_id', label: 'Product' },
        { key: 'quantity', label: 'Qty' },
        {
          key: 'price',
          label: 'Price',
          render: (row) => `₹${Number(row.price || 0).toFixed(2)}`,
        },
        {
          key: 'total',
          label: 'Total',
          render: (row) => {
            const total =
              Number(row.total) ||
              Number(row.quantity || 0) * Number(row.price || 0);
            return `₹${total.toFixed(2)}`;
          },
        },
      ]}
      fields={[
        {
          name: 'lead_id',
          label: 'Lead ID',
          required: true,
          placeholder: 'Mongo ObjectId of the lead',
        },
        {
          name: 'product_id',
          label: 'Product ID',
          required: true,
          placeholder: 'Mongo ObjectId of the product',
        },
        { name: 'quantity', label: 'Quantity', type: 'number', required: true },
        { name: 'price', label: 'Price', type: 'number', required: true },
        { name: 'total', label: 'Total', type: 'number' },
      ]}
    />
  );
}
