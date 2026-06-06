'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    Activity,
    CreditCard,
    DollarSign,
    Package,
    ArrowUpRight,
    ArrowDownRight,
    Users
} from 'lucide-react';

import { Card, CardBody, CardHeader, CardTitle, Button, Badge, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';

import { getStorefront } from '@/app/actions/sabshop.actions';

interface StorefrontDoc {
    _id: string;
    slug: string;
    displayName: string;
    currency?: string;
    status?: string;
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
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-[var(--st-text)]">
                        {sf ? sf.displayName : 'Storefront Overview'}
                    </h1>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        Here's what's happening with your store today.
                    </p>
                </div>
                <div className="flex gap-2">
                    {sf && (
                        <Button size="sm" variant="outline" asChild>
                            <Link href={`/store/${sf.slug}`} target="_blank">View Live Store</Link>
                        </Button>
                    )}
                </div>
            </header>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    </CardHeader>
                    <CardBody>
                        <div className="text-2xl font-bold">₹45,231.89</div>
                        <p className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 mt-1 text-green-600">
                            <ArrowUpRight className="h-3 w-3" />
                            +20.1% from last month
                        </p>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Orders</CardTitle>
                        <CreditCard className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    </CardHeader>
                    <CardBody>
                        <div className="text-2xl font-bold">+2350</div>
                        <p className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 mt-1 text-green-600">
                            <ArrowUpRight className="h-3 w-3" />
                            +180.1% from last month
                        </p>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Sales</CardTitle>
                        <Activity className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    </CardHeader>
                    <CardBody>
                        <div className="text-2xl font-bold">+12,234</div>
                        <p className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 mt-1 text-green-600">
                            <ArrowUpRight className="h-3 w-3" />
                            +19% from last month
                        </p>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Now</CardTitle>
                        <Users className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    </CardHeader>
                    <CardBody>
                        <div className="text-2xl font-bold">+573</div>
                        <p className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 mt-1 text-red-500">
                            <ArrowDownRight className="h-3 w-3" />
                            -12% since last hour
                        </p>
                    </CardBody>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Sales Overview</CardTitle>
                    </CardHeader>
                    <CardBody className="pl-2">
                        <div className="h-[300px] w-full flex items-end gap-2 px-4">
                            {/* Fake bar chart using divs */}
                            {[40, 25, 60, 80, 50, 90, 75, 45, 65, 85, 55, 70].map((h, i) => (
                                <div key={i} className="bg-[var(--st-text)] flex-1 rounded-t-sm transition-all hover:bg-opacity-80" style={{ height: `${h}%` }}></div>
                            ))}
                        </div>
                        <div className="flex justify-between px-4 mt-2 text-xs text-[var(--st-text-secondary)]">
                            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                            <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                        </div>
                    </CardBody>
                </Card>
                
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Orders</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-6">
                            {[
                                { id: '#1024', customer: 'Olivia Martin', email: 'olivia.m@email.com', amount: '₹1,999.00', status: 'Paid' },
                                { id: '#1023', customer: 'Jackson Lee', email: 'lee@example.com', amount: '₹39.00', status: 'Pending' },
                                { id: '#1022', customer: 'Isabella Nguyen', email: 'isabella.n@email.com', amount: '₹299.00', status: 'Paid' },
                                { id: '#1021', customer: 'William Kim', email: 'will@email.com', amount: '₹99.00', status: 'Unpaid' },
                                { id: '#1020', customer: 'Sofia Davis', email: 'sofia.d@email.com', amount: '₹39.00', status: 'Paid' },
                            ].map(order => (
                                <div key={order.id} className="flex items-center">
                                    <div className="ml-0 space-y-1">
                                        <p className="text-sm font-medium leading-none">{order.customer}</p>
                                        <p className="text-sm text-[var(--st-text-secondary)]">{order.email}</p>
                                    </div>
                                    <div className="ml-auto flex items-center gap-4">
                                        <Badge variant={order.status === 'Paid' ? 'success' : order.status === 'Pending' ? 'warning' : 'destructive'}>{order.status}</Badge>
                                        <div className="font-medium">{order.amount}</div>
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
