'use client';

/**
 * SabCRM Finance — Recurring invoices client
 * (`/sabcrm/finance/recurring-invoices`).
 *
 * Doc-surface adopter (finance-rollout spec §3.11): KPI strip (active
 * schedules / due in 7 days / paused / lifetime runs), config-driven
 * list (resolved customer labels, frequency badges, next-run dates),
 * bulk Pause / Resume / Stop, CSV export and a FULL-field 20ui Dialog
 * form: title, REAL picked customer (no placeholder minting), the
 * "invoice to clone" reference picker, frequency, start/end dates,
 * status and notes.
 *
 * No detail route v1: a row click deep-links to `?edit=<id>` and opens
 * the edit dialog seeded from the row.
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  CircleStop,
  Pause,
  Play,
  Plus,
  Repeat,
} from 'lucide-react';

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
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  EntityPicker,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  RECURRING_FREQUENCIES,
  RECURRING_PATH,
  RECURRING_STATUSES,
  frequencyLabel,
  toRecurringFilters,
} from './recurring-invoice-config';

import {
  createSabcrmRecurringInvoiceFull,
  exportSabcrmRecurringInvoiceRows,
  listSabcrmRecurringInvoicesPage,
  transitionSabcrmRecurringInvoiceStatus,
  updateSabcrmRecurringInvoiceFull,
} from '@/app/actions/sabcrm-finance-recurring-invoices.actions';
import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import { searchSabcrmFinanceInvoiceRefs } from '@/app/actions/sabcrm-finance-pickers.actions';
import type {
  SabcrmRecurringInvoiceKpis,
  SabcrmRecurringInvoiceListRow,
} from '@/app/actions/sabcrm-finance-recurring-invoices.actions.types';
import type {
  CrmRecurringInvoiceFrequency,
  CrmRecurringInvoiceStatus,
} from '@/lib/rust-client/crm-recurring-invoices';

/* ─── Columns (full field coverage on the list) ───────────────── */

const COLUMNS: DocListColumn<SabcrmRecurringInvoiceListRow>[] = [
  {
    key: 'title',
    header: 'Schedule',
    kind: 'text',
    value: (r) => r.title || 'Untitled schedule',
  },
  {
    key: 'customer',
    header: 'Customer',
    kind: 'party',
    value: (r) => r.customerLabel,
  },
  {
    key: 'frequency',
    header: 'Frequency',
    kind: 'badge',
    value: (r) => frequencyLabel(r.frequency),
    tone: () => 'neutral',
  },
  {
    key: 'startDate',
    header: 'Starts',
    kind: 'date',
    value: (r) => r.startDate,
  },
  { key: 'endDate', header: 'Ends', kind: 'date', value: (r) => r.endDate },
  {
    key: 'nextRunAt',
    header: 'Next run',
    kind: 'date',
    value: (r) => r.nextRunAt,
  },
  {
    key: 'totalRuns',
    header: 'Runs',
    kind: 'text',
    align: 'right',
    value: (r) => String(r.totalRuns),
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
];

/* ─── Dialog form ─────────────────────────────────────────────── */

interface ScheduleFormState {
  title: string;
  customerId: string | null;
  customerLabel: string | null;
  invoiceTemplateId: string | null;
  invoiceTemplateLabel: string | null;
  frequency: string | null;
  startDate: string;
  endDate: string;
  status: string | null;
  notes: string;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyForm(): ScheduleFormState {
  return {
    title: '',
    customerId: null,
    customerLabel: null,
    invoiceTemplateId: null,
    invoiceTemplateLabel: null,
    frequency: 'monthly',
    startDate: todayKey(),
    endDate: '',
    status: 'active',
    notes: '',
  };
}

function rowToForm(row: SabcrmRecurringInvoiceListRow): ScheduleFormState {
  return {
    title: row.title,
    customerId: row.customerId || null,
    customerLabel: row.customerLabel,
    invoiceTemplateId: row.invoiceTemplateId,
    invoiceTemplateLabel: row.invoiceTemplateLabel,
    frequency: row.frequency || 'monthly',
    startDate: row.startDate.slice(0, 10),
    endDate: row.endDate.slice(0, 10),
    status: row.status,
    notes: row.notes,
  };
}

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null ⇒ create; a row ⇒ edit. */
  editing: SabcrmRecurringInvoiceListRow | null;
  onDone: () => void;
}

function ScheduleDialog({
  open,
  onOpenChange,
  editing,
  onDone,
}: ScheduleDialogProps): React.JSX.Element {
  const [form, setForm] = React.useState<ScheduleFormState>(emptyForm());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? rowToForm(editing) : emptyForm());
    setError(null);
  }, [open, editing]);

  const patch = (p: Partial<ScheduleFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const submit = (): void => {
    if (!form.customerId) {
      setError('Pick a customer for this schedule.');
      return;
    }
    if (!form.frequency) {
      setError('Pick a frequency.');
      return;
    }
    if (!form.startDate) {
      setError('A start date is required.');
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setError("The end date can't be before the start date.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload = {
        title: form.title || undefined,
        invoiceTemplateId: form.invoiceTemplateId ?? undefined,
        customerId: form.customerId as string,
        frequency: form.frequency as CrmRecurringInvoiceFrequency,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        status: (form.status ?? 'active') as CrmRecurringInvoiceStatus,
        notes: form.notes || undefined,
      };
      const res = editing
        ? await updateSabcrmRecurringInvoiceFull(editing.id, payload)
        : await createSabcrmRecurringInvoiceFull(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(editing ? 'Schedule updated.' : 'Schedule created.');
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="rinv-desc">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit recurring invoice' : 'New recurring invoice'}
          </DialogTitle>
          <DialogDescription id="rinv-desc">
            {editing
              ? 'Update the schedule. Already-generated invoices are unaffected.'
              : 'Generates an invoice for the customer on the chosen cadence.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Title" help="Shown in the list — e.g. “Monthly retainer”.">
              <Input
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Monthly retainer"
                autoFocus
                disabled={pending}
              />
            </Field>
            <Field label="Customer" required>
              <EntityPicker
                value={form.customerId}
                valueLabel={form.customerLabel}
                search={async (q) => {
                  const res = await searchSabcrmFinanceParties(q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Search companies & people…"
                disabled={pending}
                invalid={!!error && !form.customerId}
                onChange={(opt) =>
                  patch({
                    customerId: opt?.id ?? null,
                    customerLabel: opt?.label ?? null,
                  })
                }
              />
            </Field>
            <Field
              label="Invoice to clone"
              help="Each run copies this invoice's lines and totals."
            >
              <EntityPicker
                value={form.invoiceTemplateId}
                valueLabel={form.invoiceTemplateLabel}
                search={async (q) => {
                  const res = await searchSabcrmFinanceInvoiceRefs(q);
                  return res.ok ? res.data : [];
                }}
                placeholder="Search invoices…"
                disabled={pending}
                onChange={(opt) =>
                  patch({
                    invoiceTemplateId: opt?.id ?? null,
                    invoiceTemplateLabel: opt?.label ?? null,
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frequency" required>
                <SelectField
                  value={form.frequency}
                  onChange={(v) => patch({ frequency: v })}
                  options={RECURRING_FREQUENCIES.map((f) => ({
                    value: f.value,
                    label: f.label,
                  }))}
                  disabled={pending}
                />
              </Field>
              <Field label="Status">
                <SelectField
                  value={form.status}
                  onChange={(v) => patch({ status: v })}
                  options={RECURRING_STATUSES.filter(
                    (s) => editing || s.value === 'active' || s.value === 'paused',
                  ).map((s) => ({ value: s.value, label: s.label }))}
                  disabled={pending}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date" required>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => patch({ startDate: e.target.value })}
                  disabled={pending}
                  aria-label="Start date"
                />
              </Field>
              <Field label="End date" help="Leave empty to run indefinitely.">
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => patch({ endDate: e.target.value })}
                  disabled={pending}
                  aria-label="End date"
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={3}
                placeholder="Internal notes about this schedule."
                disabled={pending}
              />
            </Field>
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
              {editing ? 'Save changes' : 'Create schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface RecurringInvoicesClientProps {
  initialRows: SabcrmRecurringInvoiceListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmRecurringInvoiceKpis | null;
  /** Statements drill-down deep-link seed (parsed from searchParams). */
  initialFilters?: Partial<DocListFilters>;
}

export function RecurringInvoicesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
}: RecurringInvoicesClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] =
    React.useState<SabcrmRecurringInvoiceListRow | null>(null);

  const rowsRef = React.useRef<SabcrmRecurringInvoiceListRow[]>(initialRows);

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

  const config = React.useMemo<
    DocListPageConfig<SabcrmRecurringInvoiceListRow>
  >(
    () => ({
      title: 'Recurring invoices',
      description:
        'Invoice schedules — generate billing on a cadence, pause or stop any time.',
      icon: Repeat,
      entity: { singular: 'schedule', plural: 'schedules' },
      columns: COLUMNS,
      statuses: RECURRING_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmRecurringInvoicesPage(
          toRecurringFilters(filters),
        );
        if (res.ok) rowsRef.current = res.data.rows;
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmRecurringInvoiceRows(toRecurringFilters(filters)),
      csvFileName: 'recurring-invoices.csv',
      rowHref: (row) =>
        `${RECURRING_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) => `schedule ${row.title || row.id.slice(-8)}`,
      bulkActions: [
        {
          key: 'pause',
          label: 'Pause',
          icon: Pause,
          run: async (rows) => {
            const active = rows.filter((r) => r.status === 'active');
            if (active.length === 0) {
              return { ok: false, error: 'Only active schedules can be paused.' };
            }
            for (const row of active) {
              const res = await transitionSabcrmRecurringInvoiceStatus(
                row.id,
                'paused',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'resume',
          label: 'Resume',
          icon: Play,
          run: async (rows) => {
            const paused = rows.filter((r) => r.status === 'paused');
            if (paused.length === 0) {
              return {
                ok: false,
                error: 'Only paused schedules can be resumed.',
              };
            }
            for (const row of paused) {
              const res = await transitionSabcrmRecurringInvoiceStatus(
                row.id,
                'active',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'stop',
          label: 'Stop',
          icon: CircleStop,
          tone: 'danger',
          confirm: {
            title: 'Stop the selected schedules?',
            description:
              'Stopped schedules never run again — create a new schedule to restart billing.',
            actionLabel: 'Stop schedules',
          },
          run: async (rows) => {
            const stoppable = rows.filter(
              (r) => r.status === 'active' || r.status === 'paused',
            );
            if (stoppable.length === 0) {
              return {
                ok: false,
                error: 'Only active or paused schedules can be stopped.',
              };
            }
            for (const row of stoppable) {
              const res = await transitionSabcrmRecurringInvoiceStatus(
                row.id,
                'stopped',
              );
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
        label="Active schedules"
        icon={Repeat}
        value={String(kpis.activeCount)}
        delta={`of ${kpis.count} total`}
        deltaTone={kpis.activeCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Due in 7 days"
        icon={CalendarClock}
        value={String(kpis.dueIn7Days)}
        delta="Upcoming runs"
        deltaTone={kpis.dueIn7Days > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Paused"
        icon={Pause}
        value={String(kpis.pausedCount)}
        delta={kpis.pausedCount === 1 ? 'schedule on hold' : 'schedules on hold'}
        deltaTone={kpis.pausedCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Lifetime runs"
        icon={Play}
        value={String(kpis.lifetimeRuns)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} schedules`
            : 'Invoices generated'
        }
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
            New schedule
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
        initialFilters={initialFilters}
      />

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onDone={handleDone}
      />
    </>
  );
}
