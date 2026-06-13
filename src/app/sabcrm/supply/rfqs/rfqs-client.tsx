'use client';

/**
 * SabCRM Supply — RFQs list client (`/sabcrm/supply/rfqs`), rollout
 * WI-8.
 *
 * Document adopter of the doc-surface kit: KPI strip (RFQs / open /
 * awarded / overdue), the config-driven DocListPage (full columns,
 * search + status + date-range filters, server pagination, CSV export,
 * bulk delete) and a FULL-field BESPOKE drawer — DocForm does not fit
 * RFQs (no party, no document number, and lines carry NO price).
 *
 * The bespoke drawer renders: title, required-by + bid-deadline dates,
 * terms, a multi-vendor invite section (repeated `EntityPicker` rows
 * over the vendors mount) and a no-rate `RfqLinesEditor` (item picker,
 * qty, unit, specs). Both create and edit share the drawer; edit is
 * seeded from `getSabcrmSupplyRfq` server-side.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  CalendarClock,
  FileQuestion,
  ListChecks,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  IconButton,
  Input,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  EntityPicker,
  type DocEntityOption,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import { RFQ_STATUSES, rfqDetailHref, toRfqFilters } from './rfqs-config';

import {
  createSabcrmSupplyRfqFull,
  exportSabcrmSupplyRfqRows,
  listSabcrmSupplyRfqsPage,
  updateSabcrmSupplyRfqFull,
} from '@/app/actions/sabcrm-supply-rfqs.actions';
import {
  searchSabcrmSupplyItemOptions,
  searchSabcrmSupplyVendors,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { deleteSabcrmSupplyRfq } from '@/app/actions/sabcrm-supply.actions';
import type {
  SabcrmRfqFullInput,
  SabcrmRfqKpis,
  SabcrmRfqLineInput,
  SabcrmRfqListRow,
} from '@/app/actions/sabcrm-supply-rfqs.actions.types';

/* ─── Columns (full field coverage on the list) ───────────────── */

const COLUMNS: DocListColumn<SabcrmRfqListRow>[] = [
  { key: 'title', header: 'Title', kind: 'text', value: (r) => r.title },
  {
    key: 'items',
    header: 'Items',
    kind: 'text',
    align: 'right',
    value: (r) => String(r.itemCount),
  },
  {
    key: 'requiredBy',
    header: 'Required by',
    kind: 'date',
    value: (r) => r.requiredBy,
  },
  {
    key: 'deadline',
    header: 'Bid deadline',
    kind: 'date',
    value: (r) => r.deadline,
  },
  {
    key: 'invited',
    header: 'Invited',
    kind: 'text',
    align: 'right',
    value: (r) => String(r.invitedCount),
  },
  {
    key: 'bids',
    header: 'Bids',
    kind: 'text',
    align: 'right',
    value: (r) => String(r.bidCount),
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
  { key: 'aging', header: 'Overdue', kind: 'aging', value: (r) => r.agingDays },
];

/* ─── Drawer types ────────────────────────────────────────────── */

/** A draft RFQ line with a stable row id + cached item label. */
interface RfqLineDraft extends SabcrmRfqLineInput {
  rowId: string;
}

/** A draft invite row (id + cached label for re-opened edits). */
interface InviteRow {
  rowId: string;
  vendorId: string;
  vendorLabel: string;
}

interface RfqFormState {
  title: string;
  requiredBy: string;
  deadline: string;
  terms: string;
  invites: InviteRow[];
  lines: RfqLineDraft[];
}

/** RFQ seed (passed from the detail-client edit, or the row on the list). */
export interface RfqFormSeed {
  id: string;
  title: string;
  requiredBy: string;
  deadline: string;
  terms: string;
  invites: { vendorId: string; vendorLabel: string }[];
  lines: SabcrmRfqLineInput[];
}

let rowSeq = 0;
function nextRowId(prefix: string): string {
  rowSeq += 1;
  return `${prefix}-${rowSeq}`;
}

function blankRfqLine(): RfqLineDraft {
  return {
    rowId: nextRowId('rl'),
    itemId: '',
    itemLabel: '',
    description: '',
    qty: 1,
    unit: '',
    specs: '',
  };
}

function emptyForm(): RfqFormState {
  return {
    title: '',
    requiredBy: '',
    deadline: '',
    terms: '',
    invites: [],
    lines: [blankRfqLine()],
  };
}

function seedToForm(seed: RfqFormSeed): RfqFormState {
  return {
    title: seed.title,
    requiredBy: seed.requiredBy.slice(0, 10),
    deadline: seed.deadline.slice(0, 10),
    terms: seed.terms,
    invites: seed.invites.map((v) => ({
      rowId: nextRowId('iv'),
      vendorId: v.vendorId,
      vendorLabel: v.vendorLabel,
    })),
    lines:
      seed.lines.length > 0
        ? seed.lines.map((l) => ({ ...l, rowId: nextRowId('rl') }))
        : [blankRfqLine()],
  };
}

function formToInput(form: RfqFormState, issue: boolean): SabcrmRfqFullInput {
  return {
    title: form.title,
    requiredBy: form.requiredBy || undefined,
    deadline: form.deadline || undefined,
    terms: form.terms,
    vendorsInvited: form.invites.map((i) => i.vendorId).filter(Boolean),
    lines: form.lines
      .filter((l) => l.itemId)
      .map((l) => ({
        itemId: l.itemId,
        itemLabel: l.itemLabel,
        description: l.description,
        qty: l.qty,
        unit: l.unit,
        specs: l.specs,
      })),
    issue,
  };
}

function keyToDate(key: string): Date | undefined {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function dateToKey(d: Date | undefined): string {
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ─── RFQ lines editor (no rate column) ───────────────────────── */

interface RfqLinesEditorProps {
  lines: RfqLineDraft[];
  onChange: (lines: RfqLineDraft[]) => void;
  disabled?: boolean;
}

function RfqLinesEditor({
  lines,
  onChange,
  disabled,
}: RfqLinesEditorProps): React.JSX.Element {
  const patchLine = (rowId: string, p: Partial<RfqLineDraft>): void =>
    onChange(lines.map((l) => (l.rowId === rowId ? { ...l, ...p } : l)));

  const searchItems = async (q: string): Promise<DocEntityOption[]> => {
    const res = await searchSabcrmSupplyItemOptions(q);
    return res.ok ? res.data : [];
  };

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line) => (
        <div
          key={line.rowId}
          className="grid grid-cols-[1fr_5rem_5rem] gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
        >
          <div className="col-span-3 grid grid-cols-[1fr_5rem_5rem] gap-2">
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
                  description: opt?.label ?? line.description,
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
              value={line.unit ?? ''}
              onChange={(e) => patchLine(line.rowId, { unit: e.target.value })}
              placeholder="Unit"
              aria-label="Unit"
              disabled={disabled}
            />
          </div>
          <div className="col-span-3 flex items-center gap-2">
            <Input
              value={line.specs ?? ''}
              onChange={(e) => patchLine(line.rowId, { specs: e.target.value })}
              placeholder="Specs / notes (optional)"
              aria-label="Specs"
              disabled={disabled}
            />
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
      <Button
        type="button"
        variant="ghost"
        iconLeft={Plus}
        disabled={disabled}
        onClick={() => onChange([...lines, blankRfqLine()])}
      >
        Add item
      </Button>
    </div>
  );
}

/* ─── Multi-vendor invite editor ──────────────────────────────── */

interface InviteEditorProps {
  invites: InviteRow[];
  onChange: (invites: InviteRow[]) => void;
  disabled?: boolean;
}

function InviteEditor({
  invites,
  onChange,
  disabled,
}: InviteEditorProps): React.JSX.Element {
  const searchVendors = async (q: string): Promise<DocEntityOption[]> => {
    const res = await searchSabcrmSupplyVendors(q);
    return res.ok ? res.data : [];
  };

  return (
    <div className="flex flex-col gap-2">
      {invites.map((row) => (
        <div key={row.rowId} className="flex items-center gap-2">
          <div className="flex-1">
            <EntityPicker
              value={row.vendorId || null}
              valueLabel={row.vendorLabel || null}
              search={searchVendors}
              placeholder="Search vendors to invite…"
              disabled={disabled}
              aria-label="Invited vendor"
              onChange={(opt) =>
                onChange(
                  invites.map((i) =>
                    i.rowId === row.rowId
                      ? {
                          ...i,
                          vendorId: opt?.id ?? '',
                          vendorLabel: opt?.label ?? '',
                        }
                      : i,
                  ),
                )
              }
            />
          </div>
          <IconButton
            icon={X}
            label="Remove vendor"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange(invites.filter((i) => i.rowId !== row.rowId))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        iconLeft={Plus}
        disabled={disabled}
        onClick={() =>
          onChange([
            ...invites,
            { rowId: nextRowId('iv'), vendorId: '', vendorLabel: '' },
          ])
        }
      >
        Invite a vendor
      </Button>
    </div>
  );
}

/* ─── RFQ drawer (exported for the detail-client edit) ────────── */

export interface RfqDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null ⇒ create; a seed ⇒ edit. */
  seed: RfqFormSeed | null;
  onDone: () => void;
}

export function RfqDrawer({
  open,
  onOpenChange,
  seed,
  onDone,
}: RfqDrawerProps): React.JSX.Element {
  const [form, setForm] = React.useState<RfqFormState>(emptyForm());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<false | 'draft' | 'issue'>(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(seed ? seedToForm(seed) : emptyForm());
    setError(null);
  }, [open, seed]);

  const patch = (p: Partial<RfqFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const submit = async (issue: boolean): Promise<void> => {
    if (!form.title.trim()) {
      setError('A title is required.');
      return;
    }
    if (form.lines.every((l) => !l.itemId)) {
      setError('Add at least one item to request.');
      return;
    }
    if (form.deadline && form.requiredBy && form.deadline > form.requiredBy) {
      setError('The bid deadline should be on or before the required-by date.');
      return;
    }
    setError(null);
    setPending(issue ? 'issue' : 'draft');
    try {
      const input = formToInput(form, issue);
      const res = seed
        ? await updateSabcrmSupplyRfqFull(seed.id, {
            title: input.title,
            lines: input.lines,
            requiredBy: input.requiredBy,
            deadline: input.deadline,
            vendorsInvited: input.vendorsInvited,
            terms: input.terms,
          })
        : await createSabcrmSupplyRfqFull(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        seed
          ? `${res.data.title} updated.`
          : issue
            ? `${res.data.title} opened for bidding.`
            : `${res.data.title} saved as draft.`,
      );
      onOpenChange(false);
      onDone();
    } finally {
      setPending(false);
    }
  };

  const busy = pending !== false;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      side="right"
    >
      <DrawerContent aria-describedby="rfq-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>{seed ? `Edit ${seed.title}` : 'New RFQ'}</DrawerTitle>
          <DrawerDescription id="rfq-desc">
            {seed
              ? 'Update the request. Invited vendors submit priced bids against it.'
              : 'Request quotations from vendors — add items, invite vendors and open it for bidding.'}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-1">
            <Field label="Title" required>
              <Input
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Q3 packaging materials"
                autoFocus
                disabled={busy}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Required by" help="When the goods are needed.">
                <DatePicker
                  value={keyToDate(form.requiredBy)}
                  onChange={(d) => patch({ requiredBy: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy}
                  aria-label="Required by"
                />
              </Field>
              <Field label="Bid deadline" help="Last date vendors can quote.">
                <DatePicker
                  value={keyToDate(form.deadline)}
                  onChange={(d) => patch({ deadline: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy}
                  aria-label="Bid deadline"
                />
              </Field>
            </div>

            <Field label="Items requested" required>
              <RfqLinesEditor
                lines={form.lines}
                onChange={(lines) => patch({ lines })}
                disabled={busy}
              />
            </Field>

            <Field
              label="Invite vendors"
              help="Vendors invited to submit a priced bid."
            >
              <InviteEditor
                invites={form.invites}
                onChange={(invites) => patch({ invites })}
                disabled={busy}
              />
            </Field>

            <Field label="Terms">
              <Textarea
                value={form.terms}
                onChange={(e) => patch({ terms: e.target.value })}
                rows={3}
                placeholder="Delivery within 2 weeks of award. Prices inclusive of freight."
                disabled={busy}
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
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              loading={pending === 'draft'}
              disabled={pending === 'issue'}
            >
              {seed ? 'Save changes' : 'Save draft'}
            </Button>
            {seed ? null : (
              <Button
                type="button"
                variant="primary"
                loading={pending === 'issue'}
                disabled={pending === 'draft'}
                onClick={() => void submit(true)}
              >
                Save &amp; open
              </Button>
            )}
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface RfqsClientProps {
  initialRows: SabcrmRfqListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmRfqKpis | null;
}

export function RfqsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: RfqsClientProps): React.JSX.Element {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmRfqListRow>>(
    () => ({
      title: 'RFQs',
      description:
        'Requests for quotation — invite vendors, collect priced bids and award the best.',
      icon: FileQuestion,
      entity: { singular: 'RFQ', plural: 'RFQs' },
      columns: COLUMNS,
      statuses: RFQ_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyRfqsPage(toRfqFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyRfqRows(toRfqFilters(filters)),
      csvFileName: 'rfqs.csv',
      rowHref: (row) => rfqDetailHref(row.id),
      rowLabel: (row) => `RFQ ${row.title}`,
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected RFQs?',
            description:
              'This permanently removes them. Bids already submitted keep their history.',
            actionLabel: 'Delete RFQs',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyRfq(row.id);
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
        label="RFQs"
        icon={FileQuestion}
        value={String(kpis.count)}
        delta={kpis.sampled ? 'Sampled (latest 500)' : 'In this workspace'}
      />
      <KpiCard
        label="Open"
        icon={ListChecks}
        value={String(kpis.openCount)}
        delta="Collecting bids"
        deltaTone={kpis.openCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Awarded"
        icon={Award}
        value={String(kpis.awardedCount)}
        delta="Converted to suppliers"
      />
      <KpiCard
        label="Overdue"
        icon={CalendarClock}
        value={String(kpis.overdueCount)}
        delta={kpis.overdueCount === 1 ? 'RFQ past deadline' : 'RFQs past deadline'}
        deltaTone={kpis.overdueCount > 0 ? 'down' : 'neutral'}
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
            New RFQ
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <RfqDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        seed={null}
        onDone={handleDone}
      />
    </>
  );
}
