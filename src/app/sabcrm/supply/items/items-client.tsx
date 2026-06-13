'use client';

/**
 * SabCRM Supply — Items list client (`/sabcrm/supply/items`).
 *
 * Master-data doc-surface adopter (rollout WI-2): KPI strip (catalog
 * size, stock on hand, inventory value, low-stock count), config-driven
 * list (typed columns, item-type filter through the party slot, search,
 * server pagination, bulk delete, CSV export) and a BESPOKE full-field
 * drawer — DocForm's invoice shape does not fit master data. The drawer
 * doubles as the detail view: rows are non-navigable (`rowHref: null`)
 * and a click opens the drawer in edit mode seeded from the
 * display-ready row (no second fetch — the row carries every field,
 * including resolved per-warehouse stock).
 *
 * Sections: Identity · Pricing · Inventory (per-warehouse rows over a
 * REAL warehouse EntityPicker) · Physical · Images (SabFiles only —
 * never a URL paste). The tenant-unique `sku` violation surfaces as the
 * drawer's inline error (kit `onSubmit` contract).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  Layers,
  Package,
  Plus,
  Trash2,
  TriangleAlert,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react';

import {
  Alert,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  SelectField,
  Switch,
  Tag,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';
import { SabFilePickerButton } from '@/components/sabfiles';

import {
  DocListPage,
  EntityPicker,
  formatDocMoney,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';

import {
  ITEM_COLUMNS,
  ITEM_STATUSES,
  ITEM_TYPE_FILTER_OPTIONS,
  toItemFilters,
} from './items-config';
import {
  createSabcrmSupplyItemFull,
  exportSabcrmSupplyItemRows,
  listSabcrmSupplyItemsPage,
  updateSabcrmSupplyItemFull,
} from '@/app/actions/sabcrm-supply-items.actions';
import { deleteSabcrmSupplyItem } from '@/app/actions/sabcrm-supply.actions';
import { searchSabcrmSupplyWarehouses } from '@/app/actions/sabcrm-supply-docs.actions';
import {
  SABCRM_SUPPLY_ITEM_TYPES,
  type SabcrmSupplyItemFullInput,
  type SabcrmSupplyItemKpis,
  type SabcrmSupplyItemListRow,
  type SabcrmSupplyItemType,
} from '@/app/actions/sabcrm-supply-items.actions.types';

/* ─── Drawer form state ───────────────────────────────────────────── */

interface InventoryRowDraft {
  rowId: string;
  warehouseId: string;
  warehouseLabel: string | null;
  stock: string;
  reorderPoint: string;
}

interface ItemDraft {
  /* identity */
  name: string;
  sku: string;
  description: string;
  itemType: SabcrmSupplyItemType;
  hsnSac: string;
  /* pricing */
  costPrice: string;
  sellingPrice: string;
  taxRate: string;
  currency: string;
  /* inventory */
  isTrackInventory: boolean;
  batchTracking: boolean;
  inventory: InventoryRowDraft[];
  /* physical */
  length: string;
  breadth: string;
  height: string;
  volume: string;
  grossWeight: string;
  netWeight: string;
  /* images (SabFiles urls) */
  images: string[];
}

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

const ITEM_TYPE_OPTIONS: SelectOption[] = SABCRM_SUPPLY_ITEM_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `inv-${rowSeq}`;
}

function blankInventoryRow(): InventoryRowDraft {
  return {
    rowId: nextRowId(),
    warehouseId: '',
    warehouseLabel: null,
    stock: '',
    reorderPoint: '',
  };
}

function emptyDraft(): ItemDraft {
  return {
    name: '',
    sku: '',
    description: '',
    itemType: 'goods',
    hsnSac: '',
    costPrice: '',
    sellingPrice: '',
    taxRate: '',
    currency: 'INR',
    isTrackInventory: true,
    batchTracking: false,
    inventory: [blankInventoryRow()],
    length: '',
    breadth: '',
    height: '',
    volume: '',
    grossWeight: '',
    netWeight: '',
    images: [],
  };
}

/** Display-ready row → drawer draft (no second fetch — the row is full). */
function rowToDraft(row: SabcrmSupplyItemListRow): ItemDraft {
  const inventory = row.inventory.map((inv) => ({
    rowId: nextRowId(),
    warehouseId: inv.warehouseId,
    warehouseLabel: inv.warehouseLabel,
    stock: String(inv.stock ?? ''),
    reorderPoint:
      inv.reorderPoint === undefined || inv.reorderPoint === null
        ? ''
        : String(inv.reorderPoint),
  }));
  return {
    name: row.name,
    sku: row.sku,
    description: row.description,
    itemType: row.itemType,
    hsnSac: row.hsnSac,
    costPrice: String(row.costPrice ?? ''),
    sellingPrice: String(row.sellingPrice ?? ''),
    taxRate: row.taxRate === null ? '' : String(row.taxRate),
    currency: row.currency,
    isTrackInventory: row.isTrackInventory,
    batchTracking: row.batchTracking,
    inventory: inventory.length > 0 ? inventory : [blankInventoryRow()],
    length: row.dimensions?.length != null ? String(row.dimensions.length) : '',
    breadth:
      row.dimensions?.breadth != null ? String(row.dimensions.breadth) : '',
    height: row.dimensions?.height != null ? String(row.dimensions.height) : '',
    volume: row.dimensions?.volume != null ? String(row.dimensions.volume) : '',
    grossWeight: row.weight?.gross != null ? String(row.weight.gross) : '',
    netWeight: row.weight?.net != null ? String(row.weight.net) : '',
    images: [...row.images],
  };
}

/** Parses a numeric string, returning undefined for empty/invalid. */
function numOrUndef(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Draft → full create/update payload. */
function draftToInput(draft: ItemDraft): SabcrmSupplyItemFullInput {
  const dims = {
    length: numOrUndef(draft.length),
    breadth: numOrUndef(draft.breadth),
    height: numOrUndef(draft.height),
    volume: numOrUndef(draft.volume),
  };
  const hasDims =
    dims.length !== undefined ||
    dims.breadth !== undefined ||
    dims.height !== undefined ||
    dims.volume !== undefined;
  const weight = {
    gross: numOrUndef(draft.grossWeight),
    net: numOrUndef(draft.netWeight),
  };
  const hasWeight = weight.gross !== undefined || weight.net !== undefined;
  return {
    name: draft.name.trim(),
    sku: draft.sku.trim(),
    description: draft.description.trim() || undefined,
    itemType: draft.itemType,
    hsnSac: draft.hsnSac.trim() || undefined,
    costPrice: numOrUndef(draft.costPrice),
    sellingPrice: numOrUndef(draft.sellingPrice),
    taxRate: numOrUndef(draft.taxRate),
    currency: draft.currency,
    isTrackInventory: draft.isTrackInventory,
    batchTracking: draft.batchTracking,
    inventory: draft.isTrackInventory
      ? draft.inventory
          .filter((r) => r.warehouseId)
          .map((r) => ({
            warehouseId: r.warehouseId,
            stock: numOrUndef(r.stock) ?? 0,
            reorderPoint: numOrUndef(r.reorderPoint),
          }))
      : [],
    dimensions: hasDims ? dims : undefined,
    weight: hasWeight ? weight : undefined,
    images: draft.images,
  };
}

/* ─── Item drawer ─────────────────────────────────────────────────── */

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial: ItemDraft;
  editId: string | null;
  onSaved: () => void;
}

function ItemDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  editId,
  onSaved,
}: ItemDrawerProps): React.JSX.Element {
  const [draft, setDraft] = React.useState<ItemDraft>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }, [open, initial]);

  const patch = (p: Partial<ItemDraft>): void =>
    setDraft((d) => ({ ...d, ...p }));

  const patchInventory = (
    rowId: string,
    p: Partial<InventoryRowDraft>,
  ): void =>
    setDraft((d) => ({
      ...d,
      inventory: d.inventory.map((r) =>
        r.rowId === rowId ? { ...r, ...p } : r,
      ),
    }));

  const submit = async (): Promise<void> => {
    if (!draft.name.trim()) {
      setError('An item name is required.');
      return;
    }
    if (!draft.sku.trim()) {
      setError('A SKU is required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const input = draftToInput(draft);
      const res =
        mode === 'create'
          ? await createSabcrmSupplyItemFull(input)
          : await updateSabcrmSupplyItemFull(editId ?? '', input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        mode === 'create'
          ? `${res.data.name} added to the catalog.`
          : `${res.data.name} updated.`,
      );
      onOpenChange(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      side="right"
    >
      <DrawerContent aria-describedby="item-form-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>{mode === 'create' ? 'New item' : 'Edit item'}</DrawerTitle>
          <DrawerDescription id="item-form-desc">
            {mode === 'create'
              ? 'Add a product or service to the catalog — identity, pricing, inventory and physical attributes.'
              : 'Update this catalog item. The stock rollup is recomputed from the per-warehouse rows.'}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {/* Identity */}
            <h3 className="mt-3 mb-2 text-sm font-semibold text-[var(--st-text)]">
              Identity
            </h3>
            <div className="fdoc-form-grid">
              <Field label="Name" required>
                <Input
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Premium widget"
                  disabled={busy}
                />
              </Field>
              <Field label="SKU" required help="Unique within the workspace.">
                <Input
                  value={draft.sku}
                  onChange={(e) => patch({ sku: e.target.value })}
                  placeholder="WIDGET-001"
                  disabled={busy}
                />
              </Field>
              <Field label="Type">
                <SelectField
                  value={draft.itemType}
                  onChange={(v) =>
                    patch({ itemType: (v ?? 'goods') as SabcrmSupplyItemType })
                  }
                  options={ITEM_TYPE_OPTIONS}
                  disabled={busy}
                />
              </Field>
              <Field label="HSN / SAC" help="Tax classification code.">
                <Input
                  value={draft.hsnSac}
                  onChange={(e) => patch({ hsnSac: e.target.value })}
                  placeholder="8473"
                  disabled={busy}
                />
              </Field>
              <div className="fdoc-form-grid__full">
                <Field label="Description">
                  <Textarea
                    value={draft.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    rows={2}
                    placeholder="Short catalog description."
                    disabled={busy}
                  />
                </Field>
              </div>
            </div>

            {/* Pricing */}
            <h3 className="mt-5 mb-2 text-sm font-semibold text-[var(--st-text)]">
              Pricing
            </h3>
            <div className="fdoc-form-grid">
              <Field label="Cost price">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={draft.costPrice}
                  onChange={(e) => patch({ costPrice: e.target.value })}
                  placeholder="0.00"
                  disabled={busy}
                />
              </Field>
              <Field label="Selling price">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={draft.sellingPrice}
                  onChange={(e) => patch({ sellingPrice: e.target.value })}
                  placeholder="0.00"
                  disabled={busy}
                />
              </Field>
              <Field label="Tax rate %" help="0–100.">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  value={draft.taxRate}
                  onChange={(e) => patch({ taxRate: e.target.value })}
                  placeholder="18"
                  disabled={busy}
                />
              </Field>
              <Field label="Currency">
                <SelectField
                  value={draft.currency}
                  onChange={(v) => patch({ currency: v ?? 'INR' })}
                  options={CURRENCY_OPTIONS}
                  disabled={busy}
                />
              </Field>
            </div>

            {/* Inventory */}
            <h3 className="mt-5 mb-2 text-sm font-semibold text-[var(--st-text)]">
              Inventory
            </h3>
            <div className="fdoc-form-grid">
              <div className="fdoc-form-grid__full flex flex-wrap gap-4">
                <Switch
                  checked={draft.isTrackInventory}
                  onCheckedChange={(checked) =>
                    patch({ isTrackInventory: checked })
                  }
                  label="Track inventory"
                  disabled={busy}
                />
                <Switch
                  checked={draft.batchTracking}
                  onCheckedChange={(checked) =>
                    patch({ batchTracking: checked })
                  }
                  label="Batch tracking"
                  disabled={busy || !draft.isTrackInventory}
                />
              </div>
            </div>

            {draft.isTrackInventory ? (
              <div className="mt-3 space-y-2">
                {draft.inventory.map((row) => (
                  <div
                    key={row.rowId}
                    className="grid grid-cols-[1fr_120px_120px_auto] items-end gap-2"
                  >
                    <Field label="Warehouse">
                      <EntityPicker
                        value={row.warehouseId || null}
                        valueLabel={row.warehouseLabel}
                        search={async (q) => {
                          const res = await searchSabcrmSupplyWarehouses(q);
                          return res.ok ? res.data : [];
                        }}
                        placeholder="Search warehouses…"
                        disabled={busy}
                        onChange={(opt) =>
                          patchInventory(row.rowId, {
                            warehouseId: opt?.id ?? '',
                            warehouseLabel: opt?.label ?? null,
                          })
                        }
                      />
                    </Field>
                    <Field label="Stock">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={row.stock}
                        onChange={(e) =>
                          patchInventory(row.rowId, { stock: e.target.value })
                        }
                        placeholder="0"
                        disabled={busy}
                      />
                    </Field>
                    <Field label="Reorder at">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={row.reorderPoint}
                        onChange={(e) =>
                          patchInventory(row.rowId, {
                            reorderPoint: e.target.value,
                          })
                        }
                        placeholder="—"
                        disabled={busy}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      iconLeft={X}
                      aria-label="Remove warehouse row"
                      disabled={busy || draft.inventory.length <= 1}
                      onClick={() =>
                        patch({
                          inventory: draft.inventory.filter(
                            (r) => r.rowId !== row.rowId,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  iconLeft={Plus}
                  disabled={busy}
                  onClick={() =>
                    patch({
                      inventory: [...draft.inventory, blankInventoryRow()],
                    })
                  }
                >
                  Add warehouse
                </Button>
              </div>
            ) : null}

            {/* Physical */}
            <h3 className="mt-5 mb-2 text-sm font-semibold text-[var(--st-text)]">
              Physical
            </h3>
            <div className="fdoc-form-grid">
              <Field label="Length">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.length}
                  onChange={(e) => patch({ length: e.target.value })}
                  placeholder="0"
                  disabled={busy}
                />
              </Field>
              <Field label="Breadth">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.breadth}
                  onChange={(e) => patch({ breadth: e.target.value })}
                  placeholder="0"
                  disabled={busy}
                />
              </Field>
              <Field label="Height">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.height}
                  onChange={(e) => patch({ height: e.target.value })}
                  placeholder="0"
                  disabled={busy}
                />
              </Field>
              <Field label="Volume">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.volume}
                  onChange={(e) => patch({ volume: e.target.value })}
                  placeholder="0"
                  disabled={busy}
                />
              </Field>
              <Field label="Gross weight">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.grossWeight}
                  onChange={(e) => patch({ grossWeight: e.target.value })}
                  placeholder="0"
                  disabled={busy}
                />
              </Field>
              <Field label="Net weight">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.netWeight}
                  onChange={(e) => patch({ netWeight: e.target.value })}
                  placeholder="0"
                  disabled={busy}
                />
              </Field>
            </div>

            {/* Images */}
            <h3 className="mt-5 mb-2 text-sm font-semibold text-[var(--st-text)]">
              Images
            </h3>
            <div className="fdoc-form-grid">
              <div className="fdoc-form-grid__full">
                <Field
                  label="Product images"
                  help="Files live in SabFiles — pick from the library or upload."
                >
                  <div className="fdoc-attachments">
                    {draft.images.map((url) => (
                      <Tag
                        key={url}
                        onRemove={
                          busy
                            ? undefined
                            : () =>
                                patch({
                                  images: draft.images.filter(
                                    (u) => u !== url,
                                  ),
                                })
                        }
                      >
                        {url.split('/').pop() || 'Image'}
                      </Tag>
                    ))}
                    <SabFilePickerButton
                      onPick={(pick) => {
                        const url = pick.url ?? pick.id;
                        if (draft.images.includes(url)) return;
                        patch({ images: [...draft.images, url] });
                      }}
                    >
                      <Package size={14} aria-hidden="true" /> Add image
                    </SabFilePickerButton>
                  </div>
                </Field>
              </div>
            </div>

            {error ? (
              <div className="mt-3">
                <Alert tone="danger" role="alert">
                  {error}
                </Alert>
              </div>
            ) : null}
          </div>

          <DrawerFooter>
            <Button
              type="button"
              variant="ghost"
              iconLeft={X}
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              {mode === 'create' ? 'Create item' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── List client ─────────────────────────────────────────────────── */

export interface ItemsClientProps {
  initialRows: SabcrmSupplyItemListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmSupplyItemKpis | null;
}

export function ItemsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: ItemsClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'create' | 'edit'>('create');
  const [editId, setEditId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<ItemDraft>(() => emptyDraft());

  const openCreate = (): void => {
    setMode('create');
    setEditId(null);
    setDraft(emptyDraft());
    setDrawerOpen(true);
  };

  const openEdit = React.useCallback((row: SabcrmSupplyItemListRow): void => {
    setMode('edit');
    setEditId(row.id);
    setDraft(rowToDraft(row));
    setDrawerOpen(true);
  }, []);

  const onSaved = (): void => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  };

  // The kit doesn't expose a per-row callback for non-navigable rows, so
  // a ref tracks the live loaded rows (seeded from the server, refreshed
  // by every `fetchPage`); the row-click capture (below) matches the
  // clicked row's SKU against this map to open the edit drawer.
  const rowsRef = React.useRef<Map<string, SabcrmSupplyItemListRow>>(
    new Map(initialRows.map((r) => [r.sku, r])),
  );

  const config = React.useMemo<DocListPageConfig<SabcrmSupplyItemListRow>>(
    () => ({
      title: 'Items',
      description:
        'Your product & service catalog — pricing, per-warehouse stock and physical attributes.',
      icon: Package,
      entity: { singular: 'item', plural: 'items' },
      columns: ITEM_COLUMNS,
      statuses: ITEM_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyItemsPage(toItemFilters(filters));
        if (res.ok) {
          rowsRef.current = new Map(res.data.rows.map((r) => [r.sku, r]));
          return {
            ok: true,
            data: { rows: res.data.rows, hasMore: res.data.hasMore },
          };
        }
        return res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyItemRows(toItemFilters(filters)),
      csvFileName: 'supply-items.csv',
      // Master data: rows open the edit drawer (no detail route).
      rowHref: () => null,
      rowLabel: (row) => `item ${row.sku}`,
      partyFilter: {
        placeholder: 'Any type',
        search: async (q) => {
          const needle = q.trim().toLowerCase();
          return ITEM_TYPE_FILTER_OPTIONS.filter(
            (o) => !needle || o.label.toLowerCase().includes(needle),
          );
        },
      },
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected items?',
            description:
              'This permanently removes them from the catalog. Documents that already referenced them keep their snapshot.',
            actionLabel: 'Delete items',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyItem(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Catalog size"
        icon={Layers}
        value={String(kpis.count)}
        delta={`${kpis.goodsCount} goods · ${kpis.serviceCount} services`}
      />
      <KpiCard
        label="Stock on hand"
        icon={Boxes}
        value={String(kpis.totalStockUnits)}
        delta={kpis.sampled ? `Across the latest ${kpis.count} items` : 'Tracked units'}
      />
      <KpiCard
        label="Inventory value"
        icon={WarehouseIcon}
        value={formatDocMoney(kpis.stockValue, kpis.currency)}
        delta="At cost"
      />
      <KpiCard
        label="Low stock"
        icon={TriangleAlert}
        value={String(kpis.lowStockCount)}
        delta={kpis.lowStockCount === 1 ? 'item below reorder' : 'items below reorder'}
        deltaTone={kpis.lowStockCount > 0 ? 'down' : 'neutral'}
      />
    </>
  ) : null;

  // Master-data rows have no detail route (`rowHref → null`), so the kit
  // leaves them non-clickable. We capture clicks on the wrapper, walk up
  // to the row's first data cell (the item name) and match its text
  // against the live row map to open the edit drawer — keeping the kit
  // untouched. Interactive children (checkbox/buttons) are ignored.
  const onWrapperClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement;
    if (target.closest('a,button,input,label,[role="combobox"]')) return;
    const tr = target.closest('tbody tr');
    if (!tr) return;
    const cells = tr.querySelectorAll('td');
    // Cell order with bulk actions enabled: [checkbox, name, SKU, …].
    // SKU is tenant-unique → the reliable key into the live row map.
    const skuCell = cells[2] ?? cells[1];
    const sku = (skuCell?.textContent ?? '').trim();
    const row = sku ? rowsRef.current.get(sku) : undefined;
    if (row) openEdit(row);
  };

  return (
    <div onClick={onWrapperClick} className="sabcrm-items-surface">
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New item
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <ItemDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={mode}
        initial={draft}
        editId={editId}
        onSaved={onSaved}
      />
    </div>
  );
}
