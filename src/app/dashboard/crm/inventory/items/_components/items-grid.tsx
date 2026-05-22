'use client';

import { Card } from '@/components/zoruui';
import { Package } from 'lucide-react';

/**
 * <ItemsGrid> — card-grid view for the items list. Designed for browsing
 * catalogues where thumbnails matter more than column alignment.
 */

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { ItemListRow } from './types';
import { isLowStock, isOutOfStock } from './types';

interface ItemsGridProps {
  items: ItemListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  filtersActive: boolean;
}

function fmtMoney(value: number | undefined, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function ItemsGrid({
  items,
  selected,
  onToggleRow,
  filtersActive,
}: ItemsGridProps) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-[13px] text-zoru-ink-muted">
        {filtersActive
          ? 'No items match the current filters.'
          : 'No items yet — click "New item" to add the first one.'}
      </div>
    );
  }
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const low = isLowStock(item);
        const out = isOutOfStock(item);
        const stockClass = out
          ? 'text-zoru-danger-ink'
          : low
            ? 'text-zoru-warning-ink'
            : 'text-zoru-ink';
        const status = item.status ?? 'active';
        return (
          <ZoruCard
            key={item._id}
            className="relative overflow-hidden p-0 transition hover:shadow-sm"
          >
            <div className="absolute left-2 top-2 z-10">
              <input
                type="checkbox"
                checked={selected.has(item._id)}
                onChange={() => onToggleRow(item._id)}
                aria-label={`Select ${item.name}`}
                className="h-4 w-4 rounded bg-white/80"
              />
            </div>
            <Link
              href={`/dashboard/crm/inventory/items/${item._id}`}
              className="block"
            >
              <GridThumbnail src={item.thumbnail} alt={item.name} />
            </Link>
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/dashboard/crm/inventory/items/${item._id}`}
                  className="line-clamp-2 text-[13px] font-medium text-zoru-ink hover:underline"
                >
                  {item.name}
                </Link>
                <StatusPill label={status} tone={statusToTone(status)} />
              </div>
              <div className="flex items-center justify-between gap-2 text-[11.5px] text-zoru-ink-muted">
                <span className="truncate font-mono">{item.sku || '—'}</span>
                <span className="capitalize">{item.itemType ?? 'goods'}</span>
              </div>
              <div className="flex items-center gap-2 text-[11.5px]">
                {item.categoryId ? (
                  <EntityPickerChip entity="category" id={item.categoryId} />
                ) : null}
                {item.brandId ? (
                  <EntityPickerChip entity="brand" id={item.brandId} />
                ) : null}
              </div>
              <div className="flex items-baseline justify-between border-t border-zoru-line pt-2">
                <span className="text-[13px] font-semibold text-zoru-ink">
                  {fmtMoney(item.sellingPrice, item.currency)}
                </span>
                <span className={`text-[11.5px] font-mono tabular-nums ${stockClass}`}>
                  {item.isTrackInventory ? `${item.totalStock} on hand` : 'Not tracked'}
                </span>
              </div>
            </div>
          </ZoruCard>
        );
      })}
    </div>
  );
}

function GridThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [errored, setErrored] = React.useState(false);
  const isData = typeof src === 'string' && src.startsWith('data:');
  if (!src || errored) {
    return (
      <div className="flex h-32 w-full items-center justify-center bg-zoru-surface-2 text-zoru-ink-muted">
        <Package className="h-10 w-10" />
      </div>
    );
  }
  if (isData) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        src={src}
        alt={alt}
        className="h-32 w-full object-cover"
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={320}
      height={128}
      className="h-32 w-full object-cover"
      onError={() => setErrored(true)}
      unoptimized
    />
  );
}
