import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';

/**
 * Budget detail — `/dashboard/crm/budgets/[id]`.
 *
 * Per §1D.2: 8 actions, body cards (Overview · Allocation · Actual vs
 * Planned · Variance analysis · Notes), right rail with variance %,
 * owner/approver chips, scenario switcher.
 */

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getBudgetById } from '@/app/actions/crm-budgets.actions';

import { BudgetDetailActions } from '../_components/budget-detail-actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

type BudgetDoc = {
  _id: string;
  budgetHead?: string;
  period?: string;
  scenario?: string;
  planAmount?: number;
  actual?: number;
  variance?: number;
  alertAt?: number;
  ownerName?: string;
  approverName?: string;
  notes?: string;
  status?: string;
  locked?: boolean;
  approvedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  actualLog?: Array<{ _id?: string; amount?: number; postedAt?: string }>;
  createdAt?: string;
  updatedAt?: string;
};

function statusTone(status?: string): EntityStatusTone {
  switch (status) {
    case 'approved':
      return 'green';
    case 'rejected':
      return 'red';
    case 'draft':
      return 'neutral';
    default:
      return 'amber';
  }
}

function fmtMoney(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtPct(plan?: number, actual?: number): string {
  if (typeof plan !== 'number' || plan === 0) return '—';
  const used = ((actual ?? 0) / plan) * 100;
  return `${used.toFixed(1)}%`;
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{value ?? '—'}</div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BudgetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const budget = (await getBudgetById(id)) as BudgetDoc | null;
  if (!budget) notFound();

  const status = budget.status ?? 'draft';
  const variancePct =
    typeof budget.planAmount === 'number' && budget.planAmount !== 0
      ? (((budget.variance ?? 0) / budget.planAmount) * 100).toFixed(1)
      : '—';
  const overrun =
    typeof budget.variance === 'number' && budget.variance < 0;
  const actualLog = budget.actualLog ?? [];

  return (
    <EntityDetailShell
      title={budget.budgetHead || 'Budget'}
      eyebrow={`BUDGET · ${budget.period || ''}`}
      status={{ label: status, tone: statusTone(status) }}
      back={{ href: '/dashboard/crm/budgets', label: 'Back to budgets' }}
      actions={
        <BudgetDetailActions
          budgetId={id}
          status={status}
          locked={budget.locked}
          scenario={budget.scenario}
        />
      }
      audit={<EntityAuditTimeline entityKind="budget" entityId={id} />}
      rightRail={
        <>
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Variance</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">% of plan used</span>
                  <span className="font-mono tabular-nums">
                    {fmtPct(budget.planAmount, budget.actual)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Variance</span>
                  <span
                    className={`font-mono tabular-nums ${overrun ? 'text-zoru-danger-ink' : 'text-zoru-ink'}`}
                  >
                    {fmtMoney(budget.variance)} ({variancePct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-zoru-line pt-2">
                  <span className="text-zoru-ink-muted">Plan</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(budget.planAmount)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Stewards</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div>
                  <div className="text-[11px] uppercase text-zoru-ink-muted">
                    Owner
                  </div>
                  <div className="mt-0.5">{budget.ownerName || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-zoru-ink-muted">
                    Approver
                  </div>
                  <div className="mt-0.5">{budget.approverName || '—'}</div>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Scenario</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Current</span>
                  <Badge variant="outline">
                    {budget.scenario || 'base'}
                  </Badge>
                </div>
                <Link
                  href={`/dashboard/crm/budgets?period=${budget.period || ''}&compare=1`}
                  className="text-zoru-primary hover:underline"
                >
                  Switch scenario →
                </Link>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <Link
                  href={`/dashboard/crm/purchases/expenses?budgetId=${id}`}
                  className="text-zoru-primary hover:underline"
                >
                  Expenses against this budget →
                </Link>
              </div>
            </ZoruCardContent>
          </Card>
        </>
      }
    >
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Budget head" value={budget.budgetHead || '—'} />
            <Field label="Period" value={budget.period || '—'} />
            <Field label="Scenario" value={budget.scenario || 'base'} />
            <Field
              label="Plan amount"
              value={fmtMoney(budget.planAmount)}
            />
            <Field
              label="Actual"
              value={fmtMoney(budget.actual)}
            />
            <Field
              label="Variance"
              value={
                <span
                  className={`font-mono tabular-nums ${overrun ? 'text-zoru-danger-ink' : ''}`}
                >
                  {fmtMoney(budget.variance)}
                </span>
              }
            />
            <Field
              label="Alert threshold"
              value={
                typeof budget.alertAt === 'number'
                  ? `${budget.alertAt}%`
                  : '—'
              }
            />
            <Field
              label="Locked"
              value={
                budget.locked ? (
                  <Badge variant="warning">Yes</Badge>
                ) : (
                  'No'
                )
              }
            />
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Allocation breakdown</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {/* TODO 1D.2: cost-center allocation table needs a child schema */}
          <p className="text-[13px] text-zoru-ink-muted">
            No allocation breakdown yet. Allocation rules are configured per
            cost center on the edit page.
          </p>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Actual vs Planned</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zoru-line/60 text-left text-[11px] uppercase text-zoru-ink-muted">
                <th className="py-2">Metric</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zoru-line/40">
                <td className="py-2 text-zoru-ink-muted">Planned</td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {fmtMoney(budget.planAmount)}
                </td>
              </tr>
              <tr className="border-b border-zoru-line/40">
                <td className="py-2 text-zoru-ink-muted">Actual</td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {fmtMoney(budget.actual)}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Variance</td>
                <td
                  className={`py-2 text-right font-mono font-medium tabular-nums ${overrun ? 'text-zoru-danger-ink' : ''}`}
                >
                  {fmtMoney(budget.variance)}
                </td>
              </tr>
            </tbody>
          </table>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Variance analysis</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {actualLog.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No actuals posted yet. Use <strong>Record actual</strong> to
              capture spend against this budget.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line/60 text-left text-[11px] uppercase text-zoru-ink-muted">
                  <th className="py-2">Posted at</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {actualLog.map((row, idx) => (
                  <tr
                    key={row._id ?? `${row.postedAt}-${idx}`}
                    className="border-b border-zoru-line/40 last:border-0"
                  >
                    <td className="py-2">{fmtDate(row.postedAt)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {fmtMoney(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ZoruCardContent>
      </Card>

      {budget.notes ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Notes</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
              {budget.notes}
            </p>
          </ZoruCardContent>
        </Card>
      ) : null}

      {budget.rejectReason ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Rejection reason</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-zoru-danger-ink">
              {budget.rejectReason}
            </p>
          </ZoruCardContent>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
