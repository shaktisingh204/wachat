'use client';

/**
 * SabCRM Supply — Warehouses list client (`/sabcrm/supply/warehouses`).
 *
 * Master-data doc-surface adopter (rollout WI-3): KPI strip (network
 * size, active count, total capacity, default warehouse), config-driven
 * list (typed columns, status filter, type filter through the party
 * slot, search, server pagination, bulk archive, CSV export) and a
 * BESPOKE full-field drawer — identity, type/status, address, manager
 * (a REAL people EntityPicker), tax, capacity and the default/climate
 * switches.
 *
 * The drawer doubles as the detail view: rows are non-navigable
 * (`rowHref: null`); a click opens the drawer in edit mode seeded from
 * the display-ready row (no second fetch — the row carries every field).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Building2,
  CheckCircle2,
  Plus,
  Snowflake,
  Star,
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
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  EntityPicker,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';

import {
  WAREHOUSE_COLUMNS,
  WAREHOUSE_STATUSES,
  WAREHOUSE_TYPE_FILTER_OPTIONS,
  toWarehouseFilters,
} from './warehouses-config';
import {
  createSabcrmSupplyWarehouseFull,
  exportSabcrmSupplyWarehouseRows,
  listSabcrmSupplyWarehousesPage,
  updateSabcrmSupplyWarehouseFull,
} from '@/app/actions/sabcrm-supply-warehouses.actions';
import { deleteSabcrmSupplyWarehouse } from '@/app/actions/sabcrm-supply.actions';
import { searchSabcrmEmployees } from '@/app/actions/sabcrm-people-employees.actions';
import {
  SABCRM_WAREHOUSE_TYPES,
  type SabcrmSupplyWarehouseFullInput,
  type SabcrmSupplyWarehouseKpis,
  type SabcrmSupplyWarehouseListRow,
} from '@/app/actions/sabcrm-supply-warehouses.actions.types';
import type {
  CrmWarehouseStatus,
  CrmWarehouseType,
} from '@/lib/rust-client/crm-warehouses';

/* ─── Drawer state ────────────────────────────────────────────────── */

interface WarehouseDraft {
  name: string;
  code: string;
  type: CrmWarehouseType | '';
  status: CrmWarehouseStatus;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone: string;
  managerId: string;
  managerName: string;
  gstin: string;
  capacityUnits: string;
  capacitySqft: string;
  climateControlled: boolean;
  isDefault: boolean;
}

const TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Unspecified' },
  ...SABCRM_WAREHOUSE_TYPES.map((t) => ({ value: t.value, label: t.label })),
];

const STATUS_OPTIONS: SelectOption[] = WAREHOUSE_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

function emptyDraft(): WarehouseDraft {
  return {
    name: '',
    code: '',
    type: '',
    status: 'active',
    address: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
    phone: '',
    managerId: '',
    managerName: '',
    gstin: '',
    capacityUnits: '',
    capacitySqft: '',
    climateControlled: false,
    isDefault: false,
  };
}

function rowToDraft(row: SabcrmSupplyWarehouseListRow): WarehouseDraft {
  return {
    name: row.name,
    code: row.code,
    type: row.type,
    status: row.status,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    phone: row.phone,
    managerId: row.managerId ?? '',
    managerName: row.managerName ?? '',
    gstin: row.gstin,
    capacityUnits: row.capacityUnits === null ? '' : String(row.capacityUnits),
    capacitySqft: row.capacitySqft === null ? '' : String(row.capacitySqft),
    climateControlled: row.climateControlled,
    isDefault: row.isDefault,
  };
}

function numOrUndef(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function draftToInput(draft: WarehouseDraft): SabcrmSupplyWarehouseFullInput {
  return {
    name: draft.name.trim(),
    code: draft.code.trim() || undefined,
    type: draft.type || undefined,
    status: draft.status,
    address: draft.address.trim() || undefined,
    city: draft.city.trim() || undefined,
    state: draft.state.trim() || undefined,
    country: draft.country.trim() || undefined,
    pincode: draft.pincode.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    managerId: draft.managerId || undefined,
    managerName: draft.managerName.trim() || undefined,
    gstin: draft.gstin.trim() || undefined,
    capacityUnits: numOrUndef(draft.capacityUnits),
    capacitySqft: numOrUndef(draft.capacitySqft),
    climateControlled: draft.climateControlled,
    isDefault: draft.isDefault,
  };
}

/* ─── Warehouse drawer ────────────────────────────────────────────── */

interface WarehouseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial: WarehouseDraft;
  editId: string | null;
  onSaved: () => void;
}

function WarehouseDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  editId,
  onSaved,
}: WarehouseDrawerProps): React.JSX.Element {
  const [draft, setDraft] = React.useState<WarehouseDraft>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }, [open, initial]);

  const patch = (p: Partial<WarehouseDraft>): void =>
    setDraft((d) => ({ ...d, ...p }));

  const submit = async (): Promise<void> => {
    if (!draft.name.trim()) {
      setError('A warehouse name is required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const input = draftToInput(draft);
      const res =
        mode === 'create'
          ? await createSabcrmSupplyWarehouseFull(input)
          : await updateSabcrmSupplyWarehouseFull(editId ?? '', input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        mode === 'create'
          ? `${res.data.name} added.`
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
      <DrawerContent aria-describedby="wh-form-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'New warehouse' : 'Edit warehouse'}
          </DrawerTitle>
          <DrawerDescription id="wh-form-desc">
            {mode === 'create'
              ? 'Add a storage location — identity, address, manager, tax and capacity.'
              : 'Update this storage location.'}
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
                  placeholder="Central warehouse"
                  disabled={busy}
                />
              </Field>
              <Field label="Code">
                <Input
                  value={draft.code}
                  onChange={(e) => patch({ code: e.target.value })}
                  placeholder="WH-01"
                  disabled={busy}
                />
              </Field>
              <Field label="Type">
                <SelectField
                  value={draft.type}
                  onChange={(v) =>
                    patch({ type: (v ?? '') as CrmWarehouseType | '' })
                  }
                  options={TYPE_OPTIONS}
                  disabled={busy}
                />
              </Field>
              <Field label="Status">
                <SelectField
                  value={draft.status}
                  onChange={(v) =>
                    patch({ status: (v ?? 'active') as CrmWarehouseStatus })
                  }
                  options={STATUS_OPTIONS}
                  disabled={busy}
                />
              </Field>
            </div>

            {/* Address */}
            <h3 className="mt-5 mb-2 text-sm font-semibold text-[var(--st-text)]">
              Address
            </h3>
            <div className="fdoc-form-grid">
              <div className="fdoc-form-grid__full">
                <Field label="Street">
                  <Input
                    value={draft.address}
                    onChange={(e) => patch({ address: e.target.value })}
                    placeholder="12 Industrial Estate"
                    disabled={busy}
                  />
                </Field>
              </div>
              <Field label="City">
                <Input
                  value={draft.city}
                  onChange={(e) => patch({ city: e.target.value })}
                  placeholder="Mumbai"
                  disabled={busy}
                />
              </Field>
              <Field label="State">
                <Input
                  value={draft.state}
                  onChange={(e) => patch({ state: e.target.value })}
                  placeholder="Maharashtra"
                  disabled={busy}
                />
              </Field>
              <Field label="Country">
                <Input
                  value={draft.country}
                  onChange={(e) => patch({ country: e.target.value })}
                  placeholder="India"
                  disabled={busy}
                />
              </Field>
              <Field label="Pincode">
                <Input
                  value={draft.pincode}
                  onChange={(e) => patch({ pincode: e.target.value })}
                  placeholder="400001"
                  disabled={busy}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={draft.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                  placeholder="+91 22 1234 5678"
                  disabled={busy}
                />
              </Field>
            </div>

            {/* Manager & tax */}
            <h3 className="mt-5 mb-2 text-sm font-semibold text-[var(--st-text)]">
              Manager &amp; tax
            </h3>
            <div className="fdoc-form-grid">
              <Field label="Manager" help="Linked to a person record.">
                <EntityPicker
                  value={draft.managerId || null}
                  valueLabel={draft.managerName || null}
                  search={async (q) => {
                    const res = await searchSabcrmEmployees(q);
                    return res.ok ? res.data : [];
                  }}
                  placeholder="Search employees…"
                  disabled={busy}
                  onChange={(opt) =>
                    patch({
                      managerId: opt?.id ?? '',
                      managerName: opt?.label ?? '',
                    })
                  }
                />
              </Field>
              <Field label="GSTIN">
                <Input
                  value={draft.gstin}
                  onChange={(e) => patch({ gstin: e.target.value })}
                  placeholder="27ABCDE1234F1Z5"
                  disabled={busy}
                />
              </Field>
            </div>

            {/* Capacity */}
            <h3 className="mt-5 mb-2 text-sm font-semibold text-[var(--st-text)]">
              Capacity
            </h3>
            <div className="fdoc-form-grid">
              <Field label="Capacity (units)">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  value={draft.capacityUnits}
                  onChange={(e) => patch({ capacityUnits: e.target.value })}
                  placeholder="0"
                  disabled={busy}
                />
              </Field>
              <Field label="Capacity (sq ft)">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  value={draft.capacitySqft}
                  onChange={(e) => patch({ capacitySqft: e.target.value })}
                  placeholder="0"
                  disabled={busy}
                />
              </Field>
              <div className="fdoc-form-grid__full flex flex-wrap gap-4">
                <Switch
                  checked={draft.climateControlled}
                  onCheckedChange={(checked) =>
                    patch({ climateControlled: checked })
                  }
                  label="Climate controlled"
                  disabled={busy}
                />
                <Switch
                  checked={draft.isDefault}
                  onCheckedChange={(checked) => patch({ isDefault: checked })}
                  label="Default warehouse"
                  disabled={busy}
                />
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
              {mode === 'create' ? 'Create warehouse' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── List client ─────────────────────────────────────────────────── */

export interface WarehousesClientProps {
  initialRows: SabcrmSupplyWarehouseListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmSupplyWarehouseKpis | null;
}

export function WarehousesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: WarehousesClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'create' | 'edit'>('create');
  const [editId, setEditId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<WarehouseDraft>(() => emptyDraft());

  const openCreate = (): void => {
    setMode('create');
    setEditId(null);
    setDraft(emptyDraft());
    setDrawerOpen(true);
  };

  const openEdit = React.useCallback(
    (row: SabcrmSupplyWarehouseListRow): void => {
      setMode('edit');
      setEditId(row.id);
      setDraft(rowToDraft(row));
      setDrawerOpen(true);
    },
    [],
  );

  const onSaved = (): void => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  };

  // Live row map keyed by id, refreshed by every fetchPage — the
  // row-click capture (below) resolves the clicked row by name.
  const rowsRef = React.useRef<SabcrmSupplyWarehouseListRow[]>(initialRows);

  const config = React.useMemo<DocListPageConfig<SabcrmSupplyWarehouseListRow>>(
    () => ({
      title: 'Warehouses',
      description:
        'Storage locations across your network — capacity, managers and the default fulfilment site.',
      icon: WarehouseIcon,
      entity: { singular: 'warehouse', plural: 'warehouses' },
      columns: WAREHOUSE_COLUMNS,
      statuses: WAREHOUSE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyWarehousesPage(
          toWarehouseFilters(filters),
        );
        if (res.ok) {
          rowsRef.current = res.data.rows;
          return {
            ok: true,
            data: { rows: res.data.rows, hasMore: res.data.hasMore },
          };
        }
        return res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyWarehouseRows(toWarehouseFilters(filters)),
      csvFileName: 'supply-warehouses.csv',
      rowHref: () => null,
      rowLabel: (row) => `warehouse ${row.name}`,
      partyFilter: {
        placeholder: 'Any type',
        search: async (q) => {
          const needle = q.trim().toLowerCase();
          return WAREHOUSE_TYPE_FILTER_OPTIONS.filter(
            (o) => !needle || o.label.toLowerCase().includes(needle),
          );
        },
      },
      bulkActions: [
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected warehouses?',
            description:
              'Archived warehouses are hidden from pickers but their stock history is preserved.',
            actionLabel: 'Archive warehouses',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await updateSabcrmSupplyWarehouseFull(row.id, {
                status: 'archived',
              });
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: X,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected warehouses?',
            description: 'This permanently removes them from the workspace.',
            actionLabel: 'Delete warehouses',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyWarehouse(row.id);
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
        label="Network size"
        icon={Building2}
        value={String(kpis.count)}
        delta={kpis.sampled ? `Latest ${kpis.count} scanned` : 'Warehouses'}
      />
      <KpiCard
        label="Active"
        icon={CheckCircle2}
        value={String(kpis.activeCount)}
        delta={kpis.activeCount === 1 ? 'site live' : 'sites live'}
        deltaTone={kpis.activeCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Total capacity"
        icon={WarehouseIcon}
        value={String(kpis.totalCapacityUnits)}
        delta={`${kpis.climateControlledCount} climate-controlled`}
      />
      <KpiCard
        label="Default site"
        icon={kpis.defaultWarehouseName ? Star : Snowflake}
        value={kpis.defaultWarehouseName ?? 'None set'}
        delta={kpis.defaultWarehouseName ? 'Fulfilment default' : 'Flag one in the drawer'}
      />
    </>
  ) : null;

  const onWrapperClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement;
    if (target.closest('a,button,input,label,[role="combobox"]')) return;
    const tr = target.closest('tbody tr');
    if (!tr) return;
    const cells = tr.querySelectorAll('td');
    // Cell order with bulk actions enabled: [checkbox, name, …].
    const nameCell = cells[1] ?? cells[0];
    const name = (nameCell?.textContent ?? '').trim();
    const row = name
      ? rowsRef.current.find((r) => r.name === name)
      : undefined;
    if (row) openEdit(row);
  };

  return (
    <div onClick={onWrapperClick} className="sabcrm-warehouses-surface">
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New warehouse
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <WarehouseDrawer
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
