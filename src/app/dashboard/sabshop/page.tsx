import * as React from 'react';
import Link from 'next/link';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Badge } from '@/components/sabcrm/20ui/compat';
import { Plus, Store } from 'lucide-react';

import { listStorefronts } from '@/app/actions/sabshop.actions';

export const dynamic = 'force-dynamic';

interface StorefrontRow {
    _id: string;
    slug: string;
    displayName: string;
    currency?: string;
    status?: 'draft' | 'live' | 'paused';
}

function statusVariant(s?: string): 'success' | 'warning' | 'ghost' {
    if (s === 'live') return 'success';
    if (s === 'paused') return 'warning';
    return 'ghost';
}

export default async function SabShopPage(): Promise<React.JSX.Element> {
    const res = await listStorefronts();
    const items: StorefrontRow[] = res.ok ? (res.items as StorefrontRow[]) : [];

    return (
        <div className="zoruui flex flex-col gap-6 p-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-zoru-ink">SabShop</h1>
                    <p className="text-sm text-zoru-ink-muted">
                        Run multiple online stores from a single workspace.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/sabshop/new">
                        <Plus className="h-4 w-4" /> New storefront
                    </Link>
                </Button>
            </header>

            {!res.ok ? (
                <Card>
                    <ZoruCardContent className="p-6 text-sm text-zoru-ink">
                        {res.error}
                    </ZoruCardContent>
                </Card>
            ) : items.length === 0 ? (
                <Card>
                    <ZoruCardContent className="flex flex-col items-center gap-3 p-12 text-center">
                        <Store className="h-10 w-10 text-zoru-ink-muted" />
                        <h2 className="text-lg font-medium text-zoru-ink">No storefronts yet</h2>
                        <p className="text-sm text-zoru-ink-muted">
                            Spin up a tenant-scoped public store at <code>/store/&lt;slug&gt;</code>.
                        </p>
                        <Button asChild>
                            <Link href="/dashboard/sabshop/new">
                                <Plus className="h-4 w-4" /> Create first storefront
                            </Link>
                        </Button>
                    </ZoruCardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((sf) => (
                        <Card key={sf._id}>
                            <ZoruCardHeader>
                                <div className="flex items-center justify-between gap-2">
                                    <ZoruCardTitle className="text-base">{sf.displayName}</ZoruCardTitle>
                                    <Badge variant={statusVariant(sf.status)}>{sf.status ?? 'draft'}</Badge>
                                </div>
                            </ZoruCardHeader>
                            <ZoruCardContent className="flex flex-col gap-3 text-sm">
                                <div className="flex items-center justify-between text-zoru-ink-muted">
                                    <span>/store/{sf.slug}</span>
                                    <span>{sf.currency ?? 'INR'}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" asChild>
                                        <Link href={`/dashboard/sabshop/${sf._id}`}>Settings</Link>
                                    </Button>
                                    <Button size="sm" variant="outline" asChild>
                                        <Link href={`/dashboard/sabshop/${sf._id}/products`}>Products</Link>
                                    </Button>
                                    <Button size="sm" variant="outline" asChild>
                                        <Link href={`/dashboard/sabshop/${sf._id}/orders`}>Orders</Link>
                                    </Button>
                                    <Button size="sm" variant="ghost" asChild>
                                        <Link href={`/store/${sf.slug}`} target="_blank">View store →</Link>
                                    </Button>
                                </div>
                            </ZoruCardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
