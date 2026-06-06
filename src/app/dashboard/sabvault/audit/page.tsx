import * as React from 'react';
import Link from 'next/link';

import {
    Button,
    ZoruCard,
    ZoruBadge,
    ZoruEmptyState,
} from '@/components/sabcrm/20ui/compat';
import { listSabvaultAudit } from '@/app/actions/sabvault.actions';
import type { SabvaultAuditAction } from '@/lib/rust-client/sabvault-audit';

export const dynamic = 'force-dynamic';

export default async function SabvaultAuditPage(props: {
    searchParams: Promise<{ action?: string; secretId?: string; page?: string }>;
}) {
    const sp = await props.searchParams;
    const page = Math.max(0, Number(sp.page) || 0);
    const res = await listSabvaultAudit({
        action: sp.action as SabvaultAuditAction | undefined,
        secretId: sp.secretId,
        page,
        limit: 50,
    });

    return (
        <div className="zoruui mx-auto flex max-w-5xl flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">SabVault audit log</h1>
                <Link href="/dashboard/sabvault">
                    <Button variant="outline">Back to vault</Button>
                </Link>
            </div>

            <div className="flex gap-2 text-sm">
                <FilterChip current={sp.action} value={undefined} label="All" />
                <FilterChip current={sp.action} value="reveal" label="Reveals" />
                <FilterChip current={sp.action} value="copy" label="Copies" />
                <FilterChip current={sp.action} value="share" label="Shares" />
                <FilterChip current={sp.action} value="unlock_fail" label="Failed unlocks" />
            </div>

            <ZoruCard className="p-0">
                {res.items.length === 0 ? (
                    <div className="p-6">
                        <ZoruEmptyState title="No events" description="Audit events show up here as you use the vault." />
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b text-left text-xs uppercase text-[var(--zoru-text-muted)]">
                            <tr>
                                <th className="px-4 py-2">Time</th>
                                <th className="px-4 py-2">Action</th>
                                <th className="px-4 py-2">Actor</th>
                                <th className="px-4 py-2">Secret</th>
                                <th className="px-4 py-2">IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {res.items.map((e) => (
                                <tr key={e._id} className="border-b">
                                    <td className="px-4 py-2 font-mono text-xs">
                                        {new Date(e.ts).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2">
                                        <ZoruBadge>{e.action}</ZoruBadge>
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs">{e.actorUserId}</td>
                                    <td className="px-4 py-2 font-mono text-xs">{e.secretId ?? '—'}</td>
                                    <td className="px-4 py-2 text-xs">{e.ip ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </ZoruCard>

            {res.hasMore ? (
                <div className="flex justify-end">
                    <Link
                        href={`/dashboard/sabvault/audit?page=${page + 1}${sp.action ? `&action=${sp.action}` : ''}`}
                    >
                        <Button variant="outline">Next page</Button>
                    </Link>
                </div>
            ) : null}
        </div>
    );
}

function FilterChip({ current, value, label }: { current?: string; value?: string; label: string }) {
    const active = (current ?? undefined) === value;
    const href = value
        ? `/dashboard/sabvault/audit?action=${value}`
        : '/dashboard/sabvault/audit';
    return (
        <Link
            href={href}
            className={`rounded-md border px-3 py-1 ${
                active
                    ? 'bg-[var(--zoru-bg-subtle)] font-medium'
                    : 'border-[var(--st-border)]'
            }`}
        >
            {label}
        </Link>
    );
}
