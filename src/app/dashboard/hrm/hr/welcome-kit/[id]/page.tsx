import { fmtDate } from '@/lib/utils';
import { Button, Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Check, Pencil } from 'lucide-react';

/**
 * Welcome kit detail page — server component.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getWelcomeKitById } from '@/app/actions/crm-welcome-kits.actions';
import type { CrmWelcomeKitStatus } from '@/app/actions/crm-welcome-kits.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/welcome-kit';

const STATUS_TONE: Record<CrmWelcomeKitStatus, StatusTone> = {
    pending: 'amber',
    shipped: 'blue',
    delivered: 'green',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : fmtDate(d);
}

export default async function WelcomeKitDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const kit = await getWelcomeKitById(id);
    if (!kit) notFound();

    const status = (kit.status ?? 'pending') as CrmWelcomeKitStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const title = kit.employee_name || kit.employee_id;
    const items = Array.isArray(kit.items) ? kit.items : [];
    const deliveredCount = items.filter((it) => it.delivered).length;

    return (
        <EntityListShell
            title={title}
            subtitle={`Welcome kit for ${kit.employee_name || kit.employee_id}`}
            primaryAction={
                <Button asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill label={status} tone={tone} />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Employee</div>
                        <div className="text-zoru-ink">{kit.employee_name || '—'}</div>
                        <div className="font-mono text-[11.5px] text-zoru-ink-muted">
                            {kit.employee_id}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Tracking</div>
                        <div className="font-mono text-zoru-ink">
                            {kit.tracking_number ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Items delivered</div>
                        <div className="font-mono text-zoru-ink">
                            {deliveredCount} / {items.length}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Created</div>
                        <div className="text-zoru-ink">{fmtDate(kit.createdAt)}</div>
                    </div>
                    {kit.shipping_address ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Shipping address</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {kit.shipping_address}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                    Items ({items.length})
                </div>
                {items.length === 0 ? (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                        No items have been added to this kit.
                    </div>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {items.map((it, idx) => (
                            <li
                                key={idx}
                                className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 py-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] text-zoru-ink">
                                        {it.name}
                                    </div>
                                    {it.sku ? (
                                        <div className="truncate font-mono text-[11px] text-zoru-ink-muted">
                                            {it.sku}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-3 text-[12px] text-zoru-ink-muted">
                                    {it.delivered_at ? (
                                        <span>{fmtDate(it.delivered_at)}</span>
                                    ) : null}
                                    {it.delivered ? (
                                        <span className="flex items-center gap-1 text-[var(--zoru-success,green)]">
                                            <Check className="h-3.5 w-3.5" /> delivered
                                        </span>
                                    ) : (
                                        <span>pending</span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </EntityListShell>
    );
}
