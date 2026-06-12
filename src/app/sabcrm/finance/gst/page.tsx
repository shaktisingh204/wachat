/**
 * SabCRM Finance — GST (`/sabcrm/finance/gst`), read-only 20ui report.
 *
 * Consolidated India-GST page over `getSabcrmGstSummary` for one
 * `MM-YYYY` period (link-based switcher):
 *
 *   - GSTR-1 — outward supplies grouped by the invoice's GST treatment
 *     (taxable value + IGST/CGST/SGST/cess from line items).
 *   - GSTR-3B — outward tax vs ITC (vendor-bill line taxes) and the
 *     resulting net payable.
 *
 * GSTR-2B (portal JSON import + reconciliation) is intentionally out
 * of scope for this read surface — noted inline.
 */

import * as React from 'react';

import { Card, CardBody, CardDescription, CardHeader, CardTitle, StatCard, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmGstSummary } from '@/app/actions/sabcrm-statements.actions';
import {
  formatINR,
  PeriodSwitcher,
  ReportEmpty,
  ReportShell,
} from '../_components/finance-report';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'GST — SabCRM Finance',
};

const TREATMENT_LABEL: Record<string, string> = {
  registered: 'B2B (registered)',
  composition: 'Composition',
  unregistered: 'B2C (unregistered)',
  consumer: 'B2C (consumer)',
  overseas: 'Export (overseas)',
  sez_with_payment: 'SEZ (with payment)',
  sez_without_payment: 'SEZ (without payment)',
  deemed_export: 'Deemed export',
};

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

/** Last `n` month periods ending at the current month. */
function recentPeriods(n: number): Array<{ month: number; year: number }> {
  const out: Array<{ month: number; year: number }> = [];
  const now = new Date();
  let m = now.getUTCMonth() + 1;
  let y = now.getUTCFullYear();
  for (let i = 0; i < n; i += 1) {
    out.unshift({ month: m, year: y });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default async function SabcrmGstPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const now = new Date();
  const reqMonth = Number(params.month);
  const reqYear = Number(params.year);
  const month =
    Number.isFinite(reqMonth) && reqMonth >= 1 && reqMonth <= 12
      ? reqMonth
      : now.getUTCMonth() + 1;
  const year =
    Number.isFinite(reqYear) && reqYear >= 2017 ? reqYear : now.getUTCFullYear();

  const res = await getSabcrmGstSummary({ month, year });
  const data = res.ok ? res.data : null;

  const periodLinks = recentPeriods(4).map((p) => ({
    label: `${MONTH_NAMES[p.month - 1]} ${p.year}`,
    href: `/sabcrm/finance/gst?month=${p.month}&year=${p.year}`,
    active: p.month === month && p.year === year,
  }));

  return (
    <ReportShell
      title="GST"
      description="GSTR-1 outward summary and GSTR-3B tax-vs-ITC readout for the period — part of the SabCRM Finance suite."
      actions={<PeriodSwitcher links={periodLinks} label="Return period" />}
      error={res.ok ? null : res.error}
      methodology="Computed from this workspace's invoices (outward) and vendor bills (ITC) dated in the period — drafts and cancelled excluded; tax amounts come from line-item CGST/SGST/IGST/cess. GSTR-2B requires a GST-portal JSON import and is not part of this read-only summary."
    >
      {data ? (
        data.invoiceCount === 0 && data.billCount === 0 ? (
          <ReportEmpty
            message={`No invoices or bills dated in ${data.period} yet.`}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <StatCard
                label={`Outward taxable (${data.period})`}
                value={formatINR(data.outwardTaxable)}
              />
              <StatCard
                label="Outward tax"
                value={formatINR(data.outwardTotalTax)}
              />
              <StatCard label="ITC (from bills)" value={formatINR(data.itcTotal)} />
              <StatCard label="Net payable" value={formatINR(data.netPayable)} />
            </div>

            <Card variant="outlined">
              <CardHeader>
                <CardTitle>GSTR-1 — outward supplies</CardTitle>
                <CardDescription>
                  {data.invoiceCount} invoice
                  {data.invoiceCount === 1 ? '' : 's'} grouped by GST
                  treatment.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <Table hover>
                  <THead>
                    <Tr>
                      <Th>Supply type</Th>
                      <Th align="right">Invoices</Th>
                      <Th align="right">Taxable value</Th>
                      <Th align="right">IGST</Th>
                      <Th align="right">CGST</Th>
                      <Th align="right">SGST</Th>
                      <Th align="right">Cess</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {data.gstr1Rows.map((row) => (
                      <Tr key={row.treatment}>
                        <Td>
                          {TREATMENT_LABEL[row.treatment] ?? row.treatment}
                        </Td>
                        <Td align="right">{row.invoiceCount}</Td>
                        <Td align="right">{formatINR(row.taxableValue)}</Td>
                        <Td align="right">{formatINR(row.igst)}</Td>
                        <Td align="right">{formatINR(row.cgst)}</Td>
                        <Td align="right">{formatINR(row.sgst)}</Td>
                        <Td align="right">{formatINR(row.cess)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                  <TFoot>
                    <Tr>
                      <Td>Total</Td>
                      <Td align="right">{data.invoiceCount}</Td>
                      <Td align="right">{formatINR(data.outwardTaxable)}</Td>
                      <Td align="right">{formatINR(data.outwardIgst)}</Td>
                      <Td align="right">{formatINR(data.outwardCgst)}</Td>
                      <Td align="right">{formatINR(data.outwardSgst)}</Td>
                      <Td align="right">{formatINR(data.outwardCess)}</Td>
                    </Tr>
                  </TFoot>
                </Table>
              </CardBody>
            </Card>

            <Card variant="outlined">
              <CardHeader>
                <CardTitle>GSTR-3B — summary</CardTitle>
                <CardDescription>
                  Outward tax (table 3.1) vs input tax credit from{' '}
                  {data.billCount} vendor bill
                  {data.billCount === 1 ? '' : 's'} (table 4).
                </CardDescription>
              </CardHeader>
              <CardBody>
                <Table>
                  <THead>
                    <Tr>
                      <Th>Head</Th>
                      <Th align="right">IGST</Th>
                      <Th align="right">CGST</Th>
                      <Th align="right">SGST</Th>
                      <Th align="right">Cess</Th>
                      <Th align="right">Total</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    <Tr>
                      <Td>3.1 Outward taxable supplies</Td>
                      <Td align="right">{formatINR(data.outwardIgst)}</Td>
                      <Td align="right">{formatINR(data.outwardCgst)}</Td>
                      <Td align="right">{formatINR(data.outwardSgst)}</Td>
                      <Td align="right">{formatINR(data.outwardCess)}</Td>
                      <Td align="right">{formatINR(data.outwardTotalTax)}</Td>
                    </Tr>
                    <Tr>
                      <Td>4 Eligible ITC (from bills)</Td>
                      <Td align="right">{formatINR(data.itcIgst)}</Td>
                      <Td align="right">{formatINR(data.itcCgst)}</Td>
                      <Td align="right">{formatINR(data.itcSgst)}</Td>
                      <Td align="right">{formatINR(data.itcCess)}</Td>
                      <Td align="right">{formatINR(data.itcTotal)}</Td>
                    </Tr>
                  </TBody>
                  <TFoot>
                    <Tr>
                      <Td colSpan={5}>Net tax payable</Td>
                      <Td align="right">{formatINR(data.netPayable)}</Td>
                    </Tr>
                  </TFoot>
                </Table>
              </CardBody>
            </Card>
          </>
        )
      ) : null}
    </ReportShell>
  );
}
