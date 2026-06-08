import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Globe, Package, Plus, ShoppingBag, Store } from 'lucide-react';

import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Separator,
    StatCard,
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

function statusLabel(s?: string): string {
    if (s === 'live') return 'Live';
    if (s === 'paused') return 'Paused';
    return 'Draft';
}

export default async function SabShopPage(): Promise<React.JSX.Element> {
    const res = await listStorefronts();
    const items: StorefrontRow[] = res.ok ? (res.items as StorefrontRow[]) : [];

    const liveCount = items.filter((s) => s.status === 'live').length;
    const draftCount = items.filter((s) => (s.status ?? 'draft') === 'draft').length;

    return (
        <div className="20ui flex flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>SabShop</PageTitle>
                    <PageDescription>
                        Run multiple tenant-scoped online stores from a single workspace.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button asChild variant="primary">
                        <Link href="/dashboard/sabshop/new">
                            <Plus size={14} aria-hidden="true" />
                            New storefront
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            {res.ok && items.length > 0 ? (
                <section aria-label="Store summary" className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Storefronts"
                        value={<span className="tabular-nums">{items.length}</span>}
                        icon={Store}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Live"
                        value={<span className="tabular-nums">{liveCount}</span>}
                        icon={Globe}
                        accent="#1f9d55"
                    />
                    <StatCard
                        label="In draft"
                        value={<span className="tabular-nums">{draftCount}</span>}
                        icon={Package}
                        accent="#d97706"
                    />
                </section>
            ) : null}

            {!res.ok ? (
                <Alert tone="danger" title="Could not load storefronts">
                    {res.error}
                </Alert>
            ) : items.length === 0 ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={ShoppingBag}
                            title="No storefronts yet"
                            description="Create your first store to start selling at /store/<slug>."
                            action={
                                <Button asChild variant="primary">
                                    <Link href="/dashboard/sabshop/new">
                                        <Plus size={14} aria-hidden="true" />
                                        Create first storefront
                                    </Link>
                                </Button>
                            }
                        />
                    </CardBody>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((sf) => (
                        <Card key={sf._id} variant="elevated">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                                            aria-hidden="true"
                                        >
                                            <Store size={16} />
                                        </span>
                                        <CardTitle className="truncate text-base">{sf.displayName}</CardTitle>
                                    </div>
                                    <Badge tone={statusTone(sf.status)}>{statusLabel(sf.status)}</Badge>
                                </div>
                            </CardHeader>
                            <CardBody className="flex flex-col gap-3 text-sm">
                                <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                                    <span className="truncate">/store/{sf.slug}</span>
                                    <span className="tabular-nums">{sf.currency ?? 'INR'}</span>
                                </div>
                                <Separator />
                                <div className="flex flex-wrap gap-2">
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={`/dashboard/sabshop/${sf._id}`}>Overview</Link>
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={`/dashboard/sabshop/${sf._id}/products`}>Products</Link>
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={`/dashboard/sabshop/${sf._id}/orders`}>Orders</Link>
                                    </Button>
                                    <Button asChild variant="ghost" size="sm">
                                        <Link
                                            href={`/store/${sf.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            View store
                                            <ArrowUpRight size={13} aria-hidden="true" />
                                        </Link>
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
