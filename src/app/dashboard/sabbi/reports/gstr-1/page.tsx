export const dynamic = 'force-dynamic';


import { getAccountNamesByIds } from '@/app/actions/crm-accounts.actions';
import { getSession } from '@/app/actions/user.actions';
import { getInvoices } from '@/app/actions/crm-invoices.actions';
import { generateGstr1Report } from '@/app/actions/crm-india-gst.actions';
import { MonthPicker } from '@/components/crm/month-picker';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    StatCard,
    fmtMoney,
    fmtNumber,
} from '../_components/report-toolbar';
import {
    Gstr1Client,
    type Gstr1ChartDatum,
    type Gstr1InvoiceRow,
} from './_components/gstr1-client';

interface SearchParams {
    month?: string;
    year?: string;
    page?: string;
    limit?: string;
}

/**
 * GSTR-1 — outward supplies summary + monthly filing helper.
 *
 * The page produces three things server-side:
 *   1. KPI strip — derived from `generateGstr1Report` (the engine
 *      already computes totals).
 *   2. A breakdown chart — outward supplies by section (B2B / B2CL /
 *      B2CS / credit-notes), grouped by taxable value + tax.
 *   3. The invoice table with `EntityRowLink`s back to detail pages.
 *
 * Client-side helpers (`Gstr1Client`) own the CSV/XLSX/JSON exports.
 */
export default async function Gstr1Page(props: {
    searchParams: Promise<SearchParams>;
}) {
    const sp = await props.searchParams;
    const now = new Date();
    const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1;
    const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
    const page = Math.max(1, Number(sp.page ?? 1));
    const limit = Math.min(Math.max(1, Number(sp.limit ?? 20)), 100);

    const [{ invoices, total }, gstr1Res] = await Promise.all([
        getInvoices(page, limit, { month, year }),
        generateGstr1Report({ month, year }),
    ]);

    // Resolve account → client name (tenant-scoped) so the table can
    // show real customer labels.
    const accountIds = Array.from(
        new Set(
            invoices
                .map((inv) => inv.accountId?.toString())
                .filter((s): s is string => typeof s === 'string' && s.length > 0),
        ),
    );

    const nameByAccountMap = await getAccountNamesByIds(accountIds);
    const nameByAccount = new Map<string, string>(Object.entries(nameByAccountMap));

    const rows: Gstr1InvoiceRow[] = invoices.map((inv) => ({
        id: String(inv._id),
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: new Date(inv.invoiceDate).toISOString(),
        accountId: String(inv.accountId ?? ''),
        clientName: nameByAccount.get(String(inv.accountId ?? '')) ?? 'Client',
        subtotal: Number(inv.subtotal ?? inv.total ?? 0),
        total: Number(inv.total ?? 0),
        currency: inv.currency || 'INR',
        status: inv.status,
    }));

    // Derive KPIs + chart data from the engine output.
    const raw = gstr1Res.raw;
    const summary = (gstr1Res.result?.summary ?? {}) as Record<string, number>;
    const sumTaxable = (items: { taxableValue: number }[]): number =>
        items.reduce((s, it) => s + (Number(it.taxableValue) || 0), 0);
    const sumTax = (
        items: { igst: number; cgst: number; sgst: number; cess: number }[],
    ): number =>
        items.reduce(
            (s, it) =>
                s +
                (Number(it.igst) || 0) +
                (Number(it.cgst) || 0) +
                (Number(it.sgst) || 0) +
                (Number(it.cess) || 0),
            0,
        );

    const b2bTaxable = raw
        ? raw.b2b.reduce((s, inv) => s + sumTaxable(inv.items), 0)
        : 0;
    const b2bTax = raw
        ? raw.b2b.reduce((s, inv) => s + sumTax(inv.items), 0)
        : 0;
    const b2clTaxable = raw
        ? raw.b2cl.reduce((s, inv) => s + sumTaxable(inv.items), 0)
        : 0;
    const b2clTax = raw
        ? raw.b2cl.reduce((s, inv) => s + sumTax(inv.items), 0)
        : 0;
    const b2csTaxable = raw ? sumTaxable(raw.b2cs) : 0;
    const b2csTax = raw ? sumTax(raw.b2cs) : 0;
    const cdnrTaxable = raw
        ? raw.cdnr.reduce((s, n) => s + sumTaxable(n.items), 0)
        : 0;
    const cdnrTax = raw
        ? raw.cdnr.reduce((s, n) => s + sumTax(n.items), 0)
        : 0;

    const totalTaxable =
        Number(summary.outward_taxable ?? 0) ||
        b2bTaxable + b2clTaxable + b2csTaxable;
    const totalTax =
        Number(summary.outward_total_tax ?? 0) ||
        b2bTax + b2clTax + b2csTax + cdnrTax;

    const b2bCount = raw?.b2b.length ?? 0;
    const b2cCount = (raw?.b2cl.length ?? 0) + (raw?.b2cs.length ?? 0);

    const chart: Gstr1ChartDatum[] = [
        { name: 'B2B', taxable: Math.round(b2bTaxable), tax: Math.round(b2bTax) },
        {
            name: 'B2C-large',
            taxable: Math.round(b2clTaxable),
            tax: Math.round(b2clTax),
        },
        {
            name: 'B2C',
            taxable: Math.round(b2csTaxable),
            tax: Math.round(b2csTax),
        },
        {
            name: 'Credit/Debit',
            taxable: Math.round(cdnrTaxable),
            tax: Math.round(cdnrTax),
        },
    ];

    return (
        <EntityListShell
            title="GSTR-1 Report"
            subtitle="Outward supplies of goods or services for the selected return period."
            primaryAction={<MonthPicker />}
        >
            {gstr1Res.error ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-300">
                    {gstr1Res.error}
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total outward supplies"
                    value={fmtMoney(totalTaxable, 'INR')}
                />
                <StatCard
                    label="Total tax"
                    value={fmtMoney(totalTax, 'INR')}
                    tone="amber"
                />
                <StatCard
                    label="B2B invoices"
                    value={fmtNumber(b2bCount)}
                    tone="blue"
                />
                <StatCard
                    label="B2C rows"
                    value={fmtNumber(b2cCount)}
                    tone="green"
                />
            </div>

            <Gstr1Client
                month={month}
                year={year}
                rows={rows}
                total={total}
                page={page}
                limit={limit}
                chart={chart}
            />
        </EntityListShell>
    );
}
