'use client';

import { BadgePercent } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getPromotionsExt,
  savePromotionExt,
  deletePromotionExt,
} from '@/app/actions/worksuite/meta.actions';
import type { WsPromotionExt } from '@/lib/worksuite/meta-types';

function formatDate(v: unknown) {
  if (!v) return '—';
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/** Lightweight promotion code management. */
export default function PromotionsPage() {
  return (
    <HrEntityPage<WsPromotionExt & { _id: string }>
      title="Promotions"
      subtitle="Promo codes for percentage or fixed-amount discounts."
      icon={BadgePercent}
      singular="Promotion"
      getAllAction={getPromotionsExt as any}
      saveAction={savePromotionExt}
      deleteAction={deletePromotionExt}
      columns={[
        { key: 'name', label: 'Name' },
        {
          key: 'code',
          label: 'Code',
          render: (row) => (
            <ClayBadge tone="obsidian">{String(row.code || '')}</ClayBadge>
          ),
        },
        {
          key: 'type',
          label: 'Type',
          render: (row) =>
            row.type === 'percent' ? `${row.value}%` : `${row.value}`,
        },
        {
          key: 'start_date',
          label: 'Start',
          render: (row) => formatDate(row.start_date),
        },
        {
          key: 'end_date',
          label: 'End',
          render: (row) => formatDate(row.end_date),
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={row.status === 'active' ? 'green' : 'neutral'}>
              {row.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code', required: true, placeholder: 'SUMMER25' },
        {
          name: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          options: [
            { value: 'percent', label: 'Percent' },
            { value: 'fixed', label: 'Fixed amount' },
          ],
          defaultValue: 'percent',
        },
        { name: 'value', label: 'Value', type: 'number', required: true },
        { name: 'start_date', label: 'Start date', type: 'date' },
        { name: 'end_date', label: 'End date', type: 'date' },
        { name: 'usage_limit', label: 'Usage limit', type: 'number' },
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
      ]}
    />
  );
}
