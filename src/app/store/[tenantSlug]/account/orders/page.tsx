'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { PackageSearch, Search } from 'lucide-react';

import { getOrderByCode } from '@/app/actions/storefront.actions';
import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    EmptyState,
    Field,
    Input,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    TBody,
    Table,
    Td,
    Th,
    THead,
    Tr,
    type BadgeTone,
} from '@/components/sabcrm/20ui';

interface OrderShape {
    orderCode: string;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    totals?: { total?: number };
    currency?: string;
    lineItems?: Array<{ name: string; quantity: number; lineTotal: number }>;
}

function statusTone(status?: string): BadgeTone {
    const s = (status ?? '').toLowerCase();
    if (s === 'paid' || s === 'fulfilled' || s === 'completed' || s === 'shipped') return 'success';
    if (s === 'pending' || s === 'processing' || s === 'partial') return 'warning';
    if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'refunded') return 'danger';
    return 'neutral';
}

export default function GuestOrdersPage(): React.JSX.Element {
    const params = useParams<{ tenantSlug: string }>();
    const tenantSlug = params.tenantSlug;
    const [code, setCode] = React.useState('');
    const [order, setOrder] = React.useState<OrderShape | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    async function lookup(e: React.FormEvent) {
        e.preventDefault();
        if (!code.trim()) return;
        setBusy(true);
        setError(null);
        const r = await getOrderByCode(tenantSlug, code.trim().toUpperCase());
        setBusy(false);
        if (r.ok) setOrder(r.order as OrderShape);
        else {
            setOrder(null);
            setError(r.error);
        }
    }

    const currency = order?.currency ?? '₹';

    return (
        <div className="20ui max-w-xl">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Track an order</PageTitle>
                    <PageDescription>
                        Enter your order code to check its payment and fulfillment status.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <form onSubmit={lookup} className="mt-6 flex items-end gap-2">
                <Field label="Order code" className="flex-1">
                    <Input
                        iconLeft={Search}
                        placeholder="e.g. CO-20260527-12345"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                </Field>
                <Button type="submit" variant="primary" loading={busy} iconLeft={Search}>
                    Look up
                </Button>
            </form>

            {error ? (
                <Alert tone="danger" title="Order not found" className="mt-4">
                    {error}
                </Alert>
            ) : null}

            {order ? (
                <Card variant="outlined" className="mt-6">
                    <CardHeader>
                        <CardTitle>{order.orderCode}</CardTitle>
                        <CardDescription>
                            <span className="flex flex-wrap items-center gap-2">
                                <span className="text-[var(--st-text-secondary)]">Payment</span>
                                <Badge tone={statusTone(order.paymentStatus)}>
                                    {order.paymentStatus ?? 'Unknown'}
                                </Badge>
                                <span className="text-[var(--st-text-secondary)]">Fulfillment</span>
                                <Badge tone={statusTone(order.fulfillmentStatus)}>
                                    {order.fulfillmentStatus ?? 'Unknown'}
                                </Badge>
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        <Table density="compact" hover={false}>
                            <THead>
                                <Tr>
                                    <Th>Item</Th>
                                    <Th align="center">Qty</Th>
                                    <Th align="right">Line total</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {(order.lineItems ?? []).map((li, i) => (
                                    <Tr key={i}>
                                        <Td>{li.name}</Td>
                                        <Td align="center">{li.quantity}</Td>
                                        <Td align="right">
                                            {currency} {li.lineTotal}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                    <CardFooter className="justify-end gap-2 font-semibold text-[var(--st-text)]">
                        <span>Total</span>
                        <span>
                            {currency} {order.totals?.total ?? 0}
                        </span>
                    </CardFooter>
                </Card>
            ) : !error ? (
                <EmptyState
                    icon={PackageSearch}
                    title="No order looked up yet"
                    description="Enter your order code above to see its status and items."
                    className="mt-6"
                />
            ) : null}
        </div>
    );
}
