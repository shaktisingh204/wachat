
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Handshake, Building, Users, ShoppingCart, Truck, FolderKanban, Mail, BarChart, Zap, Settings, LayoutDashboard,
    FileText, CreditCard, BadgeInfo, Repeat, Star, Briefcase, MessageSquare
} from 'lucide-react';

const LazyClientsPage = React.lazy(() => import('@/app/dashboard/crm/sales/clients/page'));
const LazyQuotationsPage = React.lazy(() => import('@/app/dashboard/crm/sales/quotations/page'));
const LazyInvoicesPage = React.lazy(() => import('@/app/dashboard/crm/sales/invoices/page'));
const LazyReceiptsPage = React.lazy(() => import('@/app/dashboard/crm/sales/receipts/page'));
const LazyProformaPage = React.lazy(() => import('@/app/dashboard/crm/sales/proforma/page'));
const LazySalesOrdersPage = React.lazy(() => import('@/app/dashboard/crm/sales/orders/page'));
const LazyDeliveryPage = React.lazy(() => import('@/app/dashboard/crm/sales/delivery/page'));
const LazyCreditNotesPage = React.lazy(() => import('@/app/dashboard/crm/sales/credit-notes/page'));
const LazyPipelinesPage = React.lazy(() => import('@/app/dashboard/crm/sales/pipelines/page'));
const LazyFormsPage = React.lazy(() => import('@/app/dashboard/crm/sales/forms/page'));
const LazyVendorsPage = React.lazy(() => import('@/app/dashboard/crm/purchases/vendors/page'));
const LazyExpensesPage = React.lazy(() => import('@/app/dashboard/crm/purchases/expenses/page'));
const LazyPurchaseOrdersPage = React.lazy(() => import('@/app/dashboard/crm/purchases/orders/page'));
const LazyPayoutsPage = React.lazy(() => import('@/app/dashboard/crm/purchases/payouts/page'));
const LazyDebitNotesPage = React.lazy(() => import('@/app/dashboard/crm/purchases/debit-notes/page'));
const LazyHirePage = React.lazy(() => import('@/app/dashboard/crm/purchases/hire/page'));
const LazyCrmDashboardPage = React.lazy(() => import('@/app/dashboard/crm/page'));
const LazyCrmContactsPage = React.lazy(() => import('@/app/dashboard/crm/contacts/page'));
const LazyCrmAccountsPage = React.lazy(() => import('@/app/dashboard/crm/accounts/page'));
const LazyCrmDealsPage = React.lazy(() => import('@/app/dashboard/crm/deals/page'));
const LazyCrmProductsPage = React.lazy(() => import('@/app/dashboard/crm/products/page'));
const LazyCrmInventoryLayout = React.lazy(() => import('@/app/dashboard/crm/inventory/layout'));
const LazyCrmTasksPage = React.lazy(() => import('@/app/dashboard/crm/tasks/page'));
const LazyCrmEmailPage = React.lazy(() => import('@/app/dashboard/crm/email/page'));
const LazyCrmTeamChatPage = React.lazy(() => import('@/app/dashboard/crm/team-chat/page'));
const LazyCrmAnalyticsPage = React.lazy(() => import('@/app/dashboard/crm/analytics/page'));
const LazyCrmSettingsPage = React.lazy(() => import('@/app/dashboard/crm/settings/page'));
const LazyCrmAutomationsPage = React.lazy(() => import('@/app/dashboard/crm/automations/page'));

export const pathComponentMap: Record<string, React.ComponentType<any>> = {
  '/dashboard/crm': LazyCrmDashboardPage,
  '/dashboard/crm/sales/clients': LazyClientsPage,
  '/dashboard/crm/sales/quotations': LazyQuotationsPage,
  '/dashboard/crm/sales/invoices': LazyInvoicesPage,
  '/dashboard/crm/sales/receipts': LazyReceiptsPage,
  '/dashboard/crm/sales/proforma': LazyProformaPage,
  '/dashboard/crm/sales/orders': LazySalesOrdersPage,
  '/dashboard/crm/sales/delivery': LazyDeliveryPage,
  '/dashboard/crm/sales/credit-notes': LazyCreditNotesPage,
  '/dashboard/crm/sales/pipelines': LazyPipelinesPage,
  '/dashboard/crm/sales/forms': LazyFormsPage,
  '/dashboard/crm/purchases/vendors': LazyVendorsPage,
  '/dashboard/crm/purchases/expenses': LazyExpensesPage,
  '/dashboard/crm/purchases/orders': LazyPurchaseOrdersPage,
  '/dashboard/crm/purchases/payouts': LazyPayoutsPage,
  '/dashboard/crm/purchases/debit-notes': LazyDebitNotesPage,
  '/dashboard/crm/purchases/hire': LazyHirePage,
  '/dashboard/crm/contacts': LazyCrmContactsPage,
  '/dashboard/crm/accounts': LazyCrmAccountsPage,
  '/dashboard/crm/deals': LazyCrmDealsPage,
  '/dashboard/crm/products': LazyCrmProductsPage,
  '/dashboard/crm/inventory': LazyCrmInventoryLayout,
  '/dashboard/crm/tasks': LazyCrmTasksPage,
  '/dashboard/crm/email': LazyCrmEmailPage,
  '/dashboard/crm/team-chat': LazyCrmTeamChatPage,
  '/dashboard/crm/analytics': LazyCrmAnalyticsPage,
  '/dashboard/crm/settings': LazyCrmSettingsPage,
  '/dashboard/crm/automations': LazyCrmAutomationsPage,
};


export const crmMenuItems = [
    { href: '/dashboard/crm', label: 'Dashboard', icon: LayoutDashboard },
    {
        label: 'Sales',
        icon: Handshake,
        subItems: [
            { href: '/dashboard/crm/sales/clients', label: 'Clients', icon: Users },
            { href: '/dashboard/crm/deals', label: 'Deals', icon: Handshake },
            { href: '/dashboard/crm/sales/pipelines', label: 'Pipelines', icon: Users },
            { href: '/dashboard/crm/sales/quotations', label: 'Quotations', icon: FileText },
            { href: '/dashboard/crm/sales/invoices', label: 'Invoices', icon: FileText },
            { href: '/dashboard/crm/sales/receipts', label: 'Payment Receipts', icon: CreditCard },
            { href: '/dashboard/crm/sales/proforma', label: 'Proforma Invoices', icon: BadgeInfo },
            { href: '/dashboard/crm/sales/orders', label: 'Sales Orders', icon: ShoppingCart },
            { href: '/dashboard/crm/sales/delivery', label: 'Delivery Challans', icon: Truck },
            { href: '/dashboard/crm/sales/credit-notes', label: 'Credit Notes', icon: Repeat },
            { href: '/dashboard/crm/sales/forms', label: 'Forms', icon: FileText },
        ]
    },
    {
        label: 'Purchases',
        icon: ShoppingCart,
        subItems: [
            { href: '/dashboard/crm/purchases/vendors', label: 'Vendors', icon: Briefcase },
            { href: '/dashboard/crm/purchases/expenses', label: 'Expenses', icon: CreditCard },
            { href: '/dashboard/crm/purchases/orders', label: 'Purchase Orders', icon: FileText },
            { href: '/dashboard/crm/purchases/payouts', label: 'Payout Receipts', icon: CreditCard },
            { href: '/dashboard/crm/purchases/debit-notes', label: 'Debit Notes', icon: Repeat },
            { href: '/dashboard/crm/purchases/hire', label: 'Hire The Best Vendors', icon: Star },
        ]
    },
    { href: '/dashboard/crm/contacts', label: 'Contacts', icon: Users },
    { href: '/dashboard/crm/accounts', label: 'Accounts', icon: Building },
    { href: '/dashboard/crm/products', label: 'Products', icon: ShoppingCart },
    { href: '/dashboard/crm/inventory', label: 'Inventory', icon: Truck },
    { href: '/dashboard/crm/tasks', label: 'Tasks', icon: FolderKanban },
    { href: '/dashboard/crm/email', label: 'Email', icon: Mail },
    { href: '/dashboard/crm/team-chat', label: 'Team Chat', icon: MessageSquare },
    { href: '/dashboard/crm/automations', label: 'Automations', icon: Zap },
    { href: '/dashboard/crm/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/crm/settings', label: 'Settings', icon: Settings },
];

function CrmTabLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // The logic to render specific page components is now handled by the main dashboard layout.
    // This component now only needs to render the children passed to it, which will be the correct page component for the current route.
    
    const PageComponent = pathComponentMap[pathname];

    if (!PageComponent) {
        // Fallback for sub-routes that don't have a direct mapping, e.g., /.../[id]/edit
        return <div className="p-8">{children}</div>;
    }
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}>
                   <PageComponent />
                </Suspense>
            </div>
        </div>
    );
}

export default function CrmTabLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div className="p-8"><Skeleton className="h-[calc(100vh-200px)] w-full" /></div>}>
            <CrmTabLayoutContent>{children}</CrmTabLayoutContent>
        </Suspense>
    );
}
