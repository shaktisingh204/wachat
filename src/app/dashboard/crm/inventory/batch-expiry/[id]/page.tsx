import { Button, Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
    AlertTriangle,
  Pencil,
  } from 'lucide-react';

/**
 * Batch detail — server component.
 *
 * Loads the batch via `getCrmItemBatchById` and renders summary +
 * expiry alert banner. Red banner if expired; amber if within 30 days.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';

import { getCrmItemBatchById } from '@/app/actions/crm-item-batches.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/batch-expiry';
const SOON_DAYS = 30;

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function daysUntil(value: unknown): number | null {
    if (!value) return null;
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}

function toneFor(status: string | undefined, expired: boolean, soon: boolean): StatusTone {
    if (status === 'recalled' || expired) return 'red';
    if (status === 'archived') return 'neutral';
    if (soon) return 'amber';
    return 'green';
}

export default async function BatchDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const batch = await getCrmItemBatchById(id);
    if (!batch) notFound();

    const days = daysUntil(batch.expiryDate);
    const expired = days != null && days < 0;
    const soon = days != null && days >= 0 && days <= SOON_DAYS;

    return (
        <EntityDetailShell
            eyebrow="BATCH"
            title={batch.batchNumber}
            back={{ href: BASE, label: 'Batch & expiry' }}
            actions={
                <ZoruButton asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Link>
                </ZoruButton>
            }
        >

            {/* Expiry alert */}
            {expired ? (
                <ZoruCard className="flex items-center gap-3 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
                    <div className="text-[13px] text-red-700 dark:text-red-200">
                        This batch expired {Math.abs(days!)} day
                        {Math.abs(days!) === 1 ? '' : 's'} ago. Quarantine remaining
                        stock immediately.
                    </div>
                </ZoruCard>
            ) : soon ? (
                <ZoruCard className="flex items-center gap-3 border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                    <div className="text-[13px] text-amber-700 dark:text-amber-200">
                        Expires in {days} day{days === 1 ? '' : 's'}. Plan rotation
                        or markdown.
                    </div>
                </ZoruCard>
            ) : null}

            {/* Summary card */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">
                        Overview
                    </div>
                    <StatusPill
                        label={batch.status ?? 'active'}
                        tone={toneFor(batch.status, expired, soon)}
                    />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Item</div>
                        <div className="text-zoru-ink">{batch.itemName}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Batch number</div>
                        <div className="font-mono text-zoru-ink">{batch.batchNumber}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Manufacture date</div>
                        <div className="text-zoru-ink">{fmtDate(batch.manufactureDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Expiry date</div>
                        <div
                            className={
                                expired
                                    ? 'font-medium text-red-700 dark:text-red-300'
                                    : soon
                                      ? 'font-medium text-amber-700 dark:text-amber-300'
                                      : 'text-zoru-ink'
                            }
                        >
                            {fmtDate(batch.expiryDate)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Quantity</div>
                        <div className="font-mono text-zoru-ink">
                            {batch.quantity}
                            {batch.unit ? ` ${batch.unit}` : ''}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Cost price</div>
                        <div className="font-mono text-zoru-ink">
                            {typeof batch.costPrice === 'number'
                                ? batch.costPrice.toLocaleString('en-IN', {
                                      style: 'currency',
                                      currency: 'INR',
                                      maximumFractionDigits: 2,
                                  })
                                : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Location</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {batch.locationId ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Supplier</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {batch.supplierId ?? '—'}
                        </div>
                    </div>
                    {batch.notes ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Notes</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {batch.notes}
                            </div>
                        </div>
                    ) : null}
                </div>
            </ZoruCard>
        </EntityDetailShell>
    );
}
