import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { formatSabpayAmount } from '@/lib/sabpay/types';

import { SabpayPage } from '../../_components/sabpay-page';
import { CopyableId } from '../../_components/copyable-id';
import { DetailRow, MonoSpan } from '../../_components/detail-row';
import { EntityStatusBadge } from '../../_components/entity-status-badge';
import { getSabpaySettlementDetail } from '../../actions/settlements';

export const dynamic = 'force-dynamic';

const mono = { fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 } as const;
const money = { fontVariantNumeric: 'tabular-nums' } as const;

export default async function SabpaySettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSabpaySettlementDetail(id);
  if (!detail) notFound();

  const { settlement, payments, refunds } = detail;

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Settlements', href: '/sabpay/settlements' },
        { label: settlement.id },
      ]}
      eyebrow="Live settlement"
      title={formatSabpayAmount(settlement.amount)}
      description={`Net payout across ${settlement.paymentCount} payment${settlement.paymentCount === 1 ? '' : 's'} and ${settlement.refundCount} refund${settlement.refundCount === 1 ? '' : 's'}.`}
      actions={<EntityStatusBadge status={settlement.status} />}
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Settlement</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow
            label="Settlement ID"
            value={<CopyableId value={settlement.id} />}
          />
          <DetailRow
            label="UTR"
            value={settlement.utr ? <MonoSpan>{settlement.utr}</MonoSpan> : '—'}
          />
          <DetailRow
            label="Status"
            value={<EntityStatusBadge status={settlement.status} />}
          />
          <DetailRow
            label="Period end"
            value={
              settlement.periodEnd
                ? new Date(settlement.periodEnd).toLocaleString()
                : '—'
            }
          />
          <DetailRow
            label="Settled on"
            value={
              settlement.settledAt
                ? new Date(settlement.settledAt).toLocaleString()
                : '—'
            }
          />
          <DetailRow
            label="Created"
            value={new Date(settlement.createdAt).toLocaleString()}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow
            label="Gross"
            value={
              <span style={money}>
                {formatSabpayAmount(settlement.grossAmount)}
              </span>
            }
          />
          <DetailRow
            label="Fees"
            value={
              <span style={money}>
                − {formatSabpayAmount(settlement.feesTotal)}
              </span>
            }
          />
          <DetailRow
            label="Tax"
            value={
              <span style={money}>
                − {formatSabpayAmount(settlement.taxTotal)}
              </span>
            }
          />
          <DetailRow
            label="Refunds"
            value={
              <span style={money}>
                − {formatSabpayAmount(settlement.refundsTotal)}
              </span>
            }
          />
          <DetailRow
            label="Disputes deducted"
            value={
              <span style={money}>
                − {formatSabpayAmount(settlement.disputesDeducted)}
              </span>
            }
          />
          <DetailRow
            label="Net payout"
            value={
              <span style={{ ...money, fontWeight: 700 }}>
                {formatSabpayAmount(settlement.amount)}
              </span>
            }
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
        </CardHeader>
        <CardBody>
          {payments.length === 0 && refunds.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No entries in this settlement.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Entry</Th>
                  <Th>ID</Th>
                  <Th>Amount</Th>
                </Tr>
              </THead>
              <TBody>
                {payments.map((p) => (
                  <Tr key={p.id}>
                    <Td>Payment</Td>
                    <Td>
                      <Link href={`/sabpay/payments/${p.id}`} style={mono}>
                        {p.id}
                      </Link>
                    </Td>
                    <Td style={{ ...money, fontWeight: 600 }}>
                      {formatSabpayAmount(p.amount, p.currency)}
                    </Td>
                  </Tr>
                ))}
                {refunds.map((r) => (
                  <Tr key={r.id}>
                    <Td>Refund</Td>
                    <Td>
                      <Link href={`/sabpay/refunds/${r.id}`} style={mono}>
                        {r.id}
                      </Link>
                    </Td>
                    <Td
                      style={{
                        ...money,
                        fontWeight: 600,
                        color: 'var(--st-danger)',
                      }}
                    >
                      − {formatSabpayAmount(r.amount)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </SabpayPage>
  );
}
