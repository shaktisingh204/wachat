'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import {
  MoreHorizontal,
  Package } from 'lucide-react';

/**
 * <ItemsTable> — table-view body for the canonical items list.
 *
 * 13 columns: select · thumbnail · name (chip) · sku · category (chip) ·
 * brand · unit · type · selling price · stock qty · reorder point ·
 * status · actions.
 *
 * Density modes control row padding; the parent owns selection state.
 */

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { ItemDensity, ItemListRow } from './types';
import { isLowStock, isOutOfStock } from './types';

interface ItemsTableProps {
  items: ItemListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
  density?: ItemDensity;
}

const DENSITY_CELL: Record<ItemDensity, string> = {
  comfortable: 'p-2',
  compact: 'p-1.5',
  dense: 'p-1',
};

function fmtMoney(value: number | undefined, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function ItemsTable({
  items,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  density = 'comfortable',
}: ItemsTableProps) {
  const cell = DENSITY_CELL[density];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
          <tr>
            <th className={`${cell} text-left`}>
              <input
                type="checkbox"
                checked={allSelectedOnPage}
                onChange={onToggleAll}
                aria-label="Select all visible items"
              />
            </th>
            <th className={`${cell} text-left`}></th>
            <th className={`${cell} text-left`}>Name</th>
            <th className={`${cell} text-left`}>SKU</th>
            <th className={`${cell} text-left`}>Category</th>
            <th className={`${cell} text-left`}>Brand</th>
            <th className={`${cell} text-left`}>Unit</th>
            <th className={`${cell} text-left`}>Type</th>
            <th className={`${cell} text-right`}>Selling price</th>
            <th className={`${cell} text-right`}>Stock</th>
            <th className={`${cell} text-right`}>Reorder pt</th>
            <th className={`${cell} text-left`}>Status</th>
            <th className={cell}></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={13}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {filtersActive
                  ? 'No items match the current filters.'
                  : 'No items yet — click "New item" to add the first one.'}
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const low = isLowStock(item);
              const out = isOutOfStock(item);
              const stockClass = out
                ? 'text-zoru-danger-ink'
                : low
                  ? 'text-zoru-warning-ink'
                  : 'text-zoru-ink';
              const status = item.status ?? 'active';
              const id = item._id;
              return (
                <tr
                  key={id}
                  className="border-t border-zoru-line hover:bg-zoru-surface-2/60"
                >
                  <td className={`${cell} align-middle`}>
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => onToggleRow(id)}
                      aria-label={`Select ${item.name}`}
                    />
                  </td>
                  <td className={`${cell} align-middle`}>
                    <ItemThumbnail src={item.thumbnail} alt={item.name} />
                  </td>
                  <td className={`${cell} align-middle`}>
                    <EntityRowLink
                      href={`/dashboard/crm/inventory/items/${id}`}
                      label={item.name || '—'}
                      subtitle={item.sku ? `SKU ${item.sku}` : item.hsnSac ? `HSN ${item.hsnSac}` : undefined}
                    />
                  </td>
                  <td className={`${cell} align-middle font-mono text-zoru-ink`}>
                    {item.sku || '—'}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {item.categoryId ? (
                      <EntityPickerChip entity="category" id={item.categoryId} />
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {item.brandId ? (
                      <EntityPickerChip entity="brand" id={item.brandId} />
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </td>
                  <td className={`${cell} align-middle`}>
                    {item.unitId ? (
                      <EntityPickerChip entity="unit" id={item.unitId} />
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </td>
                  <td className={`${cell} align-middle capitalize text-zoru-ink-muted`}>
                    {item.itemType ?? 'goods'}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums text-zoru-ink`}
                  >
                    {fmtMoney(item.sellingPrice, item.currency)}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums ${stockClass}`}
                  >
                    {item.isTrackInventory ? (
                      <>
                        {item.totalStock}
                        {out ? (
                          <span className="ml-1 text-[10px] uppercase">out</span>
                        ) : low ? (
                          <span className="ml-1 text-[10px] uppercase">low</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </td>
                  <td
                    className={`${cell} text-right align-middle font-mono tabular-nums text-zoru-ink-muted`}
                  >
                    {item.reorderPoint ?? item.inventory[0]?.reorderPoint ?? '—'}
                  </td>
                  <td className={`${cell} align-middle`}>
                    <StatusPill label={status} tone={statusToTone(status)} />
                  </td>
                  <td className={`${cell} text-right align-middle`}>
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent>
                        <ZoruDropdownMenuItem asChild>
                          <Link href={`/dashboard/crm/inventory/items/${id}`}>
                            View
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/inventory/items/${id}/edit`}
                          >
                            Edit
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/inventory/adjustments/new?productId=${id}`}
                          >
                            Adjust stock
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/inventory/items/new?fromKind=product&fromId=${id}`}
                          >
                            Duplicate
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/crm/inventory/items/${id}/activity`}
                          >
                            Activity
                          </Link>
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function ItemThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [errored, setErrored] = React.useState(false);
  const isData = typeof src === 'string' && src.startsWith('data:');
  if (!src || errored) {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-zoru-surface-2 text-zoru-ink-muted">
        <Package className="h-4 w-4" />
      </span>
    );
  }
  if (isData) {
    // data: URLs aren't supported by next/image without unoptimized; fall back
    // to a plain <img> tag for inline base64 thumbnails.
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        src={src}
        alt={alt}
        width={36}
        height={36}
        className="h-9 w-9 rounded-sm object-cover"
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={36}
      height={36}
      className="h-9 w-9 rounded-sm object-cover"
      onError={() => setErrored(true)}
      unoptimized
    />
  );
}
