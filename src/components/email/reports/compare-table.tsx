'use client';

import { Scale } from 'lucide-react';
import { Card, EmptyState, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import type { EmailCompareRow, EmailMetricsTotals } from '@/lib/rust-client/email-reports';

interface CompareTableProps {
  rows: EmailCompareRow[];
}

function fmt(n: number | undefined): string {
  if (!n || Number.isNaN(n)) return '0';
  return n.toLocaleString();
}

function pct(rate: number | undefined): string {
  if (rate === undefined || rate === null || Number.isNaN(rate)) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

export function CompareTable({ rows }: CompareTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Scale />}
        title="Nothing to compare"
        description="Select two or more campaigns to see side-by-side metrics."
      />
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <THead>
          <Tr>
            <Th>Campaign</Th>
            <Th className="text-right">Sent</Th>
            <Th className="text-right">Delivered</Th>
            <Th className="text-right">Open rate</Th>
            <Th className="text-right">Click rate</Th>
            <Th className="text-right">Bounce rate</Th>
            <Th className="text-right">Unsub rate</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((r) => {
            const totals: Partial<EmailMetricsTotals> = r.totals ?? {};
            return (
              <Tr key={r.campaignId}>
                <Td className="font-medium text-[var(--st-text)]">
                  {r.campaignName}
                </Td>
                <Td className="text-right">{fmt(totals.sent)}</Td>
                <Td className="text-right">{fmt(totals.delivered)}</Td>
                <Td className="text-right">{pct(totals.openRate)}</Td>
                <Td className="text-right">{pct(totals.clickRate)}</Td>
                <Td className="text-right">{pct(totals.bounceRate)}</Td>
                <Td className="text-right">{pct(totals.unsubscribeRate)}</Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}
