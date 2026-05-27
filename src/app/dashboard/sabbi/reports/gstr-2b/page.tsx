export const dynamic = 'force-dynamic';


import { getVendorNamesByIds } from '@/app/actions/crm-vendors.actions';
import { getGstr2bTrend } from '@/app/actions/crm-india-gst.actions';
import { getSession } from '@/app/actions/user.actions';
import { getPurchaseOrders } from '@/app/actions/crm-purchase-orders.actions';
import { getGstr2bImport } from '@/app/actions/crm-india-gst.actions';
import { MonthPicker } from '@/components/crm/month-picker';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    StatCard,
    fmtMoney,
    fmtNumber,
} from '../_components/report-toolbar';
import {
    Gstr2bClient,
    type Gstr2bPurchaseRow,
    type Gstr2bTrendDatum,
    type Gstr2bVendorDatum,
} from './_components/gstr2b-client';

interface SearchParams {
    month?: string;
    year?: string;
    page?: string;
    limit?: string;
}

/**
 * Sum the ITC heads of a 2B totals block.
 */
function sumItc(totals?: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
}): number {
    if (!totals) return 0;
    return (
        (totals.igst || 0) +
        (totals.cgst || 0) +
        (totals.sgst || 0) +
        (totals.cess || 0)
    );
}

/**
 * GSTR-2B — auto-drafted ITC statement viewer.
 *
 * Server page composes:
 *   1. KPIs derived from `getGstr2bImport` (or zeroed when no import).
 *   2. Vendor-bar chart (taxable + ITC heads grouped by supplier).
 *   3. Last-6-months ITC trend, sourced from `crm_gstr2b_imports`.
 *   4. The purchase-order table with `EntityRowLink`s.
 */
export default async function Gstr2bPage(props: {
    searchParams: Promise<SearchParams>;
}) {
    const sp = await props.searchParams;
    const now = new Date();
    const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1;
    const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
    const page = Math.max(1, Number(sp.page ?? 1));
    const limit = Math.min(Math.max(1, Number(sp.limit ?? 20)), 100);

    const [{ orders, total }, importRes] = await Promise.all([
        getPurchaseOrders(page, limit, { month, year }),
        getGstr2bImport({ month, year }),
    ]);

    // Build vendor name index (tenant-scoped).
    const vendorIds = Array.from(
        new Set(
            orders
                .map((po) => po.vendorId?.toString())
                .filter((s): s is string => typeof s === 'string' && s.length > 0),
        ),
    );
    const vendorNameMap = await getVendorNamesByIds(vendorIds);
    const vendorNameById = new Map<string, string>(Object.entries(vendorNameMap));

    const rows: Gstr2bPurchaseRow[] = orders.map((po) => ({
        id: String(po._id),
        orderNumber: po.orderNumber,
        orderDate: new Date(po.orderDate).toISOString(),
        vendorName:
            vendorNameById.get(String(po.vendorId ?? '')) ?? 'Vendor',
        total: Number(po.total ?? 0),
        currency: po.currency || 'INR',
        status: po.status ?? 'Draft',
        itcEligible: 'Eligible',
    }));

    const parsed = importRes.parsed;

    // Vendor chart — top 8 suppliers by taxable value.
    const vendorChart: Gstr2bVendorDatum[] = parsed
        ? [...parsed.suppliers]
              .sort((a, b) => b.taxableValue - a.taxableValue)
              .slice(0, 8)
              .map((s) => ({
                  name: s.tradeName ?? s.gstin,
                  taxable: Math.round(s.taxableValue),
                  itc: Math.round(s.igst + s.cgst + s.sgst + s.cess),
              }))
        : [];

    // Build a 6-month trend by reading `crm_gstr2b_imports` directly so
    // the line chart works even when only some months have been imported.
    let trend: Gstr2bTrendDatum[] = await getGstr2bTrend(6);

    const totalInward = parsed
        ? parsed.suppliers.reduce((s, sup) => s + sup.taxableValue, 0)
        : 0;
    const itcAvailable = parsed ? sumItc(parsed.totalItcAvailable) : 0;
    const itcReversed = parsed ? sumItc(parsed.totalItcIneligible) : 0;
    const vendorsCovered = parsed ? parsed.suppliers.length : 0;

    // The JSON for the current period — only available when an import
    // exists. We strip Mongo-specific fields by re-stringifying the
    // already-normalised return.
    const gstr2bJson = parsed ? JSON.stringify(parsed, null, 2) : undefined;
    const gstr2bJsonFilename = parsed
        ? `GSTR2B-${year}-${String(month).padStart(2, '0')}.json`
        : undefined;

    return (
        <EntityListShell
            title="GSTR-2B Report"
            subtitle="Auto-drafted ITC statement — vendor breakdown, monthly trend, and source purchase documents."
            primaryAction={<MonthPicker />}
        >
            {importRes.error ? (
                <div className="rounded-lg border border-zoru-line/30 bg-zoru-ink/5 px-3 py-2 text-[13px] text-zoru-ink dark:text-zoru-ink-muted">
                    {importRes.error}
                </div>
            ) : null}
            {!parsed && !importRes.error ? (
                <div className="rounded-lg border border-zoru-line bg-zoru-surface px-3 py-2 text-[13px] text-zoru-ink-muted">
                    No GSTR-2B JSON imported for {String(month).padStart(2, '0')}-
                    {year}. KPIs below are derived from your own purchase
                    documents until you import the portal payload.
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total inward supplies"
                    value={fmtMoney(totalInward, 'INR')}
                />
                <StatCard
                    label="ITC available"
                    value={fmtMoney(itcAvailable, 'INR')}
                    tone="green"
                />
                <StatCard
                    label="ITC reversed"
                    value={fmtMoney(itcReversed, 'INR')}
                    tone="red"
                />
                <StatCard
                    label="Vendors covered"
                    value={fmtNumber(vendorsCovered)}
                    tone="blue"
                />
            </div>

            <Gstr2bClient
                month={month}
                year={year}
                vendorChart={vendorChart}
                trend={trend}
                rows={rows}
                total={total}
                page={page}
                limit={limit}
                gstr2bJson={gstr2bJson}
                gstr2bJsonFilename={gstr2bJsonFilename}
            />
        </EntityListShell>
    );
}
