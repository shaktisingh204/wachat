import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui/compat';
import { PieChart } from 'lucide-react';
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
import { BudgetLiveStats } from '../_components/budget-live-stats';

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

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { timeZone: 'UTC' });
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{value ?? '—'}</div>
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
  const overrun = typeof budget.variance === 'number' && budget.variance < 0;
  const actualLog = budget.actualLog ?? [];
  const planAmt = typeof budget.planAmount === 'number' ? budget.planAmount : 0;
  const actualAmt = typeof budget.actual === 'number' ? budget.actual : 0;
  const alertAtAmt = typeof budget.alertAt === 'number' ? budget.alertAt : 80;

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
          <BudgetLiveStats 
            budgetId={id} 
            planAmount={planAmt} 
            initialActual={actualAmt} 
            alertAt={alertAtAmt} 
          />

          <Card>
            <CardHeader>
              <CardTitle>Stewards</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2 text-[12.5px]">
                <div>
                  <div className="text-[11px] uppercase text-[var(--st-text-secondary)]">
                    Owner
                  </div>
                  <div className="mt-0.5">{budget.ownerName || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-[var(--st-text-secondary)]">
                    Approver
                  </div>
                  <div className="mt-0.5">{budget.approverName || '—'}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scenario</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Current</span>
                  <Badge variant="outline">
                    {budget.scenario || 'base'}
                  </Badge>
                </div>
                <Link
                  href={`/dashboard/crm/budgets?period=${budget.period || ''}&compare=1`}
                  className="text-[var(--st-text)] hover:underline"
                >
                  Switch scenario →
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <Link
                  href={`/dashboard/crm/purchases/expenses?budgetId=${id}`}
                  className="text-[var(--st-text)] hover:underline"
                >
                  Expenses against this budget →
                </Link>
              </div>
            </CardBody>
          </Card>
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardBody>
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
                  className={`font-mono tabular-nums ${overrun ? 'text-[var(--st-danger)]' : ''}`}
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allocation breakdown</CardTitle>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={<PieChart />}
            title="No allocation breakdown"
            description="Allocation rules are configured per cost center on the edit page."
            compact
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actual vs Planned</CardTitle>
        </CardHeader>
        <CardBody>
          <Table className="text-[13px]">
            <THead>
              <Tr className="border-b border-[var(--st-border)]/60 text-left text-[11px] uppercase text-[var(--st-text-secondary)] hover:bg-transparent">
                <Th className="py-2">Metric</Th>
                <Th className="py-2 text-right">Amount</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr className="border-b border-[var(--st-border)]/40">
                <Td className="py-2 text-[var(--st-text-secondary)]">Planned</Td>
                <Td className="py-2 text-right font-mono tabular-nums">
                  {fmtMoney(budget.planAmount)}
                </Td>
              </Tr>
              <Tr className="border-b border-[var(--st-border)]/40">
                <Td className="py-2 text-[var(--st-text-secondary)]">Actual</Td>
                <Td className="py-2 text-right font-mono tabular-nums">
                  {fmtMoney(budget.actual)}
                </Td>
              </Tr>
              <Tr className="border-0">
                <Td className="py-2 font-medium">Variance</Td>
                <Td
                  className={`py-2 text-right font-mono font-medium tabular-nums ${overrun ? 'text-[var(--st-danger)]' : ''}`}
                >
                  {fmtMoney(budget.variance)}
                </Td>
              </Tr>
            </TBody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variance analysis</CardTitle>
        </CardHeader>
        <CardBody>
          {actualLog.length === 0 ? (
            <EmptyState
              title="No actuals posted yet"
              description={<>Use <strong>Record actual</strong> to capture spend against this budget.</>}
              compact
            />
          ) : (
            <Table className="text-[13px]">
              <THead>
                <Tr className="border-b border-[var(--st-border)]/60 text-left text-[11px] uppercase text-[var(--st-text-secondary)] hover:bg-transparent">
                  <Th className="py-2">Posted at</Th>
                  <Th className="py-2 text-right">Amount</Th>
                </Tr>
              </THead>
              <TBody>
                {actualLog.map((row, idx) => (
                  <Tr
                    key={row._id ?? `${row.postedAt}-${idx}`}
                    className="border-b border-[var(--st-border)]/40 last:border-0"
                  >
                    <Td className="py-2">{fmtDate(row.postedAt)}</Td>
                    <Td className="py-2 text-right font-mono tabular-nums">
                      {fmtMoney(row.amount)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {budget.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {budget.notes}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {budget.rejectReason ? (
        <Card>
          <CardHeader>
            <CardTitle>Rejection reason</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-danger)]">
              {budget.rejectReason}
            </p>
          </CardBody>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
