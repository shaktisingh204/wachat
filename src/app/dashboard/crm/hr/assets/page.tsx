'use client';

import { Package } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import { getAssets, saveAsset, deleteAsset } from '@/app/actions/hr.actions';
import type { HrAsset } from '@/lib/hr-types';

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

export default function AssetsPage() {
  return (
    <HrEntityPage<HrAsset & { _id: string }>
      title="Assets"
      subtitle="Company-owned assets tracked by HR."
      icon={Package}
      singular="Asset"
      getAllAction={getAssets as any}
      saveAction={saveAsset}
      deleteAction={deleteAsset}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
        { key: 'serialNumber', label: 'Serial #' },
        {
          key: 'purchaseDate',
          label: 'Purchased',
          render: (row) => formatDate(row.purchaseDate),
        },
        {
          key: 'condition',
          label: 'Condition',
          render: (row) => (
            <ClayBadge tone={CONDITION_TONES[(row.condition as string) || ''] || 'neutral'} dot>
              {row.condition || '—'}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, fullWidth: true },
        { name: 'category', label: 'Category' },
        { name: 'serialNumber', label: 'Serial Number' },
        { name: 'purchaseDate', label: 'Purchase Date', type: 'date' },
        {
          name: 'condition',
          label: 'Condition',
          type: 'select',
          options: [
            { value: 'new', label: 'New' },
            { value: 'good', label: 'Good' },
            { value: 'fair', label: 'Fair' },
            { value: 'poor', label: 'Poor' },
            { value: 'retired', label: 'Retired' },
          ],
          defaultValue: 'good',
        },
        { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
