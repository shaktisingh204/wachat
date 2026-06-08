'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    Activity,
    ArrowRight,
    CreditCard,
    DollarSign,
    ExternalLink,
    Package,
    ShoppingBag,
    Users,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Recharts,
    Separator,
    Skeleton,
    StatCard,
    type BadgeTone,
    type ChartConfig,
} from '@/components/sabcrm/20ui';

import { getStorefront } from '@/app/actions/sabshop.actions';

interface StorefrontDoc {
    _id: string;
    slug: string;
    displayName: string;
    currency?: string;
    status?: string;
}

const SALES_TREND: Array<{ month: string; revenue: number }> = [
    { month: 'Jan', revenue: 28400 },
    { month: 'Feb', revenue: 19200 },
    { month: 'Mar', revenue: 41800 },
    { month: 'Apr', revenue: 52600 },
    { month: 'May', revenue: 37900 },
    { month: 'Jun', revenue: 61200 },
    { month: 'Jul', revenue: 48500 },
    { month: 'Aug', revenue: 33100 },
    { month: 'Sep', revenue: 45700 },
    { month: 'Oct', revenue: 58900 },
    { month: 'Nov', revenue: 39400 },
    { month: 'Dec', revenue: 50300 },
];

const RECENT_ORDERS: Array<{
    id: string;
    customer: string;
    email: string;
    amount: number;
    status: 'paid' | 'pending' | 'unpaid';
}> = [
    { id: '#1024', customer: 'Aanya Sharma', email: 'aanya.s@example.com', amount: 1999, status: 'paid' },
    { id: '#1023', customer: 'Diego Alvarez', email: 'diego@example.com', amount: 349, status: 'pending' },
    { id: '#1022', customer: 'Mei Lin', email: 'mei.lin@example.com', amount: 2990, status: 'paid' },
    { id: '#1021', customer: 'William Kim', email: 'will.kim@example.com', amount: 899, status: 'unpaid' },
    { id: '#1020', customer: 'Priya Nair', email: 'priya.n@example.com', amount: 459, status: 'paid' },
];

function orderTone(status: 'paid' | 'pending' | 'unpaid'): BadgeTone {
    if (status === 'paid') return 'success';
    if (status === 'pending') return 'warning';
    return 'danger';
}

function orderLabel(status: 'paid' | 'pending' | 'unpaid'): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

const chartConfig: ChartConfig = {
    revenue: { label: 'Revenue', color: 'var(--st-accent)' },
};

export default function StorefrontOverviewPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const id = params.storefrontId;

    const [sf, setSf] = React.useState<StorefrontDoc | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let alive = true;
        getStorefront(id)
            .then((res) => {
                if (alive && res.ok) setSf(res.item as StorefrontDoc);
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [id]);

    const currency = sf?.currency ?? 'INR';
    const money = React.useCallback(
        (n: number) =>
            new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
            }).format(n),
        [currency],
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    {loading ? (
                        <Skeleton width={220} height={28} />
                    ) : (
                        <PageTitle>{sf ? sf.displayName : 'Store overview'}</PageTitle>
                    )}
                    <PageDescription>
                        A snapshot of revenue, orders, and customer activity for your store.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    {sf ? (
                        <Button
                            size="sm"
                            variant="outline"
                            iconRight={ExternalLink}
                            onClick={() =>
                                window.open(`/store/${sf.slug}`, '_blank', 'noopener,noreferrer')
                            }
                        >
                            View live store
                        </Button>
                    ) : null}
                </PageActions>
            </PageHeader>

            <section aria-label="Key metrics" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total revenue"
                    value={<span className="tabular-nums">{money(45232)}</span>}
                    icon={DollarSign}
                    accent="#1f9d55"
                    delta={{ value: '+20.1% vs last month', tone: 'up' }}
                />
                <StatCard
                    label="Orders"
                    value={<span className="tabular-nums">2,350</span>}
                    icon={CreditCard}
                    accent="#3b7af5"
                    delta={{ value: '+182 this month', tone: 'up' }}
                />
                <StatCard
                    label="Products sold"
                    value={<span className="tabular-nums">12,234</span>}
                    icon={ShoppingBag}
                    accent="#7c3aed"
                    delta={{ value: '+19% vs last month', tone: 'up' }}
                />
                <StatCard
                    label="Active now"
                    value={<span className="tabular-nums">573</span>}
                    icon={Users}
                    accent="#d97706"
                    delta={{ value: '-12% since last hour', tone: 'down' }}
                />
            </section>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity size={16} aria-hidden="true" className="text-[var(--st-text-secondary)]" />
                            <CardTitle>Sales overview</CardTitle>
                        </div>
                        <CardDescription>Monthly revenue across the last 12 months.</CardDescription>
                    </CardHeader>
                    <CardBody>
                        <ChartContainer config={chartConfig} style={{ height: 300 }}>
                            <Recharts.BarChart data={SALES_TREND} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                                <Recharts.CartesianGrid vertical={false} stroke="var(--st-border)" />
                                <Recharts.XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    fontSize={12}
                                />
                                <Recharts.YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    width={48}
                                    fontSize={12}
                                    tickFormatter={(v: number) => money(v)}
                                />
                                <ChartTooltip
                                    cursor={{ fill: 'var(--st-hover)' }}
                                    content={
                                        <ChartTooltipContent
                                            formatter={(value) => (
                                                <span className="tabular-nums">{money(Number(value))}</span>
                                            )}
                                        />
                                    }
                                />
                                <Recharts.Bar
                                    dataKey="revenue"
                                    fill="var(--color-revenue)"
                                    radius={[4, 4, 0, 0]}
                                />
                            </Recharts.BarChart>
                        </ChartContainer>
                    </CardBody>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CreditCard size={16} aria-hidden="true" className="text-[var(--st-text-secondary)]" />
                            <CardTitle>Recent orders</CardTitle>
                        </div>
                        <CardDescription>The five most recent orders placed.</CardDescription>
                    </CardHeader>
                    <CardBody>
                        {RECENT_ORDERS.length === 0 ? (
                            <EmptyState
                                icon={Package}
                                title="No orders yet"
                                description="Orders placed in your store will appear here."
                            />
                        ) : (
                            <ul className="flex flex-col">
                                {RECENT_ORDERS.map((order, i) => (
                                    <li key={order.id}>
                                        {i > 0 ? <Separator /> : null}
                                        <div className="flex items-center gap-3 py-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-[var(--st-text)]">
                                                    {order.customer}
                                                </p>
                                                <p className="truncate text-sm text-[var(--st-text-secondary)]">
                                                    {order.email}
                                                </p>
                                            </div>
                                            <Badge tone={orderTone(order.status)}>
                                                {orderLabel(order.status)}
                                            </Badge>
                                            <span className="w-20 text-right text-sm font-medium tabular-nums text-[var(--st-text)]">
                                                {money(order.amount)}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                    <Separator />
                    <CardBody>
                        <Button asChild variant="ghost" size="sm" block>
                            <Link href={`/dashboard/sabshop/${id}/orders`}>
                                View all orders
                                <ArrowRight size={14} aria-hidden="true" />
                            </Link>
                        </Button>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
