import {
    Banknote,
    Briefcase,
    ClipboardList,
    Coins,
    DollarSign,
    FileMinus,
    HandCoins,
    Receipt,
    Repeat,
    ShoppingBag,
    Store,
    TrendingDown,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    HubKpiGrid,
    HubQuickLinkGrid,
    HubRecentList,
    type HubKpi,
    type HubQuickLink,
    type HubRecentRow,
} from '../_components/hub-kpi-grid';
import {
    countByUser,
    formatCurrency,
    formatDate,
    recentByUser,
    startOfMonth,
    sumByUser,
} from '../_components/hub-data';

export const dynamic = 'force-dynamic';

interface PurchaseOrderDoc {
    _id: string;
    orderNumber?: string;
    vendorName?: string;
    totalAmount?: number;
    status?: string;
    orderDate?: string;
    createdAt?: string;
}

const QUICK_LINKS: HubQuickLink[] = [
    { href: '/dashboard/crm/purchases/vendors', title: 'Vendors', description: 'Suppliers you buy goods and services from.', icon: Store },
    { href: '/dashboard/crm/purchases/leads', title: 'Vendor Leads', description: 'Prospective vendors you are evaluating.', icon: TrendingDown },
    { href: '/dashboard/crm/purchases/rfqs', title: 'RFQs', description: 'Requests-for-quote sent to vendors.', icon: ClipboardList },
    { href: '/dashboard/crm/purchases/vendor-bids', title: 'Vendor Bids', description: 'Bids received from vendors in response to RFQs.', icon: HandCoins },
    { href: '/dashboard/crm/purchases/orders', title: 'Purchase Orders', description: 'Confirmed orders placed with vendors.', icon: ShoppingBag },
    { href: '/dashboard/crm/purchases/expenses', title: 'Expenses', description: 'Day-to-day operational spending.', icon: Coins },
    { href: '/dashboard/crm/purchases/recurring-expenses', title: 'Recurring Expenses', description: 'Subscriptions, rent, and other repeating bills.', icon: Repeat },
    { href: '/dashboard/crm/purchases/payouts', title: 'Payouts', description: 'Money paid out to vendors and contractors.', icon: Banknote },
    { href: '/dashboard/crm/purchases/debit-notes', title: 'Debit Notes', description: 'Adjustments and returns to vendors.', icon: FileMinus },
    { href: '/dashboard/crm/purchases/hire', title: 'Hire', description: 'Contractor and short-term hire arrangements.', icon: Briefcase },
];

export default async function CrmPurchasesHubPage() {
    const monthStart = startOfMonth();

    const [openPOs, monthSpend, pendingBills, vendorCount, recentPOs] = await Promise.all([
        countByUser('crm_purchase_orders', { status: { $in: ['draft', 'sent', 'confirmed', 'partial'] } }),
        sumByUser('crm_purchase_orders', 'totalAmount', { orderDate: { $gte: monthStart } }),
        countByUser('crm_expenses', { status: { $in: ['pending', 'unpaid'] } }),
        countByUser('crm_vendors'),
        recentByUser<PurchaseOrderDoc>('crm_purchase_orders', {
            sortField: 'orderDate',
            limit: 5,
        }),
    ]);

    const kpis: HubKpi[] = [
        {
            label: 'Open POs',
            value: openPOs,
            icon: ShoppingBag,
            tone: openPOs > 0 ? 'warning' : 'default',
            href: '/dashboard/crm/purchases/orders?status=open',
        },
        {
            label: 'Spend (MTD)',
            value: formatCurrency(monthSpend),
            icon: DollarSign,
            href: '/dashboard/crm/purchases/orders',
        },
        {
            label: 'Pending Bills',
            value: pendingBills,
            icon: Receipt,
            tone: pendingBills > 0 ? 'warning' : 'default',
            href: '/dashboard/crm/purchases/expenses?status=unpaid',
        },
        {
            label: 'Vendors',
            value: vendorCount.toLocaleString(),
            icon: Store,
            href: '/dashboard/crm/purchases/vendors',
        },
    ];

    const recentRows: HubRecentRow[] = recentPOs.map((po) => ({
        id: String(po._id),
        primary: po.orderNumber || 'Purchase order',
        secondary: po.vendorName || po.status || '',
        trailing: formatCurrency(po.totalAmount ?? 0),
        href: `/dashboard/crm/purchases/orders/${po._id}`,
    }));

    return (
        <EntityListShell
            title="Purchases"
            subtitle="Vendors, purchase orders, expenses, and supplier payments."
        >
            <div className="flex flex-col gap-6">
                <HubKpiGrid kpis={kpis} />
                <HubQuickLinkGrid links={QUICK_LINKS} />
                <HubRecentList
                    title="Recent purchase orders"
                    rows={recentRows}
                    emptyHint="No purchase orders yet."
                    viewAllHref="/dashboard/crm/purchases/orders"
                />
            </div>
        </EntityListShell>
    );
}
