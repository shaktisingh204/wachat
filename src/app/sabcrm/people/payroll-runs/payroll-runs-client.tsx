'use client';

/**
 * SabCRM People — Payroll runs list client
 * (`/sabcrm/people/payroll-runs`, WI-32).
 *
 * Doc-surface adopter for the payroll spine: KPI strip (FY net / last
 * run / headcount paid / next pay date), config-driven list (period
 * search + status + period-from date range, server pagination, CSV
 * export, draft bulk delete) and a create dialog carrying the FULL
 * `CreatePayrollRunInput` field set — periodFrom★, periodTo★, payDate,
 * lockDate, bankFileFormat.
 *
 * Money cells render engine-computed totals only (risk R8 — never
 * re-derived client-side). Creating a run lands on its detail page,
 * where the compute → approve → disburse → payslips lifecycle lives.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CalendarClock,
  IndianRupee,
  Plus,
  Trash2,
  Users,
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
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocDate,
  formatDocMoney,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';
import {
  PAYROLL_RUN_BANK_FILE_FORMATS,
  PAYROLL_RUN_STATUSES,
  bankFileFormatLabel,
  payrollRunDetailHref,
  toPayrollRunFilters,
} from './payroll-runs-config';

import {
  createSabcrmPayrollRun,
  deleteSabcrmPayrollRun,
  exportSabcrmPayrollRunRows,
  listSabcrmPayrollRunsPage,
} from '@/app/actions/sabcrm-people-payroll-runs.actions';
import type {
  SabcrmPayrollRunFormInput,
  SabcrmPayrollRunKpis,
  SabcrmPayrollRunListRow,
} from '@/app/actions/sabcrm-people-payroll-runs.actions.types';
import type { CrmPayrollRunBankFileFormat } from '@/lib/rust-client/crm-payroll-runs';

/* ─── Columns (full PayrollRun list coverage per WI-32) ───────── */

const COLUMNS: DocListColumn<SabcrmPayrollRunListRow>[] = [
  {
    key: 'period',
    header: 'Period',
    kind: 'text',
    value: (r) => r.periodLabel,
  },
  { key: 'payDate', header: 'Pay date', kind: 'date', value: (r) => r.payDate ?? undefined },
  { key: 'lockDate', header: 'Lock date', kind: 'date', value: (r) => r.lockDate ?? undefined },
  {
    key: 'employees',
    header: 'Employees',
    kind: 'text',
    align: 'right',
    value: (r) => (r.employeeCount > 0 ? String(r.employeeCount) : null),
  },
  {
    key: 'gross',
    header: 'Gross',
    kind: 'money',
    value: (r) => r.gross,
    currency: (r) => r.currency,
  },
  {
    key: 'net',
    header: 'Net',
    kind: 'money',
    value: (r) => r.net,
    currency: (r) => r.currency,
  },
  {
    key: 'ctc',
    header: 'CTC',
    kind: 'money',
    value: (r) => r.ctc,
    currency: (r) => r.currency,
  },
  {
    key: 'bankFileFormat',
    header: 'Bank file',
    kind: 'badge',
    value: (r) => bankFileFormatLabel(r.bankFileFormat ?? undefined),
    tone: () => 'info',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Create dialog (full CreatePayrollRunInput) ──────────────── */

const FORMAT_OPTIONS: SelectOption[] = [
  { value: '', label: 'Not set' },
  ...PAYROLL_RUN_BANK_FILE_FORMATS.map((f) => ({
    value: f.value,
    label: f.label,
  })),
];

/** First/last day of the current month as `YYYY-MM-DD` (local). */
function currentMonthBounds(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(last)}`,
  };
}

interface RunCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string, periodLabel: string) => void;
}

function RunCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: RunCreateDialogProps): React.JSX.Element {
  const bounds = currentMonthBounds();
  const [periodFrom, setPeriodFrom] = React.useState(bounds.from);
  const [periodTo, setPeriodTo] = React.useState(bounds.to);
  const [payDate, setPayDate] = React.useState('');
  const [lockDate, setLockDate] = React.useState('');
  const [bankFileFormat, setBankFileFormat] = React.useState<string | null>('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    const b = currentMonthBounds();
    setPeriodFrom(b.from);
    setPeriodTo(b.to);
    setPayDate('');
    setLockDate('');
    setBankFileFormat('');
    setErrors({});
    setFormError(null);
  }, [open]);

  const submit = (): void => {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!periodFrom) next.periodFrom = 'Period start is required.';
    if (!periodTo) next.periodTo = 'Period end is required.';
    if (periodFrom && periodTo && periodTo < periodFrom) {
      next.periodTo = 'Period end must be after the start.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: SabcrmPayrollRunFormInput = {
      periodFrom,
      periodTo,
      payDate: payDate || undefined,
      lockDate: lockDate || undefined,
      bankFileFormat: (bankFileFormat || '') as
        | CrmPayrollRunBankFileFormat
        | '',
    };
    startTransition(async () => {
      const res = await createSabcrmPayrollRun(input);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(`Payroll run ${res.data.periodLabel} created.`);
      onOpenChange(false);
      onCreated(res.data.id, res.data.periodLabel);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="run-create-desc">
        <DialogHeader>
          <DialogTitle>New payroll run</DialogTitle>
          <DialogDescription id="run-create-desc">
            Define the pay period. Compute, approval and disbursal happen on
            the run&apos;s detail page once it exists.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Period start" required error={errors.periodFrom}>
              <Input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                disabled={pending}
                autoFocus
              />
            </Field>
            <Field label="Period end" required error={errors.periodTo}>
              <Input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Pay date" help="When salaries hit employee accounts.">
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field
              label="Lock date"
              help="Attendance/leave edits after this date don't affect the run."
            >
              <Input
                type="date"
                value={lockDate}
                onChange={(e) => setLockDate(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Bank file format">
              <SelectField
                value={bankFileFormat}
                onChange={setBankFileFormat}
                options={FORMAT_OPTIONS}
                disabled={pending}
                aria-label="Bank file format"
              />
            </Field>
            {formError ? (
              <Alert tone="danger" role="alert">
                {formError}
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
              Create run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── List client ─────────────────────────────────────────────── */

export interface PayrollRunsClientProps {
  initialRows: SabcrmPayrollRunListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmPayrollRunKpis | null;
  initialFilters?: Partial<DocListFilters>;
}

export function PayrollRunsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
}: PayrollRunsClientProps): React.JSX.Element {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmPayrollRunListRow>>(
    () => ({
      title: 'Payroll runs',
      description:
        'Pay-period batches — compute the roster, approve, disburse and generate payslips.',
      icon: Banknote,
      entity: { singular: 'payroll run', plural: 'payroll runs' },
      columns: COLUMNS,
      statuses: PAYROLL_RUN_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPayrollRunsPage(toPayrollRunFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmPayrollRunRows(toPayrollRunFilters(filters)),
      csvFileName: 'payroll-runs.csv',
      rowHref: (row) => payrollRunDetailHref(row.id),
      rowLabel: (row) => `payroll run ${row.periodLabel}`,
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete drafts',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected draft runs?',
            description:
              'Only draft runs are deleted — computed, approved or disbursed runs are skipped. This action cannot be undone.',
            actionLabel: 'Delete drafts',
          },
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'draft');
            if (drafts.length === 0) {
              return {
                ok: false,
                error: 'Only draft payroll runs can be deleted.',
              };
            }
            for (const row of drafts) {
              const res = await deleteSabcrmPayrollRun(row.id);
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
        label="Net paid this FY"
        icon={IndianRupee}
        value={formatDocMoney(kpis.fyNetTotal, kpis.currency)}
        delta={`Across ${kpis.runCount} ${kpis.runCount === 1 ? 'run' : 'runs'}`}
      />
      <KpiCard
        label="Last run net"
        icon={Banknote}
        value={formatDocMoney(kpis.lastRunNet, kpis.currency)}
        delta={kpis.lastRunLabel ?? 'No computed run yet'}
      />
      <KpiCard
        label="Headcount paid"
        icon={Users}
        value={String(kpis.headcountPaid)}
        delta="In the latest disbursed run"
      />
      <KpiCard
        label="Next pay date"
        icon={CalendarClock}
        value={kpis.nextPayDate ? formatDocDate(kpis.nextPayDate) : '—'}
        delta={kpis.nextPayDate ? 'Upcoming run scheduled' : 'Nothing scheduled'}
        deltaTone={kpis.nextPayDate ? 'up' : 'neutral'}
      />
    </>
  ) : null;

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setCreateOpen(true)}
          >
            New payroll run
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
        initialFilters={initialFilters}
      />
      <RunCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setRefreshToken((t) => t + 1);
          router.push(payrollRunDetailHref(id));
        }}
      />
    </>
  );
}
