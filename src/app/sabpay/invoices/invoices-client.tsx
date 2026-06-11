'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, IndianRupee, Plus } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  EmptyState,
  SegmentedControl,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  formatSabpayAmount,
  type SabpayInvoice,
  type SabpayMode,
} from '@/lib/sabpay/types';

import { EntityStatusBadge } from '../_components/entity-status-badge';
import { ListToolbar } from '../_components/list-toolbar';

type StatusFilter = 'all' | 'draft' | 'issued' | 'paid' | 'cancelled' | 'expired';

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
];

export function InvoicesClient({
  initialInvoices,
  mode,
}: {
  initialInvoices: SabpayInvoice[];
  mode: SabpayMode;
}): React.JSX.Element {
  const [filter, setFilter] = React.useState<StatusFilter>('all');

  const invoices =
    filter === 'all'
      ? initialInvoices
      : initialInvoices.filter((inv) => inv.status === filter);

  const summary = React.useMemo(() => {
    let outstanding = 0;
    let paid = 0;
    let draft = 0;
    for (const inv of initialInvoices) {
      if (inv.status === 'issued') outstanding += inv.amount;
      if (inv.status === 'paid') paid += 1;
      if (inv.status === 'draft') draft += 1;
    }
    return { outstanding, paid, draft };
  }, [initialInvoices]);

  const createButton = (
    <Button asChild variant="primary">
      <Link href="/sabpay/invoices/new">
        <Plus size={15} aria-hidden />
        New invoice
      </Link>
    </Button>
  );

  return (
    <>
      <ListToolbar
        left={
          <SegmentedControl
            aria-label="Filter invoices by status"
            items={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        }
        actions={createButton}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--st-space-4, 16px)',
        }}
      >
        <StatCard
          label="Outstanding"
          value={formatSabpayAmount(summary.outstanding)}
          icon={IndianRupee}
          delta={
            summary.outstanding > 0
              ? { value: 'awaiting payment', tone: 'down' }
              : undefined
          }
        />
        <StatCard label="Paid" value={summary.paid} icon={CheckCircle2} />
        <StatCard label="Draft" value={summary.draft} icon={FileText} />
      </div>

      <Card>
        <CardBody>
          {invoices.length === 0 ? (
            <EmptyState
              icon={<FileText size={22} />}
              title={
                filter === 'all'
                  ? `No invoices in ${mode} mode yet`
                  : `No ${filter} invoices in ${mode} mode yet`
              }
              description="Invoices bill a customer for one or more line items. Create your first invoice to request a payment."
              action={createButton}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th>Amount</Th>
                  <Th>Items</Th>
                  <Th>Status</Th>
                  <Th>Due date</Th>
                  <Th>Created</Th>
                </Tr>
              </THead>
              <TBody>
                {invoices.map((inv) => (
                  <Tr key={inv.id}>
                    <Td>
                      <Link
                        href={`/sabpay/invoices/${inv.id}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {inv.id}
                      </Link>
                    </Td>
                    <Td>{inv.customerName || inv.customerEmail || '—'}</Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatSabpayAmount(inv.amount, inv.currency)}
                    </Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {inv.lineItems.length}
                    </Td>
                    <Td>
                      <EntityStatusBadge status={inv.status} />
                    </Td>
                    <Td>{inv.expireBy ? new Date(inv.expireBy).toLocaleDateString() : '—'}</Td>
                    <Td>{new Date(inv.createdAt).toLocaleString()}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </>
  );
}
