'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  SegmentedControl,
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
        actions={
          <Button asChild variant="primary">
            <Link href="/sabpay/invoices/new">
              <Plus size={15} aria-hidden />
              New invoice
            </Link>
          </Button>
        }
      />

      <Card>
        <CardBody>
          {invoices.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No {filter === 'all' ? '' : `${filter} `}invoices in {mode} mode yet.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th>Amount</Th>
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
