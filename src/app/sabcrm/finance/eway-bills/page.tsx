/**
 * SabCRM Finance — E-way bills (`/sabcrm/finance/eway-bills`),
 * read-only 20ui report.
 *
 * Server-rendered over `getSabcrmEwayReadiness`: invoices that already
 * carry an e-way bill number, plus invoices at/over the ₹50,000
 * consignment threshold that still need one. Generation against the
 * NIC e-way portal is a transactional flow and out of scope for this
 * read surface.
 *
 * Statements enrichment (finance-rollout §4): every row drills into
 * its invoice detail page; CSV export + print.
 */

import * as React from 'react';

import { Badge, Card, CardBody, CardDescription, CardHeader, CardTitle, StatCard, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmEwayReadiness } from '@/app/actions/sabcrm-statements.actions';
import {
  DrillLink,
  formatINR,
  formatReportDate,
  ReportEmpty,
  ReportShell,
} from '../_components/finance-report';
import {
  StatementExportButton,
  StatementPrintButton,
} from '../_components/statement-export-button';
import type { SabcrmEwayRow } from '@/app/actions/sabcrm-statements.actions.types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'E-way bills — SabCRM Finance',
};

function InvoiceTable({
  rows,
  showEway,
}: {
  rows: SabcrmEwayRow[];
  showEway: boolean;
}): React.JSX.Element {
  return (
    <Table hover>
      <THead>
        <Tr>
          <Th>Invoice</Th>
          <Th>Date</Th>
          <Th align="right">Total</Th>
          <Th>Status</Th>
          <Th>{showEway ? 'E-way bill no.' : 'Action'}</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((row) => (
          <Tr key={row.invoiceId}>
            <Td>
              <DrillLink
                href={`/sabcrm/finance/invoices/${encodeURIComponent(row.invoiceId)}`}
                title={`Open invoice ${row.invoiceNo}`}
              >
                {row.invoiceNo}
              </DrillLink>
            </Td>
            <Td>{row.date ? formatReportDate(row.date) : '—'}</Td>
            <Td align="right">{formatINR(row.total)}</Td>
            <Td>{row.status ?? '—'}</Td>
            <Td>
              {showEway ? (
                (row.ewayBillNo ?? '—')
              ) : (
                <Badge tone="warning" dot>
                  E-way bill needed
                </Badge>
              )}
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

export default async function SabcrmEwayBillsPage(): Promise<React.JSX.Element> {
  const res = await getSabcrmEwayReadiness();
  const data = res.ok ? res.data : null;

  const toCsvRow = (row: SabcrmEwayRow, bucket: string) => ({
    Bucket: bucket,
    Invoice: row.invoiceNo,
    Date: row.date ? row.date.slice(0, 10) : '',
    Total: row.total,
    Status: row.status ?? '',
    'E-way bill no.': row.ewayBillNo ?? '',
  });
  const csvRows = data
    ? [
        ...data.pending.map((r) => toCsvRow(r, 'Pending')),
        ...data.withEway.map((r) => toCsvRow(r, 'Covered')),
      ]
    : [];

  return (
    <ReportShell
      title="E-way bills"
      description="Consignment compliance over this workspace's invoices — part of the SabCRM Finance suite."
      actions={
        <>
          <StatementExportButton rows={csvRows} fileName="eway-bills.csv" />
          <StatementPrintButton />
        </>
      }
      error={res.ok ? null : res.error}
      methodology={`Invoices (drafts and cancelled excluded) are split by their e-way bill number; invoices at or above ${data ? formatINR(data.threshold) : '₹50,000'} without one are flagged. Rows drill into the invoice detail page. Generating e-way bills against the NIC portal is a follow-up transactional flow.`}
    >
      {data ? (
        data.withEway.length === 0 && data.pending.length === 0 ? (
          <ReportEmpty message="No invoices at or above the e-way threshold, and none carry an e-way bill number yet." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                label="Invoices with e-way bill"
                value={data.withEway.length}
              />
              <StatCard
                label="Pending (≥ threshold, none yet)"
                value={data.pending.length}
              />
            </div>

            {data.pending.length > 0 ? (
              <Card variant="outlined">
                <CardHeader>
                  <CardTitle>Needs an e-way bill</CardTitle>
                  <CardDescription>
                    Invoices at or above {formatINR(data.threshold)} without
                    an e-way bill number.
                  </CardDescription>
                </CardHeader>
                <CardBody>
                  <InvoiceTable rows={data.pending} showEway={false} />
                </CardBody>
              </Card>
            ) : null}

            {data.withEway.length > 0 ? (
              <Card variant="outlined">
                <CardHeader>
                  <CardTitle>Covered</CardTitle>
                  <CardDescription>
                    Invoices already carrying an e-way bill number.
                  </CardDescription>
                </CardHeader>
                <CardBody>
                  <InvoiceTable rows={data.withEway} showEway />
                </CardBody>
              </Card>
            ) : null}
          </>
        )
      ) : null}
    </ReportShell>
  );
}
