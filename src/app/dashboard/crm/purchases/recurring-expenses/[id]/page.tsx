'use client';

import { Button, Card, Skeleton, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';
import { use,
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import {
  Pause,
  Pencil,
  Play,
  StopCircle,
  Trash2,
  Zap,
  } from 'lucide-react';

/**
 * Recurring expense detail — §1D thin slice.
 *
 * Shows: status pill + action group (Run now / Pause / Resume / Stop /
 * Delete), header card, vendor/category card, generated expenses
 * timeline (each entry links to the generated `crm_expenses` doc).
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  deleteRecurringExpense,
  getRecurringExpenseById,
  pauseRecurringExpense,
  resumeRecurringExpense,
  runRecurringExpenseNow,
  stopRecurringExpense,
} from '@/app/actions/worksuite/billing.actions';
import type { WsRecurringExpense } from '@/lib/worksuite/billing-types';

type Row = WsRecurringExpense & { _id: string };

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: number | undefined, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(n ?? 0);
  } catch {
    return `${currency} ${n ?? 0}`;
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
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    fn: () => Promise<{ message?: string; error?: string }>,
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
      toast({ title: successTitle, description: res.message || 'Done.' });
      load();
    });
  };

  const handleDelete = () => {
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
      <EntityListShell title="Not found" subtitle="The recurring expense does not exist.">
        <Button variant="outline" asChild>
          <Link href="/dashboard/crm/purchases/recurring-expenses">Back</Link>
        </Button>
      </EntityListShell>
    );
  }

  const generated = Array.isArray(doc.generated_expense_ids)
    ? doc.generated_expense_ids
    : [];

  return (
    <EntityDetailShell
      eyebrow="RECURRING EXPENSE"
      title={doc.name || 'Recurring expense'}
      subtitle={`Every ${doc.frequency_count} ${doc.frequency} · next on ${fmtDate(doc.next_run_date)}`}
      back={{ href: '/dashboard/crm/purchases/recurring-expenses', label: 'Recurring Expenses' }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={doc.status} tone={statusToTone(doc.status)} />
          <Button size="sm" variant="outline" asChild>
            <Link href={`/dashboard/crm/purchases/recurring-expenses/${id}/edit`}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() =>
              handle(() => runRecurringExpenseNow(id), 'Expense recorded')
            }
            disabled={isMutating || doc.status === 'stopped'}
          >
            <Zap className="h-3.5 w-3.5" /> Run now
          </Button>
          {doc.status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handle(() => pauseRecurringExpense(id), 'Paused')}
              disabled={isMutating}
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          ) : doc.status === 'paused' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handle(() => resumeRecurringExpense(id), 'Resumed')}
              disabled={isMutating}
            >
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          ) : null}
          {doc.status !== 'stopped' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handle(() => stopRecurringExpense(id), 'Stopped')}
              disabled={isMutating}
            >
              <StopCircle className="h-3.5 w-3.5" /> Stop
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={isMutating}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Runs
          </div>
          <div className="mt-1 text-[18px] font-semibold text-[var(--st-text)]">
            {doc.run_count || 0}
            {doc.stop_at_count ? ` / ${doc.stop_at_count}` : ''}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Last run
          </div>
          <div className="mt-1 text-[15px] font-medium text-[var(--st-text)]">
            {fmtDate(doc.last_run_date)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Next run
          </div>
          <div className="mt-1 text-[15px] font-medium text-[var(--st-text)]">
            {fmtDate(doc.next_run_date)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Amount
          </div>
          <div className="mt-1 text-[18px] font-semibold text-[var(--st-text)]">
            {fmtMoney(doc.amount, doc.currency)}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Schedule
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Vendor">{doc.vendor || '—'}</Field>
          <Field label="Category">{doc.category_name || '—'}</Field>
          <Field label="Start date">{fmtDate(doc.start_date)}</Field>
          <Field label="Until date">{fmtDate(doc.until_date)}</Field>
          <Field label="Payment method">{doc.payment_method || '—'}</Field>
          <Field label="Currency">{doc.currency || '—'}</Field>
          {doc.notes ? (
            <div className="md:col-span-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                Notes
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                {doc.notes}
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Generated expenses ({generated.length})
        </h3>
        {generated.length === 0 ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            No expenses generated yet. Click <em>Run now</em> to record one.
          </p>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {generated.map((expId, i) => (
              <li key={i}>
                <Link
                  href={`/dashboard/crm/purchases/expenses/${String(expId)}`}
                  className="font-mono text-[var(--st-text)] hover:underline"
                >
                  {String(expId)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this schedule?"
        description="The schedule is permanently removed. Already-generated expenses are not affected."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => handleDelete()}
      />
    </EntityDetailShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
    </div>
  );
}
