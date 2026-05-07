/**
 * Fixed asset detail page.
 *
 * Server component sibling of the fixed-assets list page. Renders the
 * asset code + name header with a status badge, a 2-col metadata grid
 * (category, cost, purchased, method, useful life, custodian, location),
 * and a depreciation summary card with accumulated depreciation + NBV.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, Building2 } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { getFixedAssetById } from '@/app/actions/crm-fixed-assets.actions';
import { getSession } from '@/app/actions/user.actions';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: unknown): string {
    if (typeof n !== 'number' || Number.isNaN(n)) return '—';
    return n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function statusVariant(status?: string): 'ghost' | 'success' | 'warning' | 'danger' {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'in_use' || s === 'approved') return 'success';
    if (s === 'draft' || s === 'pending') return 'ghost';
    if (s === 'disposed' || s === 'retired' || s === 'cancelled' || s === 'lost')
        return 'danger';
    return 'warning';
}

function idToString(v: unknown): string {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof (v as any).toString === 'function') return (v as any).toString();
    return '';
}

export default async function FixedAssetDetailPage({
    params,
}: {
    params: Promise<{ assetId: string }>;
}) {
    const { assetId } = await params;

    const session = await getSession();
    if (!session?.user) notFound();
    if (!ObjectId.isValid(assetId)) notFound();

    const asset = await getFixedAssetById(assetId);
    if (!asset) {
        notFound();
    }

    const assetCode = ((asset as any).assetCode as string) || '';
    const name = ((asset as any).name as string) || 'Untitled asset';
    const category = ((asset as any).category as string) || '—';
    const cost = (asset as any).cost as number | undefined;
    const residualValue = (asset as any).residualValue as number | undefined;
    const depreciationMethod = ((asset as any).depreciationMethod as string) || '—';
    const usefulLifeMonths = (asset as any).usefulLifeMonths as number | undefined;
    const purchaseDate = (asset as any).purchaseDate;
    const status = ((asset as any).status as string) || 'draft';
    const custodian =
        ((asset as any).custodianName as string) ||
        idToString((asset as any).custodianId) ||
        '—';
    const location = ((asset as any).location as string) || '—';
    const warranty = (asset as any).warranty;
    const insurance = (asset as any).insurance;
    const accumulatedDepreciation = (asset as any).accumulatedDepreciation as
        | number
        | undefined;
    const nbv = (asset as any).nbv as number | undefined;

    const headerTitle = assetCode ? `${assetCode} · ${name}` : name;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={headerTitle}
                subtitle="Fixed asset detail"
                icon={Building2}
                actions={
                    <Link href="/dashboard/crm/fixed-assets">
                        <ZoruButton variant="outline">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">{headerTitle}</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                            Purchased {fmtDate(purchaseDate)}
                            {category !== '—' ? ` • ${category}` : ''}
                        </p>
                    </div>
                    <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Category</div>
                        <div className="text-zoru-ink">{category}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Cost</div>
                        <div className="text-zoru-ink">{fmtMoney(cost)}</div>
                        {typeof residualValue === 'number' && (
                            <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                Residual {fmtMoney(residualValue)}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Purchased</div>
                        <div className="text-zoru-ink">{fmtDate(purchaseDate)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Method</div>
                        <div className="text-zoru-ink">{depreciationMethod}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Useful life</div>
                        <div className="text-zoru-ink">
                            {typeof usefulLifeMonths === 'number'
                                ? `${usefulLifeMonths} months`
                                : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Custodian</div>
                        <div className="text-zoru-ink">{custodian}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Location</div>
                        <div className="text-zoru-ink">{location}</div>
                    </div>
                </div>

                {(warranty || insurance) && (
                    <div className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                        {warranty && (
                            <div className="rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                                    Warranty
                                </div>
                                <div className="mt-1 text-zoru-ink">
                                    {(warranty as any).provider || '—'}
                                </div>
                                <div className="text-[11.5px] text-zoru-ink-muted">
                                    Until {fmtDate((warranty as any).expiresAt)}
                                </div>
                            </div>
                        )}
                        {insurance && (
                            <div className="rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                                    Insurance
                                </div>
                                <div className="mt-1 text-zoru-ink">
                                    {(insurance as any).provider || '—'}
                                </div>
                                <div className="text-[11.5px] text-zoru-ink-muted">
                                    Until {fmtDate((insurance as any).expiresAt)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ZoruCard>

            <ZoruCard className="p-6">
                <div className="text-[14px] text-zoru-ink">Depreciation</div>
                <div className="mt-3 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Accumulated depreciation</div>
                        <div className="text-[18px] text-zoru-ink">
                            {fmtMoney(accumulatedDepreciation)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Net book value (NBV)</div>
                        <div className="text-[18px] text-zoru-ink">{fmtMoney(nbv)}</div>
                    </div>
                </div>
            </ZoruCard>
        </div>
    );
}
