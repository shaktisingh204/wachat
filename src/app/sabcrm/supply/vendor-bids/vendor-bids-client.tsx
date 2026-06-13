'use client';

/**
 * SabCRM Supply — Vendor bids list client
 * (`/sabcrm/supply/vendor-bids`), rollout WI-9.
 *
 * Document adopter of the doc-surface kit: KPI strip (bids / submitted
 * / shortlisted / awarded value), the config-driven DocListPage (full
 * columns, search + status + vendor + date-range filters, server
 * pagination, CSV export, bulk delete) and a FULL-field BESPOKE drawer
 * — DocForm hard-requires a document number, and bids carry none.
 *
 * The bespoke drawer renders: RFQ picker, vendor picker, currency, a
 * priced `BidLinesEditor` (item picker, qty, rate, per-line lead time +
 * notes — `LineItemsEditor` has no lead-time/notes columns), terms.
 * Totals are recomputed server-side; the drawer shows a live preview.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Gavel,
  HandCoins,
  ListChecks,
  Plus,
  Star,
  Trash2,
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
  IconButton,
  Input,
  SelectField,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  EntityPicker,
  formatDocMoney,
  type DocEntityOption,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  BID_STATUSES,
  toBidFilters,
  vendorBidDetailHref,
} from './vendor-bids-config';

import {
  createSabcrmSupplyVendorBidFull,
  exportSabcrmSupplyVendorBidRows,
  listSabcrmSupplyVendorBidsPage,
  updateSabcrmSupplyVendorBidFull,
} from '@/app/actions/sabcrm-supply-vendor-bids.actions';
import {
  searchSabcrmSupplyItemOptions,
  searchSabcrmSupplyRfqs,
  searchSabcrmSupplyVendors,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { deleteSabcrmSupplyVendorBid } from '@/app/actions/sabcrm-supply.actions';
import type {
  SabcrmBidFullInput,
  SabcrmBidKpis,
  SabcrmBidLineInput,
  SabcrmBidListRow,
} from '@/app/actions/sabcrm-supply-vendor-bids.actions.types';

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

/* ─── Columns (full field coverage on the list) ───────────────── */

const COLUMNS: DocListColumn<SabcrmBidListRow>[] = [
  { key: 'rfq', header: 'RFQ', kind: 'party', value: (r) => r.rfqLabel },
  { key: 'vendor', header: 'Vendor', kind: 'party', value: (r) => r.vendorLabel },
  {
    key: 'submittedAt',
    header: 'Submitted',
    kind: 'date',
    value: (r) => r.submittedAt,
  },
  {
    key: 'leadTime',
    header: 'Lead time',
    kind: 'text',
    align: 'right',
    value: (r) => (r.leadTimeDays != null ? `${r.leadTimeDays} d` : '—'),
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
  {
    key: 'total',
    header: 'Total',
    kind: 'money',
    value: (r) => r.total,
    currency: (r) => r.currency,
  },
];

/* ─── Drawer types ────────────────────────────────────────────── */

interface BidLineDraft extends SabcrmBidLineInput {
  rowId: string;
}

interface BidFormState {
  rfqId: string;
  rfqLabel: string;
  vendorId: string;
  vendorLabel: string;
  currency: string | null;
  terms: string;
  lines: BidLineDraft[];
}

/** Bid seed (passed from the detail-client edit). */
export interface BidFormSeed {
  id: string;
  rfqId: string;
  rfqLabel: string;
  vendorId: string;
  vendorLabel: string;
  currency: string;
  terms: string;
  lines: SabcrmBidLineInput[];
}

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `bl-${rowSeq}`;
}

function blankBidLine(): BidLineDraft {
  return {
    rowId: nextRowId(),
    itemId: '',
    itemLabel: '',
    qty: 1,
    rate: 0,
    leadTimeDays: undefined,
    notes: '',
  };
}

function emptyForm(): BidFormState {
  return {
    rfqId: '',
    rfqLabel: '',
    vendorId: '',
    vendorLabel: '',
    currency: 'INR',
    terms: '',
    lines: [blankBidLine()],
  };
}

function seedToForm(seed: BidFormSeed): BidFormState {
  return {
    rfqId: seed.rfqId,
    rfqLabel: seed.rfqLabel,
    vendorId: seed.vendorId,
    vendorLabel: seed.vendorLabel,
    currency: seed.currency || 'INR',
    terms: seed.terms,
    lines:
      seed.lines.length > 0
        ? seed.lines.map((l) => ({ ...l, rowId: nextRowId() }))
        : [blankBidLine()],
  };
}

function formToInput(form: BidFormState): SabcrmBidFullInput {
  return {
    rfqId: form.rfqId,
    vendorId: form.vendorId,
    vendorName: form.vendorLabel || undefined,
    currency: form.currency ?? 'INR',
    terms: form.terms,
    lines: form.lines
      .filter((l) => l.qty > 0 || l.rate > 0)
      .map((l) => ({
        itemId: l.itemId || undefined,
        itemLabel: l.itemLabel,
        qty: l.qty,
        rate: l.rate,
        leadTimeDays: l.leadTimeDays,
        notes: l.notes,
      })),
  };
}

/* ─── Bid lines editor (qty + rate + lead time + notes) ──────── */

interface BidLinesEditorProps {
  lines: BidLineDraft[];
  currency: string;
  onChange: (lines: BidLineDraft[]) => void;
  disabled?: boolean;
}

function BidLinesEditor({
  lines,
  currency,
  onChange,
  disabled,
}: BidLinesEditorProps): React.JSX.Element {
  const patchLine = (rowId: string, p: Partial<BidLineDraft>): void =>
    onChange(lines.map((l) => (l.rowId === rowId ? { ...l, ...p } : l)));

  const searchItems = async (q: string): Promise<DocEntityOption[]> => {
    const res = await searchSabcrmSupplyItemOptions(q);
    return res.ok ? res.data : [];
  };

  const grandTotal = lines.reduce(
    (s, l) => s + (l.qty || 0) * (l.rate || 0),
    0,
  );

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line) => (
        <div
          key={line.rowId}
          className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
        >
          <div className="grid grid-cols-[1fr_4.5rem_6rem] gap-2">
            <EntityPicker
              value={line.itemId || null}
              valueLabel={line.itemLabel || null}
              search={searchItems}
              placeholder="Search items…"
              disabled={disabled}
              aria-label="Item"
              onChange={(opt) =>
                patchLine(line.rowId, {
                  itemId: opt?.id ?? '',
                  itemLabel: opt?.label ?? '',
                })
              }
            />
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={String(line.qty ?? '')}
              onChange={(e) =>
                patchLine(line.rowId, { qty: Number(e.target.value) || 0 })
              }
              placeholder="Qty"
              aria-label="Quantity"
              disabled={disabled}
            />
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={String(line.rate ?? '')}
              onChange={(e) =>
                patchLine(line.rowId, { rate: Number(e.target.value) || 0 })
              }
              placeholder="Rate"
              aria-label="Rate"
              disabled={disabled}
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={
                line.leadTimeDays === undefined ? '' : String(line.leadTimeDays)
              }
              onChange={(e) =>
                patchLine(line.rowId, {
                  leadTimeDays:
                    e.target.value === ''
                      ? undefined
                      : Math.max(0, Number(e.target.value) || 0),
                })
              }
              placeholder="Lead days"
              aria-label="Lead time in days"
              disabled={disabled}
              className="w-28"
            />
            <Input
              value={line.notes ?? ''}
              onChange={(e) => patchLine(line.rowId, { notes: e.target.value })}
              placeholder="Notes (optional)"
              aria-label="Line notes"
              disabled={disabled}
            />
            <span className="ml-auto whitespace-nowrap text-sm font-medium tabular-nums">
              {formatDocMoney((line.qty || 0) * (line.rate || 0), currency)}
            </span>
            <IconButton
              icon={X}
              label="Remove line"
              variant="ghost"
              disabled={disabled || lines.length <= 1}
              onClick={() =>
                onChange(lines.filter((l) => l.rowId !== line.rowId))
              }
            />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          iconLeft={Plus}
          disabled={disabled}
          onClick={() => onChange([...lines, blankBidLine()])}
        >
          Add line
        </Button>
        <span className="text-sm font-semibold tabular-nums">
          Total {formatDocMoney(grandTotal, currency)}
        </span>
      </div>
    </div>
  );
}

/* ─── Bid drawer (exported for the detail-client edit) ────────── */

export interface BidDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null ⇒ create; a seed ⇒ edit. */
  seed: BidFormSeed | null;
  /** Optional prefill (e.g. opened from an RFQ). */
  prefill?: Partial<BidFormState>;
  onDone: () => void;
}

export function BidDrawer({
  open,
  onOpenChange,
  seed,
  prefill,
  onDone,
}: BidDrawerProps): React.JSX.Element {
  const [form, setForm] = React.useState<BidFormState>(emptyForm());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(seed ? seedToForm(seed) : { ...emptyForm(), ...prefill });
    setError(null);
  }, [open, seed, prefill]);

  const patch = (p: Partial<BidFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const submit = (): void => {
    if (!form.rfqId) {
      setError('Pick the RFQ this bid responds to.');
      return;
    }
    if (!form.vendorId) {
      setError('Pick the vendor submitting this bid.');
      return;
    }
    if (form.lines.every((l) => l.qty <= 0 && l.rate <= 0)) {
      setError('Add at least one priced line.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const input = formToInput(form);
      const res = seed
        ? await updateSabcrmSupplyVendorBidFull(seed.id, {
            currency: input.currency,
            lines: input.lines,
            terms: input.terms,
            vendorName: input.vendorName,
          })
        : await createSabcrmSupplyVendorBidFull(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        seed ? 'Bid updated.' : `Bid from ${form.vendorLabel || 'vendor'} saved.`,
      );
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      side="right"
    >
      <DrawerContent aria-describedby="bid-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>{seed ? 'Edit bid' : 'New vendor bid'}</DrawerTitle>
          <DrawerDescription id="bid-desc">
            {seed
              ? 'Update the priced lines and terms. The RFQ and vendor stay fixed.'
              : 'Capture a vendor’s priced response to an RFQ. Totals are computed from the lines.'}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <Field label="RFQ" required>
                <EntityPicker
                  value={form.rfqId || null}
                  valueLabel={form.rfqLabel || null}
                  search={async (q) => {
                    const res = await searchSabcrmSupplyRfqs(q);
                    return res.ok ? res.data : [];
                  }}
                  placeholder="Search RFQs…"
                  disabled={pending || !!seed}
                  onChange={(opt) =>
                    patch({
                      rfqId: opt?.id ?? '',
                      rfqLabel: opt?.label ?? '',
                    })
                  }
                />
              </Field>
              <Field label="Vendor" required>
                <EntityPicker
                  value={form.vendorId || null}
                  valueLabel={form.vendorLabel || null}
                  search={async (q) => {
                    const res = await searchSabcrmSupplyVendors(q);
                    return res.ok ? res.data : [];
                  }}
                  placeholder="Search vendors…"
                  disabled={pending || !!seed}
                  onChange={(opt) =>
                    patch({
                      vendorId: opt?.id ?? '',
                      vendorLabel: opt?.label ?? '',
                    })
                  }
                />
              </Field>
            </div>

            <Field label="Currency" required>
              <SelectField
                value={form.currency}
                onChange={(v) => patch({ currency: v ?? 'INR' })}
                options={CURRENCY_OPTIONS}
                disabled={pending}
              />
            </Field>

            <Field label="Priced lines" required>
              <BidLinesEditor
                lines={form.lines}
                currency={form.currency ?? 'INR'}
                onChange={(lines) => patch({ lines })}
                disabled={pending}
              />
            </Field>

            <Field label="Terms">
              <Textarea
                value={form.terms}
                onChange={(e) => patch({ terms: e.target.value })}
                rows={3}
                placeholder="Prices valid 30 days. Payment 50% advance."
                disabled={pending}
              />
            </Field>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>

          <DrawerFooter>
            <Button
              type="button"
              variant="ghost"
              iconLeft={X}
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {seed ? 'Save changes' : 'Save bid'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface VendorBidsClientProps {
  initialRows: SabcrmBidListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmBidKpis | null;
}

export function VendorBidsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: VendorBidsClientProps): React.JSX.Element {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmBidListRow>>(
    () => ({
      title: 'Vendor bids',
      description:
        'Priced vendor responses to your RFQs — shortlist, award and turn the winner into a purchase order.',
      icon: Gavel,
      entity: { singular: 'bid', plural: 'bids' },
      columns: COLUMNS,
      statuses: BID_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyVendorBidsPage(toBidFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyVendorBidRows(toBidFilters(filters)),
      csvFileName: 'vendor-bids.csv',
      rowHref: (row) => vendorBidDetailHref(row.id),
      rowLabel: (row) => `bid from ${row.vendorLabel ?? 'vendor'}`,
      partyFilter: {
        placeholder: 'Any vendor',
        search: async (q) => {
          const res = await searchSabcrmSupplyVendors(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected bids?',
            description:
              'This permanently removes them. Awarded bids that already produced a PO keep that PO.',
            actionLabel: 'Delete bids',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyVendorBid(row.id);
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
        label="Bids"
        icon={Gavel}
        value={String(kpis.count)}
        delta={kpis.sampled ? 'Sampled (latest 500)' : 'In this workspace'}
      />
      <KpiCard
        label="Awaiting review"
        icon={ListChecks}
        value={String(kpis.submittedCount)}
        delta="Submitted bids"
        deltaTone={kpis.submittedCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Shortlisted"
        icon={Star}
        value={String(kpis.shortlistedCount)}
        delta="Under consideration"
      />
      <KpiCard
        label="Awarded value"
        icon={HandCoins}
        value={formatDocMoney(kpis.awardedValue, kpis.currency)}
        delta={`${kpis.awardedCount} ${kpis.awardedCount === 1 ? 'bid' : 'bids'} awarded`}
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
            onClick={() => setDrawerOpen(true)}
          >
            New bid
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <BidDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        seed={null}
        onDone={handleDone}
      />
    </>
  );
}
