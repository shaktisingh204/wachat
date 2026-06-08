import * as React from 'react';
import Link from 'next/link';
import { Plus, Store, ArrowUpRight } from 'lucide-react';

import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Badge,
    Alert,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    type BadgeTone,
} from '@/components/sabcrm/20ui';

import { listStorefronts } from '@/app/actions/sabshop.actions';

export const dynamic = 'force-dynamic';

interface StorefrontRow {
    _id: string;
    slug: string;
    displayName: string;
    currency?: string;
    status?: 'draft' | 'live' | 'paused';
}

function statusTone(s?: string): BadgeTone {
    if (s === 'live') return 'success';
    if (s === 'paused') return 'warning';
    return 'neutral';
}

export default async function SabShopPage(): Promise<React.JSX.Element> {
    const res = await listStorefronts();
    const items: StorefrontRow[] = res.ok ? (res.items as StorefrontRow[]) : [];

    return (
        <div className="20ui flex flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>SabShop</PageTitle>
                    <PageDescription>
                        Run multiple online stores from a single workspace.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/sabshop/new" className="u-btn u-btn--primary u-btn--md">
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New storefront</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {!res.ok ? (
                <Alert tone="danger" title="Could not load storefronts">
                    {res.error}
                </Alert>
            ) : items.length === 0 ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={Store}
                            title="No storefronts yet"
                            description="Spin up a tenant-scoped public store at /store/<slug>."
                            action={
                                <Link
                                    href="/dashboard/sabshop/new"
                                    className="u-btn u-btn--primary u-btn--md"
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    <span className="u-btn__label">Create first storefront</span>
                                </Link>
                            }
                        />
                    </CardBody>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((sf) => (
                        <Card key={sf._id}>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-2">
                                    <CardTitle className="text-base">{sf.displayName}</CardTitle>
                                    <Badge tone={statusTone(sf.status)}>{sf.status ?? 'draft'}</Badge>
                                </div>
                            </CardHeader>
                            <CardBody className="flex flex-col gap-3 text-sm">
                                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                                    <span>/store/{sf.slug}</span>
                                    <span>{sf.currency ?? 'INR'}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        href={`/dashboard/sabshop/${sf._id}`}
                                        className="u-btn u-btn--outline u-btn--sm"
                                    >
                                        <span className="u-btn__label">Settings</span>
                                    </Link>
                                    <Link
                                        href={`/dashboard/sabshop/${sf._id}/products`}
                                        className="u-btn u-btn--outline u-btn--sm"
                                    >
                                        <span className="u-btn__label">Products</span>
                                    </Link>
                                    <Link
                                        href={`/dashboard/sabshop/${sf._id}/orders`}
                                        className="u-btn u-btn--outline u-btn--sm"
                                    >
                                        <span className="u-btn__label">Orders</span>
                                    </Link>
                                    <Link
                                        href={`/store/${sf.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="u-btn u-btn--ghost u-btn--sm"
                                    >
                                        <span className="u-btn__label">View store</span>
                                        <ArrowUpRight size={13} aria-hidden="true" />
                                    </Link>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
