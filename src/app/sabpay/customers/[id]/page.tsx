import { notFound } from 'next/navigation';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from '@/components/sabcrm/20ui';

import { SabpayPage } from '../../_components/sabpay-page';
import { CopyableId } from '../../_components/copyable-id';
import { DetailRow, MonoSpan } from '../../_components/detail-row';
import {
  getSabpayCustomerDetail,
  getSabpayCustomerPayments,
} from '../../actions/customers';
import { CustomerActivityTabs } from './customer-activity-tabs';

export const dynamic = 'force-dynamic';

export default async function SabpayCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getSabpayCustomerDetail(id);
  if (!customer) notFound();

  const payments = await getSabpayCustomerPayments(customer.id);

  // The dashboard's own free-text note is stored under `note`; anything else
  // in `notes` came in via the API and renders as raw key/value rows.
  const noteEntries = Object.entries(customer.notes ?? {});

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Customers', href: '/sabpay/customers' },
        { label: customer.id },
      ]}
      eyebrow={customer.mode === 'live' ? 'Live customer' : 'Test customer'}
      title={customer.name}
      description={customer.email || customer.contact || undefined}
      width="narrow"
    >
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardBody>
          <DetailRow label="Customer ID" value={<CopyableId value={customer.id} />} />
          <DetailRow label="Name" value={customer.name} />
          <DetailRow label="Email" value={customer.email || '—'} />
          <DetailRow label="Phone" value={customer.contact || '—'} />
          <DetailRow
            label="GSTIN"
            value={customer.gstin ? <MonoSpan>{customer.gstin}</MonoSpan> : '—'}
          />
          <DetailRow label="Created" value={new Date(customer.createdAt).toLocaleString()} />
        </CardBody>
      </Card>

      {noteEntries.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardBody>
            {noteEntries.map(([key, value]) => (
              <DetailRow
                key={key}
                label={key === 'note' ? 'Note' : key}
                value={typeof value === 'string' ? value : <MonoSpan>{JSON.stringify(value)}</MonoSpan>}
              />
            ))}
          </CardBody>
        </Card>
      ) : null}

      <CustomerActivityTabs payments={payments} mode={customer.mode} />
    </SabpayPage>
  );
}
