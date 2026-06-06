import { fmtDate, fmtINR } from '@/lib/utils';
import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  Pencil,
  UserPlus } from 'lucide-react';

/**
 * Asset detail page — server component.
 */

import Link from 'next/link';
import QRCode from 'react-qr-code';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getAssetById } from '@/app/actions/crm-assets.actions';
import type { CrmAssetStatus } from '@/lib/rust-client/crm-assets';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/assets';

const STATUS_TONE: Record<CrmAssetStatus, StatusTone> = {
    available: 'green',
    assigned: 'blue',
    in_repair: 'amber',
    retired: 'neutral',
    archived: 'neutral',
};





function calculateDepreciation(purchasePrice: unknown, purchaseDate: unknown, currency?: string): string {
    if (purchasePrice == null || purchasePrice === '' || !purchaseDate) return '—';
    
    let price = Number(purchasePrice);
    if (!Number.isFinite(price) && typeof purchasePrice === 'string') {
        price = Number(purchasePrice.replace(/[^\d.-]/g, ''));
    }
    if (!Number.isFinite(price) || Number.isNaN(price)) return '—';

    const pDate = new Date(purchaseDate as string);
    if (Number.isNaN(pDate.getTime())) return '—';

    const now = new Date();
    let months = (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth());
    if (now.getDate() < pDate.getDate()) {
        months -= 1;
    }
    
    if (months >= 36) return fmtINR(0, currency);
    if (months <= 0) return fmtINR(price, currency);

    const currentVal = price - (price * (months / 36));
    return fmtINR(Math.max(0, currentVal), currency);
}

function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

export default async function AssetDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: assetId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const asset = await getAssetById(assetId);
    if (!asset) notFound();

    const status = (asset.status ?? 'available') as CrmAssetStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const tags = Array.isArray(asset.tags) ? asset.tags : [];

    return (
        <EntityListShell
            title={asset.name}
            subtitle={`Tag · ${asset.assetTag}`}
            primaryAction={
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href={`/dashboard/hrm/hr/asset-assignments/new?assetId=${assetId}&assetName=${encodeURIComponent(asset.name)}`}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Assign
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`${BASE}/${assetId}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Link>
                    </Button>
                </div>
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">Overview</div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    {tags.map((t) => (
                        <Badge key={t} variant="ghost">
                            {t}
                        </Badge>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-[var(--st-text-secondary)] mb-2">Asset tag</div>
                        <div className="flex items-start gap-4">
                            <div className="font-mono text-[var(--st-text)]">{asset.assetTag}</div>
                            {asset.assetTag && (
                                <div className="rounded-md border border-[var(--st-border)] p-1 bg-white">
                                    <QRCode value={asset.assetTag} size={48} />
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Category</div>
                        <div className="capitalize text-[var(--st-text)]">{pretty(asset.category as string | undefined)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Brand</div>
                        <div className="text-[var(--st-text)]">{asset.brand || '—'}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Model</div>
                        <div className="text-[var(--st-text)]">{asset.model || '—'}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Serial number</div>
                        <div className="font-mono text-[var(--st-text)]">{asset.serialNumber || '—'}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Condition</div>
                        <div className="capitalize text-[var(--st-text)]">{pretty(asset.condition as string | undefined)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Purchase date</div>
                        <div className="text-[var(--st-text)]">{fmtDate(asset.purchaseDate)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Purchase price</div>
                        <div className="text-[var(--st-text)]">{fmtINR(asset.purchasePrice, asset.currency)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Depreciated value (3yr SL)</div>
                        <div className="text-[var(--st-text)]">{calculateDepreciation(asset.purchasePrice, asset.purchaseDate, asset.currency)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Warranty expiry</div>
                        <div className="text-[var(--st-text)]">{fmtDate(asset.warrantyExpiry)}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Location</div>
                        <div className="text-[var(--st-text)]">{asset.location || '—'}</div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Current assignee</div>
                        <div className="text-[var(--st-text)]">
                            {asset.currentAssigneeName || asset.currentAssigneeId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Branch</div>
                        <div className="text-[var(--st-text)]">{asset.branchId || '—'}</div>
                    </div>
                    {asset.notes ? (
                        <div className="sm:col-span-2">
                            <div className="text-[var(--st-text-secondary)]">Notes</div>
                            <div className="whitespace-pre-wrap text-[var(--st-text)]">{asset.notes}</div>
                        </div>
                    ) : null}
                </div>
            </Card>
        </EntityListShell>
    );
}
