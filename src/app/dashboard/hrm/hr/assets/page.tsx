'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

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
  if (!value) return <span className="text-muted-foreground">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-muted-foreground">—</span>;
  return d.toISOString().slice(0, 10);
}

function formatCurrency(value: unknown, currency?: string): React.ReactNode {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const n = Number(value);
  if (isNaN(n)) return <span className="text-muted-foreground">—</span>;
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
      rowLinksToDetail
      getAllAction={getAssets as any}
      saveAction={saveAsset}
      deleteAction={deleteAsset}
      kpis={[
        {
          label: 'Total assets',
          compute: (rows) => rows.length,
        },
        {
          label: 'Assigned',
          compute: (rows) =>
            rows.filter((r) => Boolean((r as any).assignedTo || (r as any).custodian))
              .length,
          tone: 'blue',
        },
        {
          label: 'Available',
          compute: (rows) =>
            rows.filter((r) => !((r as any).assignedTo || (r as any).custodian)).length,
          tone: 'green',
        },
        {
          label: 'In good condition',
          compute: (rows) =>
            rows.filter((r) => {
              const c = String((r as any).condition || '').toLowerCase();
              return c === 'new' || c === 'good';
            }).length,
        },
        {
          label: 'Total value',
          compute: (rows) => {
            const total = rows.reduce(
              (acc, r) => acc + (Number((r as any).purchaseCost) || 0),
              0,
            );
            if (!total) return '—';
            return new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0,
            }).format(total);
          },
        },
      ]}
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
