'use client';

import * as React from 'react';
import { Package } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import { getAssets, saveAsset, deleteAsset } from '@/app/actions/hr.actions';
import type { HrAsset } from '@/lib/hr-types';
import { fields } from './_config';

const CONDITION_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  new: 'green',
  good: 'green',
  fair: 'amber',
  poor: 'red',
  retired: 'neutral',
};

function formatDate(value: unknown): React.ReactNode {
  if (!value) return <span className="text-clay-ink-muted">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-clay-ink-muted">—</span>;
  return d.toISOString().slice(0, 10);
}

function formatCurrency(value: unknown, currency?: string): React.ReactNode {
  if (!value) return <span className="text-clay-ink-muted">—</span>;
  const n = Number(value);
  if (isNaN(n)) return <span className="text-clay-ink-muted">—</span>;
  return `${currency || 'INR'} ${n.toLocaleString()}`;
}

export default function AssetsPage() {
  return (
    <HrEntityPage<HrAsset & { _id: string }>
      title="Assets"
      subtitle="Company-owned assets tracked by HR."
      icon={Package}
      singular="Asset"
      basePath="/dashboard/hrm/hr/assets"
      getAllAction={getAssets as any}
      saveAction={saveAsset}
      deleteAction={deleteAsset}
      columns={[
        { key: 'name', label: 'Asset Name' },
        { key: 'category', label: 'Type' },
        { key: 'serialNumber', label: 'Serial #' },
        { key: 'assetTag', label: 'Asset Tag' },
        {
          key: 'purchaseDate',
          label: 'Purchased',
          render: (row) => formatDate(row.purchaseDate),
        },
        {
          key: 'purchaseCost',
          label: 'Purchase Price',
          render: (row) => formatCurrency(row.purchaseCost, row.currency),
        },
        {
          key: 'warrantyExpiresAt',
          label: 'Warranty Until',
          render: (row) => formatDate(row.warrantyExpiresAt),
        },
        { key: 'location', label: 'Location' },
        {
          key: 'condition',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={CONDITION_TONES[(row.condition as string) || ''] || 'neutral'} dot>
              {row.condition || '—'}
            </ClayBadge>
          ),
        },
      ]}
      fields={fields}
    />
  );
}
