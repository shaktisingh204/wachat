'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  Card,
  CardBody,
  Table,
  TabPanel,
  TabsBar,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  formatSabpayAmount,
  type SabpayMode,
  type SabpayPayment,
} from '@/lib/sabpay/types';

import { EntityStatusBadge } from '../../_components/entity-status-badge';

type ActivityTab = 'payments' | 'subscriptions' | 'invoices';

/** Muted "browse the section instead" note for tabs without a per-customer feed. */
function ViewInSection({ entity, href }: { entity: string; href: string }) {
  return (
    <Card>
      <CardBody>
        <p style={{ margin: 0, color: 'var(--st-text-muted)', fontSize: 14 }}>
          Per-customer {entity} aren’t listed here yet — browse the{' '}
          <Link href={href} style={{ fontWeight: 600 }}>
            {entity.charAt(0).toUpperCase() + entity.slice(1)}
          </Link>{' '}
          section and filter by this customer’s id.
        </p>
      </CardBody>
    </Card>
  );
}

export function CustomerActivityTabs({
  payments,
  mode,
}: {
  payments: SabpayPayment[];
  mode: SabpayMode;
}) {
  const [tab, setTab] = React.useState<ActivityTab>('payments');

  return (
    <TabsBar
      items={[
        {
          value: 'payments',
          label: 'Payments',
          badge: payments.length > 0 ? payments.length : undefined,
        },
        { value: 'subscriptions', label: 'Subscriptions' },
        { value: 'invoices', label: 'Invoices' },
      ]}
      value={tab}
      onChange={(value) => setTab(value as ActivityTab)}
      idBase="sabpay-customer-activity"
    >
      <TabPanel value="payments">
        <Card>
          <CardBody>
            {payments.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
                No payments from this customer in {mode} mode yet.
              </p>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Payment</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Description</Th>
                    <Th>Created</Th>
                  </Tr>
                </THead>
                <TBody>
                  {payments.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <Link
                          href={`/sabpay/payments/${p.id}`}
                          style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                        >
                          {p.id}
                        </Link>
                      </Td>
                      <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {formatSabpayAmount(p.amount, p.currency)}
                      </Td>
                      <Td>
                        <EntityStatusBadge status={p.status} />
                      </Td>
                      <Td>{p.description || '—'}</Td>
                      <Td>{new Date(p.createdAt).toLocaleString()}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel value="subscriptions">
        <ViewInSection entity="subscriptions" href="/sabpay/subscriptions" />
      </TabPanel>

      <TabPanel value="invoices">
        <ViewInSection entity="invoices" href="/sabpay/invoices" />
      </TabPanel>
    </TabsBar>
  );
}
