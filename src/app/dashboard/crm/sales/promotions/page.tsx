'use client';

import { ZoruBadge } from '@/components/zoruui';
import {
  Tag } from 'lucide-react';

import { HrEntityPage } from '../../_components/hr-entity-page';

import {
  getPromotions,
  savePromotion,
  deletePromotion,
} from '@/app/actions/worksuite/billing.actions';
import type { WsPromotion } from '@/lib/worksuite/billing-types';

type PromotionRow = Omit<WsPromotion, '_id' | 'userId' | 'applies_to_ids'> & {
  _id: string;
  [k: string]: any;
};

const STATUS_VARIANTS: Record<string, 'success' | 'ghost'> = {
  active: 'success',
  inactive: 'ghost',
};

const TYPE_VARIANTS: Record<string, 'info' | 'warning'> = {
  percent: 'info',
  fixed: 'warning',
};

export default function PromotionsPage() {
  return (
    <HrEntityPage<PromotionRow>
      title="Promotions"
      subtitle="Discount codes and promotional offers."
      icon={Tag}
      singular="Promotion"
      emptyText="No promotions yet — click Add to create your first one."
      getAllAction={async () => {
        const rows = await getPromotions();
        return rows as unknown as PromotionRow[];
      }}
      saveAction={savePromotion}
      deleteAction={deletePromotion}
      columns={[
        { key: 'code', label: 'Code' },
        {
          key: 'type',
          label: 'Type',
          render: (row) => (
            <ZoruBadge variant={TYPE_VARIANTS[row.type] || 'ghost'}>
              {row.type}
            </ZoruBadge>
          ),
        },
        {
          key: 'value',
          label: 'Value',
          render: (row) =>
            row.type === 'percent' ? `${row.value}%` : `${row.currency || ''} ${row.value}`,
        },
        {
          key: 'applies_to',
          label: 'Applies to',
          render: (row) => row.applies_to || 'all',
        },
        {
          key: 'usage_count',
          label: 'Used',
          render: (row) =>
            `${row.usage_count || 0}${row.usage_limit ? ` / ${row.usage_limit}` : ''}`,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ZoruBadge variant={STATUS_VARIANTS[row.status] || 'ghost'}>
              {row.status}
            </ZoruBadge>
          ),
        },
      ]}
      fields={[
        { name: 'code', label: 'Promo Code', required: true, placeholder: 'e.g. WELCOME10' },
        {
          name: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          options: [
            { value: 'percent', label: 'Percent' },
            { value: 'fixed', label: 'Fixed amount' },
          ],
        },
        { name: 'value', label: 'Value', type: 'number', required: true },
        { name: 'currency', label: 'Currency', placeholder: 'INR' },
        { name: 'start_date', label: 'Start Date', type: 'date' },
        { name: 'end_date', label: 'End Date', type: 'date' },
        { name: 'usage_limit', label: 'Usage Limit', type: 'number' },
        { name: 'per_customer_limit', label: 'Per-customer Limit', type: 'number' },
        { name: 'minimum_subtotal', label: 'Minimum Subtotal', type: 'number' },
        {
          name: 'applies_to',
          label: 'Applies To',
          type: 'select',
          options: [
            { value: 'all', label: 'All products' },
            { value: 'category', label: 'Specific category' },
            { value: 'product', label: 'Specific product' },
          ],
          defaultValue: 'all',
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
          defaultValue: 'active',
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}
