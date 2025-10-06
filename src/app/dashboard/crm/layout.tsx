
'use client';

import React from 'react';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Handshake, Building, Users, ShoppingCart, Truck, FolderKanban, Mail, BarChart, Zap, Settings, LayoutDashboard,
    FileText, CreditCard, BadgeInfo, Repeat, Star, Briefcase, MessageSquare, KeyRound
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

export const crmMenuItems = [
    { href: '/dashboard/crm', label: 'Dashboard', icon: LayoutDashboard, component: LazyCrmDashboardPage },
    {
        label: 'Sales',
        icon: Handshake,
        subItems: [
            { href: '/dashboard/crm/sales/clients', label: 'Clients', icon: Users, component: LazyClientsPage },
            { href: '/dashboard/crm/sales/pipelines', label: 'Pipelines', icon: Users, component: LazyPipelinesPage },
            { href: '/dashboard/crm/sales/quotations', label: 'Quotations', icon: FileText, component: LazyQuotationsPage },
            { href: '/dashboard/crm/sales/invoices', label: 'Invoices', icon: FileText, component: LazyInvoicesPage },
            { href: '/dashboard/crm/sales/receipts', label: 'Payment Receipts', icon: CreditCard, component: LazyReceiptsPage },
            { href: '/dashboard/crm/sales/proforma', label: 'Proforma Invoices', icon: BadgeInfo, component: LazyProformaPage },
            { href: '/dashboard/crm/sales/orders', label: 'Sales Orders', icon: ShoppingCart, component: LazySalesOrdersPage },
            { href: '/dashboard/crm/sales/delivery', label: 'Delivery Challans', icon: Truck, component: LazyDeliveryPage },
            { href: '/dashboard/crm/sales/credit-notes', label: 'Credit Notes', icon: Repeat, component: LazyCreditNotesPage },
            { href: '/dashboard/crm/sales/forms', label: 'Forms', icon: FileText, component: LazyFormsPage },
        ]
    },
    {
        label: 'Purchases',
        icon: ShoppingCart,
        subItems: [
            { href: '/dashboard/crm/purchases/vendors', label: 'Vendors', icon: Briefcase, component: LazyVendorsPage },
            { href: '/dashboard/crm/purchases/expenses', label: 'Expenses', icon: CreditCard, component: LazyExpensesPage },
            { href: '/dashboard/crm/purchases/orders', label: 'Purchase Orders', icon: FileText, component: LazyPurchaseOrdersPage },
            { href: '/dashboard/crm/purchases/payouts', label: 'Payout Receipts', icon: CreditCard, component: LazyPayoutsPage },
            { href: '/dashboard/crm/purchases/debit-notes', label: 'Debit Notes', icon: Repeat, component: LazyDebitNotesPage },
            { href: '/dashboard/crm/purchases/hire', label: 'Hire The Best Vendors', icon: Star, component: LazyHirePage },
        ]
    },
    { href: '/dashboard/crm/contacts', label: 'Contacts', icon: Users, component: LazyCrmContactsPage },
    { href: '/dashboard/crm/accounts', label: 'Accounts', icon: Building, component: LazyCrmAccountsPage },
    { href: '/dashboard/crm/deals', label: 'Deals', icon: Handshake, component: LazyCrmDealsPage },
    { href: '/dashboard/crm/products', label: 'Products', icon: ShoppingCart, component: LazyCrmProductsPage },
    { href: '/dashboard/crm/inventory', label: 'Inventory', icon: Truck, component: LazyCrmInventoryLayout },
    { href: '/dashboard/crm/tasks', label: 'Tasks', icon: FolderKanban, component: LazyCrmTasksPage },
    { href: '/dashboard/crm/email', label: 'Email', icon: Mail, component: LazyCrmEmailPage },
    { href: '/dashboard/crm/team-chat', label: 'Team Chat', icon: MessageSquare, component: LazyCrmTeamChatPage },
    { href: '/dashboard/crm/automations', label: 'Automations', icon: Zap, component: LazyCrmAutomationsPage },
    { href: '/dashboard/crm/analytics', label: 'Analytics', icon: BarChart, component: LazyCrmAnalyticsPage },
    { href: '/dashboard/crm/settings', label: 'Settings', icon: Settings, component: LazyCrmSettingsPage },
];

function CrmTabLayoutContent({ children }: { children: React.ReactNode }) {
    // This component now just renders children, as the logic is in the main DashboardClientLayout
    return (
      <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}>
        {children}
      </Suspense>
    );
}

export default function CrmTabLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div className="p-8"><Skeleton className="h-[calc(100vh-200px)] w-full" /></div>}>
            <CrmTabLayoutContent>{children}</CrmTabLayoutContent>
        </Suspense>
    );
}
