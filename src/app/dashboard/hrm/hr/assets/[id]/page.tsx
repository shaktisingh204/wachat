/**
 * Asset detail page (§1D.2).
 *
 * Loads a single document from `hr_assets` for the current tenant and
 * renders an overview grid. Actions: Edit · Assign · Mark returned ·
 * Retire (stubs — see TODO 1D.2 markers).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    Package,
    Pencil,
    UserPlus,
    PackageCheck,
    Archive,
    ArrowLeft,
} from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruBadge, ZoruButton } from '@/components/zoruui';
import { statusToTone } from '@/components/crm/status-pill';
import {
    getHrEntityById,
    fmtDate,
    fmtCurrency,
    fmtText,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    markAssetReturned,
    retireAsset,
} from '@/app/actions/hr-status.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/assets';

export default async function AssetDetailPage({ params }: PageProps) {
    const { id } = await params;
    const asset = await getHrEntityById('hr_assets', id);
    if (!asset) notFound();

    const a = asset as Record<string, unknown>;
    const name = (a.name as string) || 'Untitled asset';
    const condition = String(a.condition || '—');
    const assignedTo = (a.assignedTo as string) || (a.custodian as string) || '';
    const currency = (a.currency as string) || 'INR';

    return (
        <EntityDetailShell
            title={name}
            eyebrow="HR · ASSET"
            back={{ href: BASE, label: 'All assets' }}
            status={{ label: condition, tone: statusToTone(condition) }}
            actions={
                <>
                    <Link href={BASE}>
                        <ZoruButton variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </ZoruButton>
                    </Link>
                    <Link href={`${BASE}/${id}/edit`}>
                        <ZoruButton size="sm">
                            <Pencil className="h-4 w-4" /> Edit
                        </ZoruButton>
                    </Link>
                    <Link href={`/dashboard/hrm/hr/asset-assignments/new?assetId=${id}`}>
                        <ZoruButton variant="outline" size="sm">
                            <UserPlus className="h-4 w-4" /> Assign
                        </ZoruButton>
                    </Link>
                    <HrActionButtons
                        actions={[
                            {
                                key: 'mark-returned',
                                kind: 'action',
                                label: 'Mark returned',
                                icon: <PackageCheck className="h-4 w-4" />,
                                onRun: () => markAssetReturned(id),
                            },
                            {
                                key: 'retire',
                                kind: 'confirm',
                                label: 'Retire',
                                icon: <Archive className="h-4 w-4" />,
                                variant: 'destructive',
                                confirmTitle: 'Retire this asset?',
                                confirmDescription:
                                    'Retired assets are marked unavailable and archived from inventory.',
                                confirmLabel: 'Retire asset',
                                onRun: () => retireAsset(id),
                            },
                        ]}
                    />
                </>
            }
            audit={<EntityAuditTimeline entityKind="asset" entityId={id} />}
        >
            <HrDetailGrid
                title="Overview"
                titleSlot={
                    assignedTo ? (
                        <ZoruBadge variant="info">Assigned</ZoruBadge>
                    ) : (
                        <ZoruBadge variant="success">Available</ZoruBadge>
                    )
                }
            >
                <HrDetailRow label="Asset name">{name}</HrDetailRow>
                <HrDetailRow label="Asset tag / code">
                    {fmtText(a.assetTag || a.code)}
                </HrDetailRow>
                <HrDetailRow label="Type / category">
                    {fmtText(a.category || a.type)}
                </HrDetailRow>
                <HrDetailRow label="Model">{fmtText(a.model)}</HrDetailRow>
                <HrDetailRow label="Serial #">{fmtText(a.serialNumber || a.serial)}</HrDetailRow>
                <HrDetailRow label="Location">{fmtText(a.location)}</HrDetailRow>
                <HrDetailRow label="Vendor">{fmtText(a.vendor)}</HrDetailRow>
                <HrDetailRow label="Custodian / assignee">
                    {fmtText(assignedTo || '—')}
                </HrDetailRow>
                <HrDetailRow label="Purchase date">
                    {fmtDate(a.purchaseDate)}
                </HrDetailRow>
                <HrDetailRow label="Purchase cost">
                    {fmtCurrency(a.purchaseCost, currency)}
                </HrDetailRow>
                <HrDetailRow label="Warranty expires">
                    {fmtDate(a.warrantyExpiresAt)}
                </HrDetailRow>
                <HrDetailRow label="Condition">
                    <ZoruBadge variant={condition === 'good' || condition === 'new' ? 'success' : 'warning'}>
                        {condition}
                    </ZoruBadge>
                </HrDetailRow>
                {a.notes ? (
                    <HrDetailRow label="Notes" fullWidth>
                        {String(a.notes)}
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            <Package className="hidden" />
        </EntityDetailShell>
    );
}
