'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
    Activity,
    CreditCard,
    DollarSign,
    ExternalLink,
    Users,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    StatCard,
} from '@/components/sabcrm/20ui';

import { getStorefront } from '@/app/actions/sabshop.actions';

interface StorefrontDoc {
    _id: string;
    slug: string;
    displayName: string;
    currency?: string;
    status?: string;
}

const SALES_BARS = [40, 25, 60, 80, 50, 90, 75, 45, 65, 85, 55, 70];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RECENT_ORDERS: Array<{
    id: string;
    customer: string;
    email: string;
    amount: string;
    status: 'Paid' | 'Pending' | 'Unpaid';
}> = [
    { id: '#1024', customer: 'Olivia Martin', email: 'olivia.m@email.com', amount: '₹1,999.00', status: 'Paid' },
    { id: '#1023', customer: 'Jackson Lee', email: 'lee@example.com', amount: '₹39.00', status: 'Pending' },
    { id: '#1022', customer: 'Isabella Nguyen', email: 'isabella.n@email.com', amount: '₹299.00', status: 'Paid' },
    { id: '#1021', customer: 'William Kim', email: 'will@email.com', amount: '₹99.00', status: 'Unpaid' },
    { id: '#1020', customer: 'Sofia Davis', email: 'sofia.d@email.com', amount: '₹39.00', status: 'Paid' },
];

function orderTone(status: 'Paid' | 'Pending' | 'Unpaid'): 'success' | 'warning' | 'danger' {
    if (status === 'Paid') return 'success';
    if (status === 'Pending') return 'warning';
    return 'danger';
}

export default function StorefrontOverviewPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const id = params.storefrontId;

    const [sf, setSf] = React.useState<StorefrontDoc | null>(null);

    React.useEffect(() => {
        getStorefront(id).then(res => {
            if (res.ok) setSf(res.item as StorefrontDoc);
        });
    }, [id]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>{sf ? sf.displayName : 'Storefront Overview'}</PageTitle>
                    <PageDescription>Here is what is happening with your store today.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    {sf && (
                        <Button
                            size="sm"
                            variant="outline"
                            iconRight={ExternalLink}
                            onClick={() => window.open(`/store/${sf.slug}`, '_blank', 'noopener,noreferrer')}
                        >
                            View Live Store
                        </Button>
                    )}
                </PageActions>
            </PageHeader>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total Revenue"
                    value="₹45,231.89"
                    icon={DollarSign}
                    delta={{ value: '+20.1% from last month', tone: 'up' }}
                />
                <StatCard
                    label="Orders"
                    value="+2350"
                    icon={CreditCard}
                    delta={{ value: '+180.1% from last month', tone: 'up' }}
                />
                <StatCard
                    label="Sales"
                    value="+12,234"
                    icon={Activity}
                    delta={{ value: '+19% from last month', tone: 'up' }}
                />
                <StatCard
                    label="Active Now"
                    value="+573"
                    icon={Users}
                    delta={{ value: '-12% since last hour', tone: 'down' }}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Sales Overview</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="flex h-[300px] w-full items-end gap-2 px-4">
                            {SALES_BARS.map((h, i) => (
                                <div
                                    key={MONTHS[i]}
                                    className="flex-1 rounded-t-[var(--st-radius)] bg-[var(--st-accent)] transition-all hover:opacity-80"
                                    style={{ height: `${h}%` }}
                                />
                            ))}
                        </div>
                        <div className="mt-2 flex justify-between px-4 text-xs text-[var(--st-text-secondary)]">
                            {MONTHS.map(m => (
                                <span key={m}>{m}</span>
                            ))}
                        </div>
                    </CardBody>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Orders</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="flex flex-col gap-6">
                            {RECENT_ORDERS.map(order => (
                                <div key={order.id} className="flex items-center">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm font-medium leading-none text-[var(--st-text)]">{order.customer}</p>
                                        <p className="text-sm text-[var(--st-text-secondary)]">{order.email}</p>
                                    </div>
                                    <div className="ml-auto flex items-center gap-4">
                                        <Badge tone={orderTone(order.status)}>{order.status}</Badge>
                                        <div className="font-medium text-[var(--st-text)]">{order.amount}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
