import * as React from 'react';
import Link from 'next/link';

import { Button, Card, StatCard, Badge, EmptyState } from '@/components/sabcrm/20ui';
import { listSabvaultSecrets } from '@/app/actions/sabvault.actions';
import type { SabvaultSecretDoc } from '@/lib/rust-client/sabvault-secrets';

export const dynamic = 'force-dynamic';

/**
 * Health dashboard — weak / reused / breached / expiring secret counts.
 * Reads the server-side health flags that the client populates after
 * decryption (`strength`, `reused`, `breached`).
 */
export default async function SabvaultHealthPage() {
    // Pull up to 500 secrets — enough for any single-user vault for now.
    const res = await listSabvaultSecrets({ limit: 100, status: 'active' });
    const secrets = res.items;

    const weak = secrets.filter((s) => s.strength === 'weak' || s.strength === 'fair');
    const reused = secrets.filter((s) => !!s.reused);
    const breached = secrets.filter((s) => !!s.breached);
    const now = Date.now();
    const expiring = secrets.filter((s) => {
        if (!s.expiresAt) return false;
        const t = new Date(s.expiresAt).getTime();
        return t > now && t - now < 30 * 24 * 60 * 60 * 1000;
    });

    return (
        <div className="zoruui mx-auto flex max-w-5xl flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Vault health</h1>
                <Link href="/dashboard/sabvault">
                    <Button variant="outline">Back to vault</Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Weak" value={String(weak.length)} />
                <StatCard label="Reused" value={String(reused.length)} />
                <StatCard label="Breached" value={String(breached.length)} />
                <StatCard label="Expiring < 30d" value={String(expiring.length)} />
            </div>

            <HealthBucket title="Breached" items={breached} variant="destructive" />
            <HealthBucket title="Weak passwords" items={weak} />
            <HealthBucket title="Reused" items={reused} />
            <HealthBucket title="Expiring soon" items={expiring} />
        </div>
    );
}

function HealthBucket({
    title,
    items,
    variant,
}: {
    title: string;
    items: SabvaultSecretDoc[];
    variant?: 'destructive';
}) {
    return (
        <Card className="p-0">
            <div className="border-b px-4 py-2 text-sm font-semibold">{title}</div>
            {items.length === 0 ? (
                <div className="p-4">
                    <EmptyState title="Nothing here" description="All clear." />
                </div>
            ) : (
                <ul className="divide-y">
                    {items.map((s) => (
                        <li key={s._id} className="flex items-center justify-between px-4 py-2">
                            <Link
                                href={`/dashboard/sabvault/${s._id}`}
                                className="flex-1 text-sm hover:underline"
                            >
                                {s.name}
                            </Link>
                            <div className="flex items-center gap-2 text-xs">
                                {variant === 'destructive' ? (
                                    <Badge variant="destructive">{title}</Badge>
                                ) : (
                                    <Badge>{title}</Badge>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
