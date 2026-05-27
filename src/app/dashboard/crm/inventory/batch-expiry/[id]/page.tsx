import { Button, Card } from '@/components/zoruui';
import { notFound, redirect } from 'next/navigation';
import { AlertTriangle, Pencil, Package, MapPin, Truck } from 'lucide-react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityRelatedRail } from '@/components/crm/entity-related-rail';
import { getSession } from '@/app/actions/user.actions';
import { getCrmItemBatchById } from '@/app/actions/crm-item-batches.actions';
import { fmtDate, fmtINR } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/batch-expiry';
const SOON_DAYS = 30;

function daysUntil(value: string | undefined): number | null {
    if (!value) return null;
    const d = new Date(value);
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

    const rightRail = (
        <EntityRelatedRail
            initial={{
                item: batch.itemId ? 1 : 0,
                location: batch.locationId ? 1 : 0,
                supplier: batch.supplierId ? 1 : 0
            }}
            items={[
                {
                    key: 'item',
                    label: 'Product Item',
                    icon: <Package className="h-4 w-4" />,
                    href: batch.itemId ? `/dashboard/crm/inventory/items/${batch.itemId}` : undefined,
                    hideWhenZero: true,
                },
                {
                    key: 'location',
                    label: 'Location',
                    icon: <MapPin className="h-4 w-4" />,
                    href: batch.locationId ? `/dashboard/crm/settings/inventory/locations` : undefined,
                    hideWhenZero: true,
                },
                {
                    key: 'supplier',
                    label: 'Supplier',
                    icon: <Truck className="h-4 w-4" />,
                    href: batch.supplierId ? `/dashboard/crm/contacts/${batch.supplierId}` : undefined,
                    hideWhenZero: true,
                }
            ]}
        />
    );

    return (
        <EntityDetailShell
            eyebrow="BATCH"
            title={batch.batchNumber}
            back={{ href: BASE, label: 'Batch & expiry' }}
            rightRail={rightRail}
            audit={<EntityAuditTimeline entityKind="item_batch" entityId={id} />}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Link>
                </Button>
            }
        >
            {/* Expiry alert */}
            {expired ? (
                <Card className="flex items-center gap-3 border-zoru-line bg-zoru-surface-2 p-4 dark:border-zoru-line dark:bg-zoru-ink/40">
                    <AlertTriangle className="h-5 w-5 text-zoru-ink dark:text-zoru-ink-muted" />
                    <div className="text-[13px] text-zoru-ink dark:text-white">
                        This batch expired {Math.abs(days!)} day{Math.abs(days!) === 1 ? '' : 's'} ago. Quarantine remaining stock immediately.
                    </div>
                </Card>
            ) : soon ? (
                <Card className="flex items-center gap-3 border-zoru-line bg-zoru-surface-2 p-4 dark:border-zoru-line dark:bg-zoru-ink/40">
                    <AlertTriangle className="h-5 w-5 text-zoru-ink dark:text-zoru-ink-muted" />
                    <div className="text-[13px] text-zoru-ink dark:text-white">
                        Expires in {days} day{days === 1 ? '' : 's'}. Plan rotation or markdown.
                    </div>
                </Card>
            ) : null}

            {/* Summary card */}
            <Card className="p-6">
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
                                    ? 'font-medium text-zoru-ink dark:text-zoru-ink-muted'
                                    : soon
                                      ? 'font-medium text-zoru-ink dark:text-zoru-ink-muted'
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
                            {fmtINR(batch.costPrice)}
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
            </Card>
        </EntityDetailShell>
    );
}
