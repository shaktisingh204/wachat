/**
 * Fixed asset detail page — server component.
 *
 * Renders two ZoruCards:
 *   1. Asset Details — code, name, category, purchase date, supplier,
 *      cost, location, custodian, status badge.
 *   2. Depreciation & Lifecycle — method, useful life, residual value,
 *      accumulated depreciation, computed NBV, warranty expiry,
 *      insurance expiry, notes (full-width if present).
 *
 * Guards: getSession() redirect + ObjectId.isValid + not-found redirect.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, Building2 } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { getFixedAssetById } from '@/app/actions/crm-fixed-assets.actions';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function fmtINR(n: unknown): string {
    if (typeof n !== 'number' || Number.isNaN(n)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
    } catch {
        return `INR ${n.toFixed(2)}`;
    }
}

function statusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
    switch ((status ?? '').toLowerCase()) {
        case 'active':
        case 'in_use':
            return 'success';
        case 'retired':
        case 'sold':
            return 'danger';
        case 'under_maintenance':
            return 'warning';
        default:
            return 'ghost';
    }
}

function methodLabel(method?: string): string {
    if (!method) return '—';
    const map: Record<string, string> = { slm: 'SLM', wdv: 'WDV', units: 'Units' };
    return map[method.toLowerCase()] ?? method.toUpperCase();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function FixedAssetDetailPage({
    params,
}: {
    params: Promise<{ assetId: string }>;
}) {
    const { assetId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/dashboard/crm/fixed-assets');
    if (!ObjectId.isValid(assetId)) redirect('/dashboard/crm/fixed-assets');

    const asset = await getFixedAssetById(assetId);
    if (!asset) redirect('/dashboard/crm/fixed-assets');

    // -----------------------------------------------------------------------
    // Field extraction
    // -----------------------------------------------------------------------
    const a = asset as Record<string, unknown>;

    const assetCode = (a.assetCode as string) || '';
    const name = (a.name as string) || 'Untitled asset';
    const category = (a.category as string) || '—';
    const purchaseDate = a.purchaseDate;
    const supplierName = (a.supplierName as string) || '—';
    const cost = typeof a.cost === 'number' ? a.cost : undefined;
    const location = (a.location as string) || '—';
    const custodianName = (a.custodianName as string) || '—';
    const status = (a.status as string) || 'active';

    const depreciationMethod = (a.depreciationMethod as string) || undefined;
    const usefulLifeMonths = typeof a.usefulLifeMonths === 'number' ? a.usefulLifeMonths : undefined;
    const residualValue = typeof a.residualValue === 'number' ? a.residualValue : undefined;
    const accumulatedDepreciation =
        typeof a.accumulatedDepreciation === 'number' ? a.accumulatedDepreciation : undefined;
    const nbv =
        typeof cost === 'number' && typeof accumulatedDepreciation === 'number'
            ? cost - accumulatedDepreciation
            : undefined;
    const warrantyExpiry = a.warrantyExpiry;
    const insuranceExpiry = a.insuranceExpiry;
    const notes = (a.notes as string) || '';

    const headerTitle = assetCode ? `${assetCode} · ${name}` : name;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={headerTitle}
                subtitle="Fixed asset detail"
                icon={Building2}
                actions={
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/crm/fixed-assets">
                            <ZoruButton variant="outline">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </ZoruButton>
                        </Link>
                        <ZoruButton variant="outline" disabled>
                            Record Depreciation
                        </ZoruButton>
                    </div>
                }
            />

            {/* Card 1: Asset Details */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-[15px] font-medium text-zoru-ink">Asset Details</h2>
                    <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Asset Code</div>
                        <div className="text-zoru-ink">{assetCode || '—'}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Asset Name</div>
                        <div className="text-zoru-ink">{name}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Category</div>
                        <div className="text-zoru-ink">{category}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Purchase Date</div>
                        <div className="text-zoru-ink">{fmtDate(purchaseDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Supplier</div>
                        <div className="text-zoru-ink">{supplierName}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Purchase Cost</div>
                        <div className="text-zoru-ink">{fmtINR(cost)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Location</div>
                        <div className="text-zoru-ink">{location}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Custodian</div>
                        <div className="text-zoru-ink">{custodianName}</div>
                    </div>
                </div>
            </ZoruCard>

            {/* Card 2: Depreciation & Lifecycle */}
            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[15px] font-medium text-zoru-ink">
                    Depreciation &amp; Lifecycle
                </h2>

                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Depreciation Method</div>
                        <div className="text-zoru-ink">{methodLabel(depreciationMethod)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Useful Life</div>
                        <div className="text-zoru-ink">
                            {typeof usefulLifeMonths === 'number'
                                ? `${usefulLifeMonths} months`
                                : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Residual Value</div>
                        <div className="text-zoru-ink">{fmtINR(residualValue)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Accumulated Depreciation</div>
                        <div className="text-zoru-ink">{fmtINR(accumulatedDepreciation)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Net Book Value</div>
                        <div className="text-zoru-ink">{fmtINR(nbv)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Warranty Expiry</div>
                        <div className="text-zoru-ink">{fmtDate(warrantyExpiry)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Insurance Expiry</div>
                        <div className="text-zoru-ink">{fmtDate(insuranceExpiry)}</div>
                    </div>

                    {notes && (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Notes</div>
                            <div className="mt-0.5 whitespace-pre-wrap text-zoru-ink">{notes}</div>
                        </div>
                    )}
                </div>
            </ZoruCard>
        </div>
    );
}
