import {
    AlertCircle,
    Banknote,
    Building2,
    Calendar,
    Contact,
    DollarSign,
    FileEdit,
    FileMinus,
    FileQuestion,
    FileSignature,
    FileSpreadsheet,
    FileText,
    Gift,
    GitBranch,
    Handshake,
    Heart,
    Megaphone,
    Quote,
    Receipt,
    Repeat,
    ScrollText,
    ShoppingCart,
    Ticket,
    Truck,
    Wallet,
    ClipboardList,
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
    formatCurrency,
    formatDate,
    recentByUser,
    startOfMonth,
    sumByUser,
} from '../_components/hub-data';

export const dynamic = 'force-dynamic';

interface InvoiceDoc {
    _id: string;
    invoiceNumber?: string;
    clientName?: string;
    totalAmount?: number;
    balanceDue?: number;
    status?: string;
    invoiceDate?: string;
    dueDate?: string;
    createdAt?: string;
}

const QUICK_LINKS: HubQuickLink[] = [
    { href: '/dashboard/crm/sales/clients', title: 'Clients', description: 'Customer accounts and their billing relationships.', icon: Building2 },
    { href: '/dashboard/crm/sales/contacts', title: 'Contacts', description: 'People connected to your client accounts.', icon: Contact },
    { href: '/dashboard/crm/sales/quotations', title: 'Quotations', description: 'Price quotes you have sent to prospects.', icon: Quote },
    { href: '/dashboard/crm/sales/proposals', title: 'Proposals', description: 'Detailed proposals with deliverables and pricing.', icon: FileText },
    { href: '/dashboard/crm/sales/estimate-requests', title: 'Estimate Requests', description: 'Inbound requests for estimates from prospects.', icon: FileQuestion },
    { href: '/dashboard/crm/sales/estimates-templates', title: 'Estimate Templates', description: 'Reusable templates for estimates and proposals.', icon: FileSpreadsheet },
    { href: '/dashboard/crm/sales/orders', title: 'Sales Orders', description: 'Confirmed orders awaiting delivery.', icon: ShoppingCart },
    { href: '/dashboard/crm/sales/invoices', title: 'Invoices', description: 'Outgoing invoices and their payment status.', icon: Receipt },
    { href: '/dashboard/crm/sales/proforma', title: 'Proforma Invoices', description: 'Preliminary invoices issued before delivery.', icon: FileEdit },
    { href: '/dashboard/crm/sales/recurring-invoices', title: 'Recurring Invoices', description: 'Subscription-style invoices billed on a schedule.', icon: Repeat },
    { href: '/dashboard/crm/sales/subscriptions', title: 'Subscriptions', description: 'Recurring customer subscriptions.', icon: Calendar },
    { href: '/dashboard/crm/sales/payments', title: 'Payments', description: 'Money received against invoices.', icon: Banknote },
    { href: '/dashboard/crm/sales/receipts', title: 'Receipts', description: 'Acknowledgements of received payments.', icon: ScrollText },
    { href: '/dashboard/crm/sales/credit-notes', title: 'Credit Notes', description: 'Refunds and corrections issued to clients.', icon: FileMinus },
    { href: '/dashboard/crm/sales/delivery', title: 'Delivery', description: 'Outbound shipments and delivery challans.', icon: Truck },
    { href: '/dashboard/crm/sales/contracts', title: 'Contracts', description: 'Service or supply contracts you have signed.', icon: FileSignature },
    { href: '/dashboard/crm/sales/pipelines', title: 'Pipelines', description: 'Sales pipelines and their stages.', icon: GitBranch },
    { href: '/dashboard/crm/sales/forms', title: 'Forms', description: 'Public lead-capture forms.', icon: ClipboardList },
    { href: '/dashboard/crm/sales/coupons', title: 'Coupons', description: 'Discount codes available to customers.', icon: Ticket },
    { href: '/dashboard/crm/sales/promotions', title: 'Promotions', description: 'Active marketing promotions and offers.', icon: Megaphone },
    { href: '/dashboard/crm/sales/gift-cards', title: 'Gift Cards', description: 'Stored-value gift cards.', icon: Gift },
    { href: '/dashboard/crm/sales/loyalty', title: 'Loyalty', description: 'Loyalty program members and points.', icon: Heart },
];

export default async function CrmSalesHubPage() {
    const monthStart = startOfMonth();
    const now = new Date();

    const [revenueMtd, openInvoiceBalance, overdueBalance, recentInvoices] = await Promise.all([
        sumByUser('crm_invoices', 'totalAmount', { invoiceDate: { $gte: monthStart } }),
        sumByUser('crm_invoices', 'balanceDue', { status: { $in: ['sent', 'partial'] } }),
        sumByUser('crm_invoices', 'balanceDue', {
            status: { $in: ['sent', 'partial', 'overdue'] },
            dueDate: { $lt: now },
        }),
        recentByUser<InvoiceDoc>('crm_invoices', { sortField: 'invoiceDate', limit: 5 }),
    ]);

    const kpis: HubKpi[] = [
        {
            label: 'Revenue (MTD)',
            value: formatCurrency(revenueMtd),
            icon: DollarSign,
            tone: 'success',
            href: '/dashboard/crm/sales/invoices',
        },
        {
            label: 'Open Invoices',
            value: formatCurrency(openInvoiceBalance),
            icon: Wallet,
            tone: openInvoiceBalance > 0 ? 'warning' : 'default',
            href: '/dashboard/crm/sales/invoices?status=open',
        },
        {
            label: 'Overdue',
            value: formatCurrency(overdueBalance),
            icon: AlertCircle,
            tone: overdueBalance > 0 ? 'danger' : 'success',
            href: '/dashboard/crm/sales/invoices?status=overdue',
        },
        {
            label: 'AR Total',
            value: formatCurrency(openInvoiceBalance + overdueBalance),
            icon: Receipt,
            hint: 'Open + overdue',
            href: '/dashboard/crm/sales/invoices',
        },
    ];

    const recentRows: HubRecentRow[] = recentInvoices.map((inv) => ({
        id: String(inv._id),
        primary: inv.invoiceNumber || 'Invoice',
        secondary: inv.clientName || inv.status || '',
        trailing: `${formatCurrency(inv.totalAmount ?? 0)} · ${formatDate(inv.invoiceDate || inv.createdAt)}`,
        href: `/dashboard/crm/sales/invoices/${inv._id}`,
    }));

    return (
        <EntityListShell
            title="Sales"
            subtitle="Everything from lead-to-cash — quotations, orders, invoices, payments, contracts."
        >
            <div className="flex flex-col gap-6">
                <HubKpiGrid kpis={kpis} />
                <HubQuickLinkGrid links={QUICK_LINKS} />
                <HubRecentList
                    title="Recent invoices"
                    rows={recentRows}
                    emptyHint="No invoices yet."
                    viewAllHref="/dashboard/crm/sales/invoices"
                />
            </div>
        </EntityListShell>
    );
}
