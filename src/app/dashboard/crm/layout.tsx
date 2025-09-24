
'use client';

import { usePathname } from 'next/navigation';
import {
    IndianRupee,
    MessageSquare,
    Users,
    Send,
    GitFork,
    Settings,
    Briefcase,
    LayoutDashboard,
    FileText,
    ShoppingCart,
    Handshake,
    Building,
    Mail,
    Zap,
    FolderKanban,
    Truck,
    Repeat,
    BarChart,
    CreditCard,
    BadgeInfo,
    FilePlus,
    Star,
    Contact,
} from 'lucide-react';

export const crmMenuItems = [
    { href: '/dashboard/crm', label: 'CRM Dashboard', icon: LayoutDashboard },
    {
        label: 'Sales',
        icon: Briefcase,
        href: '#',
        subItems: [
            { href: '/dashboard/crm/sales/clients', label: 'Clients & Prospects', icon: Users },
            { href: '/dashboard/crm/sales/quotations', label: 'Quotation & Estimates', icon: FileText },
            { href: '/dashboard/crm/sales/proforma', label: 'Proforma Invoices', icon: BadgeInfo },
            { href: '/dashboard/crm/sales/invoices', label: 'Invoices', icon: FileText },
            { href: '/dashboard/crm/sales/receipts', label: 'Payment Receipts', icon: CreditCard },
            { href: '/dashboard/crm/sales/orders', label: 'Sales Orders', icon: ShoppingCart },
            { href: '/dashboard/crm/sales/delivery', label: 'Delivery Challans', icon: Truck },
            { href: '/dashboard/crm/sales/credit-notes', label: 'Credit Notes', icon: Repeat },
        ]
    },
    {
        label: 'Purchases',
        icon: ShoppingCart,
        href: '#',
        subItems: [
            { href: '/dashboard/crm/purchases/leads', label: 'Vendor Leads', icon: Contact },
            { href: '/dashboard/crm/purchases/vendors', label: 'Vendors & Suppliers', icon: Users },
            { href: '/dashboard/crm/purchases/expenses', label: 'Purchases & Expenses', icon: IndianRupee },
            { href: '/dashboard/crm/purchases/orders', label: 'Purchase Orders', icon: FilePlus },
            { href: '/dashboard/crm/purchases/payouts', label: 'Payout Receipts', icon: CreditCard },
            { href: '/dashboard/crm/purchases/debit-notes', label: 'Debit Notes', icon: Repeat },
            { href: '/dashboard/crm/purchases/hire', label: 'Hire The Best Vendors', icon: Star },
        ]
    },
    { href: '/dashboard/crm/contacts', label: 'Leads & Contacts', icon: Users },
    { href: '/dashboard/crm/accounts', label: 'Accounts', icon: Building },
    { href: '/dashboard/crm/deals', label: 'Deals', icon: Handshake },
    { href: '/dashboard/crm/products', label: 'Products', icon: ShoppingCart },
    { href: '/dashboard/crm/inventory', label: 'Inventory', icon: Truck },
    { href: '/dashboard/crm/tasks', label: 'Tasks', icon: FolderKanban },
    { href: '/dashboard/crm/email', label: 'Email', icon: Mail },
    { href: '/dashboard/crm/team-chat', label: 'Team Chat', icon: MessageSquare },
    { href: '/dashboard/crm/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/crm/automations', label: 'Automations', icon: Zap },
    { href: '/dashboard/crm/settings', label: 'Settings', icon: Settings },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const isAutomationPage = pathname.startsWith('/dashboard/crm/automations');

    if (isAutomationPage) {
        return <div className="h-full w-full">{children}</div>;
    }

    return (
        <div className="flex flex-col gap-8 h-full">
            {children}
        </div>
    );
}
