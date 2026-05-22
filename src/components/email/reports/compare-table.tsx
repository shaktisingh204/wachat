'use client';

import { Scale } from 'lucide-react';
import {
  Card,
  EmptyState,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import type { EmailCompareRow } from '@/lib/rust-client/email-reports';

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
      <ZoruEmptyState
        icon={<Scale />}
        title="Nothing to compare"
        description="Select two or more campaigns to see side-by-side metrics."
      />
    );
  }

  return (
    <ZoruCard className="overflow-hidden p-0">
      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Campaign</ZoruTableHead>
            <ZoruTableHead className="text-right">Sent</ZoruTableHead>
            <ZoruTableHead className="text-right">Delivered</ZoruTableHead>
            <ZoruTableHead className="text-right">Open rate</ZoruTableHead>
            <ZoruTableHead className="text-right">Click rate</ZoruTableHead>
            <ZoruTableHead className="text-right">Bounce rate</ZoruTableHead>
            <ZoruTableHead className="text-right">Unsub rate</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {rows.map((r) => (
            <ZoruTableRow key={r.campaignId}>
              <ZoruTableCell className="font-medium text-zoru-ink">
                {r.campaignName}
              </ZoruTableCell>
              <ZoruTableCell className="text-right">{fmt(r.totals.sent)}</ZoruTableCell>
              <ZoruTableCell className="text-right">{fmt(r.totals.delivered)}</ZoruTableCell>
              <ZoruTableCell className="text-right">{pct(r.totals.openRate)}</ZoruTableCell>
              <ZoruTableCell className="text-right">{pct(r.totals.clickRate)}</ZoruTableCell>
              <ZoruTableCell className="text-right">{pct(r.totals.bounceRate)}</ZoruTableCell>
              <ZoruTableCell className="text-right">{pct(r.totals.unsubscribeRate)}</ZoruTableCell>
            </ZoruTableRow>
          ))}
        </ZoruTableBody>
      </ZoruTable>
    </ZoruCard>
  );
}
