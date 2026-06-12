/**
 * SabCRM Finance — Cash flow (`/sabcrm/finance/cash-flow`), read-only
 * 20ui report.
 *
 * Server-rendered over `getSabcrmCashFlow`: monthly inflows (payment
 * receipts) vs outflows (payouts + approved expenses) with a running
 * cash position. Period switching is link-based (`?year=2025`).
 *
 * Statements enrichment (finance-rollout §4):
 *   - Inflow cells drill into `/sabcrm/finance/payment-receipts?from&to`,
 *     outflow cells into payouts (with an expense-claims sub-link).
 *   - `?compare=1` adds the prior year (one action call, one fetch) as
 *     a prev-net column + Δ% badges per month and on the totals.
 *   - CSV export + print.
 */

import * as React from 'react';

import { Badge, StatCard, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmCashFlow } from '@/app/actions/sabcrm-statements.actions';
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
  title: 'Cash flow — SabCRM Finance',
};

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
  searchParams: Promise<{ year?: string; compare?: string }>;
}

export default async function SabcrmCashFlowPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const nowYear = new Date().getUTCFullYear();
  const requested = Number(params.year);
  const year =
    Number.isFinite(requested) && requested >= 2000 && requested <= nowYear + 1
      ? requested
      : nowYear;
  const compare = params.compare === '1';

  const res = await getSabcrmCashFlow(
    year,
    compare ? { compare: true } : undefined,
  );
  const data = res.ok ? res.data : null;
  const prev = data?.previous;

  const compareSuffix = compare ? '&compare=1' : '';
  const yearLinks = [nowYear - 2, nowYear - 1, nowYear].map((y) => ({
    label: String(y),
    href: `/sabcrm/finance/cash-flow?year=${y}${compareSuffix}`,
    active: y === year,
  }));
  const compareLinks = [
    {
      label: 'This year',
      href: `/sabcrm/finance/cash-flow?year=${year}`,
      active: !compare,
    },
    {
      label: `vs ${year - 1}`,
      href: `/sabcrm/finance/cash-flow?year=${year}&compare=1`,
      active: compare,
    },
  ];

  const hasActivity =
    !!data && (data.totalInflow > 0 || data.totalOutflow > 0);

  const receiptsHref = (from: string, to: string): string =>
    `/sabcrm/finance/payment-receipts?from=${from}&to=${to}`;
  const payoutsHref = (from: string, to: string): string =>
    `/sabcrm/finance/payouts?from=${from}&to=${to}`;
  const claimsHref = (from: string, to: string): string =>
    `/sabcrm/finance/expenses?from=${from}&to=${to}`;
  const yearRange = { from: `${year}-01-01`, to: `${year}-12-31` };

  // Calendar months align 1:1 by index (Jan..Dec) across compared years.
  const csvRows = (data?.months ?? []).map((m, i) => {
    const base: Record<string, string | number> = {
      Month: m.month,
      Inflow: m.inflow,
      Outflow: m.outflow,
      Net: m.net,
      Closing: m.closing,
    };
    if (prev) {
      const pm = prev.months[i];
      base[`Net ${prev.year}`] = pm?.net ?? 0;
      base['Δ%'] = deltaPct(m.net, pm?.net)?.value ?? '';
    }
    return base;
  });

  return (
    <ReportShell
      title="Cash flow"
      description="Monthly money in vs money out with the running cash position — part of the SabCRM Finance suite."
      actions={
        <>
          <PeriodSwitcher links={yearLinks} label="Calendar year" />
          <PeriodSwitcher links={compareLinks} label="Period compare" />
          <StatementExportButton
            rows={csvRows}
            fileName={`cash-flow-${year}.csv`}
          />
          <StatementPrintButton />
        </>
      }
      error={res.ok ? null : res.error}
      methodology="Inflows = payment receipts (bounced excluded); outflows = vendor payouts + approved/reimbursed expense claims, bucketed by document date (calendar year). Opening cash folds in all prior-year activity across the same documents. Cells drill into the filtered source lists; the compare view recomputes the prior year over the same documents."
    >
      {data ? (
        !hasActivity ? (
          <ReportEmpty
            message={`No receipts, payouts or expenses dated in ${data.year} yet.`}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <StatCard
                label={`Opening cash (1 Jan ${data.year})`}
                value={formatINR(data.openingCash)}
                delta={
                  prev
                    ? (deltaPct(data.openingCash, prev.openingCash) ??
                      undefined)
                    : undefined
                }
              />
              <StatCard
                label="Total inflow"
                value={formatINR(data.totalInflow)}
                delta={
                  prev
                    ? (deltaPct(data.totalInflow, prev.totalInflow) ??
                      undefined)
                    : undefined
                }
              />
              <StatCard
                label="Total outflow"
                value={formatINR(data.totalOutflow)}
                delta={
                  prev
                    ? (deltaPct(data.totalOutflow, prev.totalOutflow) ??
                      undefined)
                    : undefined
                }
              />
              <StatCard
                label="Closing cash"
                value={formatINR(data.closingCash)}
                delta={
                  prev
                    ? (deltaPct(data.closingCash, prev.closingCash) ??
                      undefined)
                    : undefined
                }
              />
            </div>

            <Table hover>
              <THead>
                <Tr>
                  <Th>Month</Th>
                  <Th align="right">Inflow</Th>
                  <Th align="right">Outflow</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">Closing</Th>
                  {prev ? (
                    <>
                      <Th align="right">Net ({prev.year})</Th>
                      <Th align="right">Δ</Th>
                    </>
                  ) : null}
                </Tr>
              </THead>
              <TBody>
                {data.months.map((m, i) => {
                  const { from, to } = monthBounds(year, i + 1);
                  const pm = prev?.months[i];
                  return (
                    <Tr key={m.month}>
                      <Td>{m.month}</Td>
                      <Td align="right">
                        {m.inflow > 0 ? (
                          <DrillLink
                            href={receiptsHref(from, to)}
                            title={`Payment receipts dated in ${m.month}`}
                          >
                            {formatINR(m.inflow)}
                          </DrillLink>
                        ) : (
                          formatINR(m.inflow)
                        )}
                      </Td>
                      <Td align="right">
                        {m.outflow > 0 ? (
                          <>
                            <DrillLink
                              href={payoutsHref(from, to)}
                              title={`Payouts dated in ${m.month}`}
                            >
                              {formatINR(m.outflow)}
                            </DrillLink>
                            <span className="fin-cell-links">
                              <DrillLink
                                href={claimsHref(from, to)}
                                title={`Expense claims dated in ${m.month}`}
                              >
                                incl. expense claims
                              </DrillLink>
                            </span>
                          </>
                        ) : (
                          formatINR(m.outflow)
                        )}
                      </Td>
                      <Td align="right">{formatINR(m.net)}</Td>
                      <Td align="right">{formatINR(m.closing)}</Td>
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
                  <Td>{data.year} totals</Td>
                  <Td align="right">
                    <DrillLink
                      href={receiptsHref(yearRange.from, yearRange.to)}
                      title={`Payment receipts dated in ${data.year}`}
                    >
                      {formatINR(data.totalInflow)}
                    </DrillLink>
                  </Td>
                  <Td align="right">
                    <DrillLink
                      href={payoutsHref(yearRange.from, yearRange.to)}
                      title={`Payouts dated in ${data.year}`}
                    >
                      {formatINR(data.totalOutflow)}
                    </DrillLink>
                  </Td>
                  <Td align="right">
                    {formatINR(data.totalInflow - data.totalOutflow)}
                  </Td>
                  <Td align="right">{formatINR(data.closingCash)}</Td>
                  {prev ? (
                    <>
                      <Td align="right">
                        {formatINR(prev.totalInflow - prev.totalOutflow)}
                      </Td>
                      <Td align="right">
                        <DeltaBadge
                          current={data.totalInflow - data.totalOutflow}
                          previous={prev.totalInflow - prev.totalOutflow}
                        />
                      </Td>
                    </>
                  ) : null}
                </Tr>
              </TFoot>
            </Table>
          </>
        )
      ) : null}
    </ReportShell>
  );
}
