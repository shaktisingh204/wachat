/**
 * SabCRM Finance — Profit & loss (`/sabcrm/finance/pnl`), read-only
 * 20ui report.
 *
 * Server-rendered over `getSabcrmPnl` for an Indian FY (Apr–Mar):
 * monthly revenue (invoices) vs expenses (bills + approved expense
 * claims) with FY totals. Period switching is link-based (`?fy=2025`).
 *
 * Statements enrichment (finance-rollout §4):
 *   - Revenue cells drill into `/sabcrm/finance/invoices?from&to`;
 *     expense cells split into Bills / Claims drill links.
 *   - `?compare=1` adds the prior FY (one action call, one fetch) as a
 *     prev-net column + Δ% badges per month and on the totals.
 *   - CSV export + print.
 */

import * as React from 'react';

import { Badge, StatCard, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmPnl } from '@/app/actions/sabcrm-statements.actions';
import {
  deltaPct,
  DrillLink,
  formatINR,
  monthBounds,
  PeriodSwitcher,
  ReportEmpty,
  ReportShell,
} from '../_components/finance-report';
import {
  StatementExportButton,
  StatementPrintButton,
} from '../_components/statement-export-button';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Profit & loss — SabCRM Finance',
};

function currentFyStart(): number {
  const now = new Date();
  return now.getUTCMonth() + 1 >= 4
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1;
}

function fyLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Calendar `{year, month1}` of FY-month bucket `i` (0 = Apr). */
function fyBucketMonth(fy: number, i: number): { year: number; month1: number } {
  const m = (3 + i) % 12; // 0-based calendar month
  return { year: m >= 3 ? fy : fy + 1, month1: m + 1 };
}

const DELTA_BADGE_TONE = {
  up: 'success',
  down: 'danger',
  neutral: 'neutral',
} as const;

function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number | undefined;
}): React.JSX.Element {
  const d = deltaPct(current, previous);
  if (!d) return <>—</>;
  return <Badge tone={DELTA_BADGE_TONE[d.tone]}>{d.value}</Badge>;
}

interface PageProps {
  searchParams: Promise<{ fy?: string; compare?: string }>;
}

export default async function SabcrmPnlPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const nowFy = currentFyStart();
  const requested = Number(params.fy);
  const fy =
    Number.isFinite(requested) && requested >= 2000 && requested <= nowFy + 1
      ? requested
      : nowFy;
  const compare = params.compare === '1';

  const res = await getSabcrmPnl(fy, compare ? { compare: true } : undefined);
  const data = res.ok ? res.data : null;
  const prev = data?.previous;

  const compareSuffix = compare ? '&compare=1' : '';
  const fyLinks = [nowFy - 2, nowFy - 1, nowFy].map((y) => ({
    label: `FY ${fyLabel(y)}`,
    href: `/sabcrm/finance/pnl?fy=${y}${compareSuffix}`,
    active: y === fy,
  }));
  const compareLinks = [
    {
      label: 'This FY',
      href: `/sabcrm/finance/pnl?fy=${fy}`,
      active: !compare,
    },
    {
      label: `vs FY ${fyLabel(fy - 1)}`,
      href: `/sabcrm/finance/pnl?fy=${fy}&compare=1`,
      active: compare,
    },
  ];

  const hasActivity =
    !!data && (data.totalRevenue > 0 || data.totalExpenses > 0);

  const fyRange = { from: `${fy}-04-01`, to: `${fy + 1}-03-31` };
  const invoicesHref = (from: string, to: string): string =>
    `/sabcrm/finance/invoices?from=${from}&to=${to}`;
  const billsHref = (from: string, to: string): string =>
    `/sabcrm/finance/bills?from=${from}&to=${to}`;
  const claimsHref = (from: string, to: string): string =>
    `/sabcrm/finance/expenses?from=${from}&to=${to}`;

  // FY buckets align 1:1 by index (Apr..Mar) across compared years.
  const csvRows = (data?.months ?? []).map((m, i) => {
    const base: Record<string, string | number> = {
      Month: m.month,
      Revenue: m.revenue,
      Bills: m.bills,
      'Expense claims': m.claims,
      Expenses: m.expenses,
      Net: m.net,
    };
    if (prev) {
      const pm = prev.months[i];
      base[`Net FY ${prev.fyLabel}`] = pm?.net ?? 0;
      base['Δ%'] = deltaPct(m.net, pm?.net)?.value ?? '';
    }
    return base;
  });

  return (
    <ReportShell
      title="Profit & loss"
      description="Monthly revenue vs expenses for the financial year — part of the SabCRM Finance suite."
      actions={
        <>
          <PeriodSwitcher links={fyLinks} label="Financial year" />
          <PeriodSwitcher links={compareLinks} label="Period compare" />
          <StatementExportButton
            rows={csvRows}
            fileName={`pnl-fy${data?.fyLabel ?? fyLabel(fy)}.csv`}
          />
          <StatementPrintButton />
        </>
      }
      error={res.ok ? null : res.error}
      methodology="Revenue = invoice totals (drafts and cancelled excluded) by invoice date. Expenses = vendor bill totals plus approved/reimbursed expense claims. Indian FY buckets (Apr–Mar); amounts summed across currencies as-is. Cells drill into the filtered source lists; the compare view recomputes the prior FY over the same documents."
    >
      {data ? (
        !hasActivity ? (
          <ReportEmpty
            message={`No invoices, bills or expenses dated in FY ${data.fyLabel} yet.`}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label={`Revenue (FY ${data.fyLabel})`}
                value={formatINR(data.totalRevenue)}
                delta={
                  prev
                    ? (deltaPct(data.totalRevenue, prev.totalRevenue) ??
                      undefined)
                    : undefined
                }
              />
              <StatCard
                label="Expenses"
                value={formatINR(data.totalExpenses)}
                delta={
                  prev
                    ? (deltaPct(data.totalExpenses, prev.totalExpenses) ??
                      undefined)
                    : undefined
                }
              />
              <StatCard
                label={data.netProfit >= 0 ? 'Net profit' : 'Net loss'}
                value={formatINR(Math.abs(data.netProfit))}
                delta={
                  prev
                    ? (deltaPct(data.netProfit, prev.netProfit) ?? {
                        value: data.netProfit >= 0 ? 'profit' : 'loss',
                        tone: data.netProfit >= 0 ? 'up' : 'down',
                      })
                    : {
                        value: data.netProfit >= 0 ? 'profit' : 'loss',
                        tone: data.netProfit >= 0 ? 'up' : 'down',
                      }
                }
              />
            </div>

            <Table hover>
              <THead>
                <Tr>
                  <Th>Month</Th>
                  <Th align="right">Revenue</Th>
                  <Th align="right">Expenses</Th>
                  <Th align="right">Net</Th>
                  {prev ? (
                    <>
                      <Th align="right">Net (FY {prev.fyLabel})</Th>
                      <Th align="right">Δ</Th>
                    </>
                  ) : null}
                </Tr>
              </THead>
              <TBody>
                {data.months.map((m, i) => {
                  const { year, month1 } = fyBucketMonth(fy, i);
                  const { from, to } = monthBounds(year, month1);
                  const pm = prev?.months[i];
                  return (
                    <Tr key={m.month}>
                      <Td>{m.month}</Td>
                      <Td align="right">
                        {m.revenue > 0 ? (
                          <DrillLink
                            href={invoicesHref(from, to)}
                            title={`Invoices dated in ${m.month}`}
                          >
                            {formatINR(m.revenue)}
                          </DrillLink>
                        ) : (
                          formatINR(m.revenue)
                        )}
                      </Td>
                      <Td align="right">
                        {formatINR(m.expenses)}
                        {m.expenses > 0 ? (
                          <span className="fin-cell-links">
                            <DrillLink
                              href={billsHref(from, to)}
                              title={`Bills dated in ${m.month}`}
                            >
                              Bills {formatINR(m.bills)}
                            </DrillLink>
                            {' · '}
                            <DrillLink
                              href={claimsHref(from, to)}
                              title={`Expense claims dated in ${m.month}`}
                            >
                              Claims {formatINR(m.claims)}
                            </DrillLink>
                          </span>
                        ) : null}
                      </Td>
                      <Td align="right">{formatINR(m.net)}</Td>
                      {prev ? (
                        <>
                          <Td align="right">{formatINR(pm?.net ?? 0)}</Td>
                          <Td align="right">
                            <DeltaBadge current={m.net} previous={pm?.net} />
                          </Td>
                        </>
                      ) : null}
                    </Tr>
                  );
                })}
              </TBody>
              <TFoot>
                <Tr>
                  <Td>FY {data.fyLabel} totals</Td>
                  <Td align="right">
                    <DrillLink
                      href={invoicesHref(fyRange.from, fyRange.to)}
                      title={`Invoices dated in FY ${data.fyLabel}`}
                    >
                      {formatINR(data.totalRevenue)}
                    </DrillLink>
                  </Td>
                  <Td align="right">
                    <DrillLink
                      href={billsHref(fyRange.from, fyRange.to)}
                      title={`Bills dated in FY ${data.fyLabel}`}
                    >
                      {formatINR(data.totalExpenses)}
                    </DrillLink>
                  </Td>
                  <Td align="right">{formatINR(data.netProfit)}</Td>
                  {prev ? (
                    <>
                      <Td align="right">{formatINR(prev.netProfit)}</Td>
                      <Td align="right">
                        <DeltaBadge
                          current={data.netProfit}
                          previous={prev.netProfit}
                        />
                      </Td>
                    </>
                  ) : null}
                </Tr>
              </TFoot>
            </Table>

            <p className="text-xs text-[var(--ui20-color-text-muted,#6b7280)]">
              Expense split:{' '}
              <DrillLink href={billsHref(fyRange.from, fyRange.to)}>
                bills {formatINR(data.totalBills)}
              </DrillLink>{' '}
              ·{' '}
              <DrillLink href={claimsHref(fyRange.from, fyRange.to)}>
                expense claims {formatINR(data.totalExpenseClaims)}
              </DrillLink>
              {prev
                ? ` — FY ${prev.fyLabel}: revenue ${formatINR(prev.totalRevenue)}, expenses ${formatINR(prev.totalExpenses)}.`
                : '.'}
            </p>
          </>
        )
      ) : null}
    </ReportShell>
  );
}

