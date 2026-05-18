import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getAssetById } from '@/app/actions/crm-assets.actions';
import type { CrmAssetStatus } from '@/lib/rust-client/crm-assets';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr/assets';

const STATUS_TONE: Record<CrmAssetStatus, StatusTone> = {
    available: 'green',
    assigned: 'blue',
    in_repair: 'amber',
    retired: 'neutral',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(amount: unknown, currency?: string): string {
    if (amount == null || amount === '') return '—';
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    return `${currency || 'INR'} ${n.toLocaleString()}`;
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
        <EntityDetailShell
            title={asset.name}
            eyebrow="ASSET"
            back={{ href: BASE, label: 'Assets' }}
            actions={
                <div className="flex items-center gap-2">
                    <ZoruButton variant="outline" asChild>
                        <Link href={`/dashboard/crm/hr/asset-assignments/new?assetId=${assetId}&assetName=${encodeURIComponent(asset.name)}`}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Assign
                        </Link>
                    </ZoruButton>
                    <ZoruButton asChild>
                        <Link href={`${BASE}/${assetId}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Link>
                    </ZoruButton>
                </div>
            }
        >

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill label={pretty(status)} tone={tone} />
                    {tags.map((t) => (
                        <ZoruBadge key={t} variant="ghost">
                            {t}
                        </ZoruBadge>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Asset tag</div>
                        <div className="font-mono text-zoru-ink">{asset.assetTag}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Category</div>
                        <div className="capitalize text-zoru-ink">{pretty(asset.category as string | undefined)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Brand</div>
                        <div className="text-zoru-ink">{asset.brand || '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Model</div>
                        <div className="text-zoru-ink">{asset.model || '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Serial number</div>
                        <div className="font-mono text-zoru-ink">{asset.serialNumber || '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Condition</div>
                        <div className="capitalize text-zoru-ink">{pretty(asset.condition as string | undefined)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Purchase date</div>
                        <div className="text-zoru-ink">{fmtDate(asset.purchaseDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Purchase price</div>
                        <div className="text-zoru-ink">{fmtMoney(asset.purchasePrice, asset.currency)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Warranty expiry</div>
                        <div className="text-zoru-ink">{fmtDate(asset.warrantyExpiry)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Location</div>
                        <div className="text-zoru-ink">{asset.location || '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Current assignee</div>
                        <div className="text-zoru-ink">
                            {asset.currentAssigneeName || asset.currentAssigneeId || '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Branch</div>
                        <div className="text-zoru-ink">{asset.branchId || '—'}</div>
                    </div>
                    {asset.notes ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Notes</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">{asset.notes}</div>
                        </div>
                    ) : null}
                </div>
            </ZoruCard>
        </EntityDetailShell>
    );
}
