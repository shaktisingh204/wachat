'use client';

import { use, useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Repeat,
  ArrowLeft,
  Play,
  Pause,
  StopCircle,
  Zap,
  LoaderCircle,
  Trash2,
} from 'lucide-react';

import { ClayBadge, ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

import {
  getRecurringExpenseById,
  pauseRecurringExpense,
  resumeRecurringExpense,
  stopRecurringExpense,
  runRecurringExpenseNow,
  deleteRecurringExpense,
} from '@/app/actions/worksuite/billing.actions';
import type { WsRecurringExpense } from '@/lib/worksuite/billing-types';

type Row = WsRecurringExpense & { _id: string };

const STATUS_TONES: Record<string, 'green' | 'amber' | 'red'> = {
  active: 'green',
  paused: 'amber',
  stopped: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: number | undefined, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(n || 0);
  } catch {
    return `${currency} ${n || 0}`;
  }
}

export default function RecurringExpenseDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const router = useRouter();
  const { toast } = useToast();
  const [doc, setDoc] = useState<Row | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isMutating, startMutating] = useTransition();

  const load = useCallback(() => {
    startLoading(async () => {
      const d = await getRecurringExpenseById(id);
      setDoc(d as unknown as Row | null);
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handle = (
    fn: () => Promise<{ message?: string; error?: string; expenseId?: string }>,
    successTitle: string,
  ) => {
    startMutating(async () => {
      const res = await fn();
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: successTitle,
        description: res.message || 'Done.',
      });
      load();
    });
  };

  const handleDelete = () => {
    if (!confirm('Delete this recurring expense? This cannot be undone.')) return;
    startMutating(async () => {
      const r = await deleteRecurringExpense(id);
      if (r.success) {
        toast({ title: 'Deleted', description: 'Recurring expense removed.' });
        router.push('/dashboard/crm/purchases/recurring-expenses');
      } else {
        toast({
          title: 'Error',
          description: r.error || 'Failed to delete',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading && !doc) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Not found"
          subtitle="The recurring expense does not exist."
          icon={Repeat}
        />
        <Link href="/dashboard/crm/purchases/recurring-expenses">
          <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
            Back
          </ClayButton>
        </Link>
      </div>
    );
  }

  const generated = Array.isArray((doc as any).generated_expense_ids)
    ? ((doc as any).generated_expense_ids as unknown[])
    : [];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={doc.name || 'Recurring Expense'}
        subtitle={`Every ${doc.frequency_count} ${doc.frequency} · next on ${fmtDate(doc.next_run_date)}`}
        icon={Repeat}
        actions={
          <>
            <Link href="/dashboard/crm/purchases/recurring-expenses">
              <ClayButton
                variant="pill"
                leading={<ArrowLeft className="h-4 w-4" />}
              >
                Back
              </ClayButton>
            </Link>
            <ClayButton
              variant="obsidian"
              disabled={isMutating || doc.status === 'stopped'}
              onClick={() =>
                handle(() => runRecurringExpenseNow(id), 'Expense recorded')
              }
              leading={
                isMutating ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )
              }
            >
              Run now
            </ClayButton>
            {doc.status === 'active' ? (
              <ClayButton
                variant="pill"
                onClick={() => handle(() => pauseRecurringExpense(id), 'Paused')}
                disabled={isMutating}
                leading={<Pause className="h-4 w-4" />}
              >
                Pause
              </ClayButton>
            ) : doc.status === 'paused' ? (
              <ClayButton
                variant="pill"
                onClick={() => handle(() => resumeRecurringExpense(id), 'Resumed')}
                disabled={isMutating}
                leading={<Play className="h-4 w-4" />}
              >
                Resume
              </ClayButton>
            ) : null}
            {doc.status !== 'stopped' ? (
              <ClayButton
                variant="pill"
                onClick={() => handle(() => stopRecurringExpense(id), 'Stopped')}
                disabled={isMutating}
                leading={<StopCircle className="h-4 w-4" />}
              >
                Stop
              </ClayButton>
            ) : null}
            <ClayButton
              variant="pill"
              onClick={handleDelete}
              disabled={isMutating}
              leading={<Trash2 className="h-4 w-4" />}
            >
              Delete
            </ClayButton>
          </>
        }
      />

      <ClayCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-clay-ink-muted">
              Status
            </p>
            <ClayBadge tone={STATUS_TONES[doc.status] || 'neutral'} dot>
              {doc.status}
            </ClayBadge>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wide text-clay-ink-muted">
              Runs
            </p>
            <p className="text-[15px] font-medium text-clay-ink">
              {doc.run_count || 0}
              {doc.stop_at_count ? ` / ${doc.stop_at_count}` : ''}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wide text-clay-ink-muted">
              Last Run
            </p>
            <p className="text-[15px] font-medium text-clay-ink">
              {fmtDate(doc.last_run_date)}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wide text-clay-ink-muted">
              Amount
            </p>
            <p className="text-[18px] font-semibold text-clay-ink">
              {fmtMoney(doc.amount, doc.currency)}
            </p>
          </div>
        </div>
      </ClayCard>

      <ClayCard>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-clay-ink">Vendor</h3>
            <p className="text-[13px] text-clay-ink-muted">{doc.vendor || '—'}</p>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-clay-ink">Category</h3>
            <p className="text-[13px] text-clay-ink-muted">
              {doc.category_name || '—'}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-clay-ink">
              Payment Method
            </h3>
            <p className="text-[13px] text-clay-ink-muted">
              {doc.payment_method || '—'}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-clay-ink">
              Start Date
            </h3>
            <p className="text-[13px] text-clay-ink-muted">
              {fmtDate(doc.start_date)}
            </p>
          </div>
          {doc.notes ? (
            <div className="md:col-span-2">
              <h3 className="mb-2 text-[13px] font-semibold text-clay-ink">Notes</h3>
              <p className="whitespace-pre-wrap text-[13px] text-clay-ink-muted">
                {doc.notes}
              </p>
            </div>
          ) : null}
        </div>
      </ClayCard>

      <ClayCard>
        <h2 className="mb-3 text-[15px] font-semibold text-clay-ink">
          Generated Expenses
        </h2>
        {generated.length === 0 ? (
          <p className="text-[13px] text-clay-ink-muted">
            No expenses generated yet. Click <em>Run now</em> to record one.
          </p>
        ) : (
          <ul className="space-y-1 text-[13px] text-clay-ink">
            {generated.map((exp, i) => (
              <li key={i} className="font-mono">
                {String(exp)}
              </li>
            ))}
          </ul>
        )}
      </ClayCard>
    </div>
  );
}
