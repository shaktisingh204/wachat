'use client';

/**
 * SabCRM Commerce — Shipping zones list client
 * (`/sabcrm/commerce/shipping`).
 *
 * Doc-surface adopter (spec WI-17): KPI strip (active / methods /
 * countries), the config-driven DocListPage (storefront labels
 * resolved server-side), a storefront party filter and a FULL-field
 * 20ui Dialog drawer — storefront picker, countries / states tag
 * inputs and a repeatable methods grid (name + kind select + rate +
 * free-above threshold) that supersedes the single-starter-method
 * dialog.
 *
 * Rows carry the full editable field set (methods grid included), so
 * the edit drawer seeds without a second fetch; a row click deep-links
 * to `?edit=<id>`.
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Archive, Globe, Plus, Trash2, Truck } from 'lucide-react';

import {
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SelectField,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  EntityPicker,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  SHIPPING_METHOD_KINDS,
  SHIPPING_PATH,
  SHIPPING_STATUSES,
  toShippingFilters,
} from './shipping-config';

import {
  createSabcrmShippingZoneFull,
  exportSabcrmShippingZoneRows,
  listSabcrmShippingZonesPage,
} from '@/app/actions/sabcrm-commerce-shipping.actions';
import { updateSabcrmShippingZone } from '@/app/actions/sabcrm-commerce-docs.actions';
import { archiveSabcrmShippingZone } from '@/app/actions/sabcrm-commerce.actions';
import { searchSabcrmStorefronts } from '@/app/actions/sabcrm-commerce-docs.actions';
import type {
  SabcrmShippingZoneKpis,
  SabcrmShippingZoneListRow,
} from '@/app/actions/sabcrm-commerce-shipping.actions.types';
import type {
  CrmStoreShippingMethod,
  CrmStoreShippingZoneStatus,
} from '@/lib/rust-client/crm-store';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmShippingZoneListRow>[] = [
  { key: 'name', header: 'Name', kind: 'text', value: (r) => r.name },
  {
    key: 'storefront',
    header: 'Storefront',
    kind: 'party',
    value: (r) => r.storefrontLabel,
  },
  {
    key: 'countries',
    header: 'Countries',
    kind: 'text',
    value: (r) => r.countries.join(', '),
  },
  {
    key: 'methods',
    header: 'Methods',
    kind: 'text',
    align: 'right',
    value: (r) => String(r.methodsCount),
  },
  {
    key: 'cheapestRate',
    header: 'From',
    kind: 'money',
    value: (r) => r.cheapestRate,
    currency: () => 'INR',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Drawer ──────────────────────────────────────────────────── */

const METHOD_KIND_OPTIONS: SelectOption[] = SHIPPING_METHOD_KINDS.map((k) => ({
  value: k.value,
  label: k.label,
}));

const STATUS_OPTIONS: SelectOption[] = SHIPPING_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

interface MethodRow {
  rowId: string;
  name: string;
  kind: 'flat' | 'weight_based' | 'free_above';
  rate: string;
  freeAboveSubtotal: string;
}

interface ShippingFormState {
  storefrontId: string | null;
  storefrontLabel: string | null;
  name: string;
  countries: string;
  states: string;
  status: string | null;
  methods: MethodRow[];
}

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function blankMethod(): MethodRow {
  return { rowId: rid(), name: 'Standard', kind: 'flat', rate: '', freeAboveSubtotal: '' };
}

function emptyForm(): ShippingFormState {
  return {
    storefrontId: null,
    storefrontLabel: null,
    name: '',
    countries: '',
    states: '',
    status: 'active',
    methods: [blankMethod()],
  };
}

function rowToForm(row: SabcrmShippingZoneListRow): ShippingFormState {
  return {
    storefrontId: row.storefrontId,
    storefrontLabel: row.storefrontLabel,
    name: row.name,
    countries: row.countries.join(', '),
    states: row.states.join(', '),
    status: row.status,
    methods: row.methods.length
      ? row.methods.map((m) => ({
          rowId: rid(),
          name: m.name,
          kind: m.kind as MethodRow['kind'],
          rate: String(m.rate ?? ''),
          freeAboveSubtotal:
            m.freeAboveSubtotal != null ? String(m.freeAboveSubtotal) : '',
        }))
      : [blankMethod()],
  };
}

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

interface ShippingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SabcrmShippingZoneListRow | null;
  onDone: () => void;
}

function ShippingDialog({
  open,
  onOpenChange,
  editing,
  onDone,
}: ShippingDialogProps): React.JSX.Element {
  const [form, setForm] = React.useState<ShippingFormState>(emptyForm());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? rowToForm(editing) : emptyForm());
    setError(null);
  }, [open, editing]);

  const patch = (p: Partial<ShippingFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const addMethod = (): void =>
    setForm((f) => ({ ...f, methods: [...f.methods, blankMethod()] }));

  const removeMethod = (rowId: string): void =>
    setForm((f) => ({ ...f, methods: f.methods.filter((m) => m.rowId !== rowId) }));

  const setMethod = (rowId: string, p: Partial<MethodRow>): void =>
    setForm((f) => ({
      ...f,
      methods: f.methods.map((m) => (m.rowId === rowId ? { ...m, ...p } : m)),
    }));

  const submit = (): void => {
    if (!form.storefrontId) {
      setError('Pick a storefront.');
      return;
    }
    if (!form.name.trim()) {
      setError('A zone name is required.');
      return;
    }
    const methods: CrmStoreShippingMethod[] = form.methods
      .filter((m) => m.name.trim())
      .map((m) => ({
        name: m.name.trim(),
        kind: m.kind,
        rate: Number(m.rate) || 0,
        freeAboveSubtotal:
          m.kind === 'free_above' && m.freeAboveSubtotal.trim()
            ? Number(m.freeAboveSubtotal)
            : undefined,
      }));
    if (methods.length === 0) {
      setError('Add at least one shipping method.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const countries = parseList(form.countries).map((c) => c.toUpperCase());
      const states = parseList(form.states);
      const res = editing
        ? await updateSabcrmShippingZone(editing.id, {
            storefrontId: form.storefrontId!,
            name: form.name.trim(),
            countries,
            states,
            methods,
            status: (form.status ?? 'active') as CrmStoreShippingZoneStatus,
          })
        : await createSabcrmShippingZoneFull({
            storefrontId: form.storefrontId!,
            name: form.name,
            countries,
            states,
            methods,
          });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(editing ? `${res.data.name} updated.` : `${res.data.name} created.`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="ship-desc">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${editing.name}` : 'New shipping zone'}
          </DialogTitle>
          <DialogDescription id="ship-desc">
            {editing
              ? 'Update the zone scope and rate methods.'
              : 'A geographic delivery zone and its rate methods for a storefront.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex max-h-[68vh] flex-col gap-3 overflow-y-auto pb-2 pt-1">
            <Field label="Storefront" required>
              <EntityPicker
                value={form.storefrontId}
                valueLabel={form.storefrontLabel}
                onChange={(opt) =>
                  patch({
                    storefrontId: opt?.id ?? null,
                    storefrontLabel: opt?.label ?? null,
                  })
                }
                search={async (q) => {
                  const res = await searchSabcrmStorefronts(q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Search storefronts…"
                aria-label="Storefront"
                disabled={pending}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zone name" required>
                <Input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Domestic"
                  disabled={pending}
                />
              </Field>
              {editing ? (
                <Field label="Status">
                  <SelectField
                    value={form.status}
                    onChange={(v) => patch({ status: v })}
                    options={STATUS_OPTIONS}
                    disabled={pending}
                  />
                </Field>
              ) : (
                <div />
              )}
            </div>
            <Field label="Countries (ISO-2, comma-separated)" required>
              <Input
                value={form.countries}
                onChange={(e) => patch({ countries: e.target.value })}
                placeholder="IN, AE, US"
                disabled={pending}
              />
            </Field>
            <Field label="States / regions (comma-separated)">
              <Input
                value={form.states}
                onChange={(e) => patch({ states: e.target.value })}
                placeholder="Maharashtra, Karnataka"
                disabled={pending}
              />
            </Field>

            <fieldset className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                Methods
              </legend>
              {form.methods.map((m) => (
                <div
                  key={m.rowId}
                  className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        value={m.name}
                        onChange={(e) => setMethod(m.rowId, { name: e.target.value })}
                        placeholder="Method name"
                        disabled={pending}
                        aria-label="Method name"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      aria-label="Remove method"
                      disabled={pending || form.methods.length === 1}
                      onClick={() => removeMethod(m.rowId)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <SelectField
                      value={m.kind}
                      onChange={(v) =>
                        setMethod(m.rowId, { kind: (v ?? 'flat') as MethodRow['kind'] })
                      }
                      options={METHOD_KIND_OPTIONS}
                      disabled={pending}
                      aria-label="Method kind"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={m.rate}
                      onChange={(e) => setMethod(m.rowId, { rate: e.target.value })}
                      placeholder="Rate"
                      disabled={pending}
                      aria-label="Rate"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={m.freeAboveSubtotal}
                      onChange={(e) =>
                        setMethod(m.rowId, { freeAboveSubtotal: e.target.value })
                      }
                      placeholder="Free above"
                      disabled={pending || m.kind !== 'free_above'}
                      aria-label="Free above subtotal"
                    />
                  </div>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  iconLeft={Plus}
                  disabled={pending}
                  onClick={addMethod}
                >
                  Add method
                </Button>
              </div>
            </fieldset>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? 'Save changes' : 'Create zone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface ShippingClientProps {
  initialRows: SabcrmShippingZoneListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmShippingZoneKpis | null;
}

export function ShippingClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: ShippingClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] =
    React.useState<SabcrmShippingZoneListRow | null>(null);

  const rowsRef = React.useRef<SabcrmShippingZoneListRow[]>(initialRows);

  const editId = searchParams.get('edit');
  React.useEffect(() => {
    if (!editId) return;
    const row = rowsRef.current.find((r) => r.id === editId);
    if (row) {
      setEditing(row);
      setDialogOpen(true);
    }
    router.replace(pathname, { scroll: false });
  }, [editId, pathname, router]);

  const config = React.useMemo<DocListPageConfig<SabcrmShippingZoneListRow>>(
    () => ({
      title: 'Shipping zones',
      description:
        'Geographic delivery zones and their rate methods per storefront.',
      icon: Truck,
      entity: { singular: 'shipping zone', plural: 'shipping zones' },
      columns: COLUMNS,
      statuses: SHIPPING_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmShippingZonesPage(toShippingFilters(filters));
        if (res.ok) rowsRef.current = res.data.rows;
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmShippingZoneRows(toShippingFilters(filters)),
      csvFileName: 'shipping-zones.csv',
      rowHref: (row) => `${SHIPPING_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) => `shipping zone ${row.name}`,
      partyFilter: {
        placeholder: 'Any storefront',
        search: async (q) => {
          const res = await searchSabcrmStorefronts(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected shipping zones?',
            description:
              'Archived zones stop applying at checkout; their config is preserved.',
            actionLabel: 'Archive zones',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await archiveSabcrmShippingZone(row.id);
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
        label="Active zones"
        icon={Truck}
        value={String(kpis.activeCount)}
        delta={`of ${kpis.count} total`}
        deltaTone={kpis.activeCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Methods"
        icon={Truck}
        value={String(kpis.methodsTotal)}
        delta="Across all zones"
      />
      <KpiCard
        label="Countries covered"
        icon={Globe}
        value={String(kpis.countriesCovered)}
        delta="Unique ISO-2 codes"
      />
      <KpiCard
        label="Total zones"
        icon={Truck}
        value={String(kpis.count)}
        delta={kpis.sampled ? 'Sampled' : 'All-time'}
      />
    </>
  ) : null;

  const handleDone = (): void => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  };

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            New zone
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <ShippingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onDone={handleDone}
      />
    </>
  );
}
