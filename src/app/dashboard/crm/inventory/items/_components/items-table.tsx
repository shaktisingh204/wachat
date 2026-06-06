'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { fmtINR } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useToast } from '@/components/sabcrm/20ui';
import { MoreHorizontal, Package } from 'lucide-react';
import Image from 'next/image';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { updateProductStatus } from '@/app/actions/crm-products.actions';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';

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

export function ItemsTable({
  items,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  density = 'comfortable',
}: ItemsTableProps) {
  
  const pathname = usePathname();
  const [contextMenu, setContextMenu] = React.useState<{ id: string; x: number; y: number } | null>(null);

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);
const { toast } = useToast();
  const router = useRouter();

  const bulky = useCrmBulkyState<ItemListRow>({
    initialData: items,
  });

  React.useEffect(() => {
    bulky.setData(items);
  }, [items]);

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<ItemListRow>) => {
    if (!updatedFields.status) return;
    try {
      const res = await updateProductStatus(id, updatedFields.status);
      if (res.success) {
        toast({
          title: 'Saved inline',
          description: `Item status updated to ${updatedFields.status}.`,
        });
        bulky.cancelInlineEdit();
        router.refresh();
      } else {
        toast({
          title: 'Update failed',
          description: res.error || 'Server rejected changes.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const columns = React.useMemo<ColumnDef<ItemListRow>[]>(() => [
    {
      key: 'thumbnail',
      header: '',
      render: (row) => <ItemThumbnail src={row.thumbnail} alt={row.name} />,
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/inventory/items/${row._id}`}
          label={row.name || '—'}
          subtitle={row.sku ? `SKU ${row.sku}` : row.hsnSac ? `HSN ${row.hsnSac}` : undefined}
        />
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-[var(--st-text)]">{row.sku || '—'}</span>
      ),
    },
    {
      key: 'categoryId',
      header: 'Category',
      sortable: true,
      render: (row) => row.categoryId ? (
        <EntityPickerChip entity="category" id={row.categoryId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'brandId',
      header: 'Brand',
      sortable: true,
      render: (row) => row.brandId ? (
        <EntityPickerChip entity="brand" id={row.brandId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'unitId',
      header: 'Unit',
      sortable: true,
      render: (row) => row.unitId ? (
        <EntityPickerChip entity="unit" id={row.unitId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'itemType',
      header: 'Type',
      sortable: true,
      render: (row) => (
        <span className="capitalize text-[var(--st-text-secondary)]">{row.itemType ?? 'goods'}</span>
      ),
    },
    {
      key: 'sellingPrice',
      header: 'Selling price',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-[var(--st-text)] text-right block w-full">
          {fmtINR(row.sellingPrice, row.currency)}
        </span>
      ),
    },
    {
      key: 'totalStock',
      header: 'Stock',
      sortable: true,
      render: (row) => {
        const low = isLowStock(row);
        const out = isOutOfStock(row);
        const stockClass = out
          ? 'text-[var(--st-danger)] font-semibold'
          : low
            ? 'text-[var(--st-warn)] font-semibold'
            : 'text-[var(--st-text)]';
        return (
          <span className={`font-mono tabular-nums text-right block w-full ${stockClass}`}>
            {row.isTrackInventory ? (
              <>
                {row.totalStock}
                {out ? (
                  <span className="ml-1 text-[10px] uppercase font-bold">[Out]</span>
                ) : low ? (
                  <span className="ml-1 text-[10px] uppercase font-bold">[Low]</span>
                ) : null}
              </>
            ) : (
              <span className="text-[var(--st-text-secondary)]">—</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'reorderPoint',
      header: 'Reorder pt',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-[var(--st-text-secondary)] text-right block w-full">
          {row.reorderPoint ?? row.inventory?.[0]?.reorderPoint ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => {
        const status = row.status ?? 'active';
        return <StatusPill label={status} tone={statusToTone(status)} />;
      },
      editRender: (row, value, onChange) => (
        <select
          className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded px-1.5 py-0.5 text-[12px] font-medium text-[var(--st-text)] focus:outline-none focus:ring-1 focus:ring-[var(--st-text)]"
          value={value || 'active'}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        const id = row._id;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Row actions"
                className="h-8 w-8 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/crm/inventory/items/${id}`}>
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/crm/inventory/items/${id}/edit`}>
                  Edit Item
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/crm/inventory/adjustments/new?productId=${id}`}>
                  Adjust stock
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/crm/inventory/items/new?fromKind=product&fromId=${id}`}>
                  Duplicate
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/crm/inventory/items/${id}/activity`}>
                  Audit Logs / Activity
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [toast, router]);

  return (
    <CrmBulkyGrid<ItemListRow>
      columns={columns}
      data={bulky.data}
      selectedIds={selected}
      onSelectOne={onToggleRow}
      onSelectAll={onToggleAll}
      density={density}
      inlineEditRowId={bulky.inlineEditRowId}
      editBuffer={bulky.editBuffer}
      onStartInlineEdit={bulky.startInlineEdit}
      onCancelInlineEdit={bulky.cancelInlineEdit}
      onSaveInlineEdit={handleSaveInlineEdit}
      onUpdateEditBuffer={bulky.updateEditBuffer}
    />
  );
}

function ItemThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [errored, setErrored] = React.useState(false);
  const isData = typeof src === 'string' && src.startsWith('data:');
  if (!src || errored) {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] border border-[var(--st-border)]">
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
        className="h-9 w-9 rounded-sm object-cover border border-[var(--st-border)]"
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
      className="h-9 w-9 rounded-sm object-cover border border-[var(--st-border)]"
      onError={() => setErrored(true)}
      unoptimized
    />
  );
}
