
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X, Briefcase, Handshake, Building, Users, ShoppingCart, Truck, FolderKanban, Mail, BarChart, Zap, Settings, LayoutDashboard, FileText, CreditCard, BadgeInfo, Repeat, Video, Calendar, Package, TrendingUp, Rss, Globe, PhoneCall, Compass, Pencil, BookUser, Contact, FileUp, Inbox, ShieldCheck, KeyRound, Search, Plus, Hand, File as FileIcon, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from "lucide-react";

const pathComponentMap: Record<string, React.ComponentType<any>> = {
  '/dashboard/crm': React.lazy(() => import('@/app/dashboard/crm/page')),
  '/dashboard/crm/sales/clients': React.lazy(() => import('@/app/dashboard/crm/sales/clients/page')),
  '/dashboard/crm/sales/quotations': React.lazy(() => import('@/app/dashboard/crm/sales/quotations/page')),
  '/dashboard/crm/sales/invoices': React.lazy(() => import('@/app/dashboard/crm/sales/invoices/page')),
  '/dashboard/crm/sales/receipts': React.lazy(() => import('@/app/dashboard/crm/sales/receipts/page')),
  '/dashboard/crm/sales/proforma': React.lazy(() => import('@/app/dashboard/crm/sales/proforma/page')),
  '/dashboard/crm/sales/orders': React.lazy(() => import('@/app/dashboard/crm/sales/orders/page')),
  '/dashboard/crm/sales/delivery': React.lazy(() => import('@/app/dashboard/crm/sales/delivery/page')),
  '/dashboard/crm/sales/credit-notes': React.lazy(() => import('@/app/dashboard/crm/sales/credit-notes/page')),
  '/dashboard/crm/sales/pipelines': React.lazy(() => import('@/app/dashboard/crm/sales/pipelines/page')),
  '/dashboard/crm/sales/forms': React.lazy(() => import('@/app/dashboard/crm/sales/forms/page')),
  '/dashboard/crm/purchases/leads': React.lazy(() => import('@/app/dashboard/crm/purchases/leads/page')),
  '/dashboard/crm/purchases/vendors': React.lazy(() => import('@/app/dashboard/crm/purchases/vendors/page')),
  '/dashboard/crm/purchases/expenses': React.lazy(() => import('@/app/dashboard/crm/purchases/expenses/page')),
  '/dashboard/crm/purchases/orders': React.lazy(() => import('@/app/dashboard/crm/purchases/orders/page')),
  '/dashboard/crm/purchases/payouts': React.lazy(() => import('@/app/dashboard/crm/purchases/payouts/page')),
  '/dashboard/crm/purchases/debit-notes': React.lazy(() => import('@/app/dashboard/crm/purchases/debit-notes/page')),
  '/dashboard/crm/purchases/hire': React.lazy(() => import('@/app/dashboard/crm/purchases/hire/page')),
  '/dashboard/crm/contacts': React.lazy(() => import('@/app/dashboard/crm/contacts/page')),
  '/dashboard/crm/accounts': React.lazy(() => import('@/app/dashboard/crm/accounts/page')),
  '/dashboard/crm/deals': React.lazy(() => import('@/app/dashboard/crm/deals/page')),
  '/dashboard/crm/products': React.lazy(() => import('@/app/dashboard/crm/products/page')),
  '/dashboard/crm/inventory': React.lazy(() => import('@/app/dashboard/crm/inventory/layout')),
  '/dashboard/crm/tasks': React.lazy(() => import('@/app/dashboard/crm/tasks/page')),
  '/dashboard/crm/email': React.lazy(() => import('@/app/dashboard/crm/email/page')),
  '/dashboard/crm/team-chat': React.lazy(() => import('@/app/dashboard/crm/team-chat/page')),
  '/dashboard/crm/analytics': React.lazy(() => import('@/app/dashboard/crm/analytics/page')),
  '/dashboard/crm/settings': React.lazy(() => import('@/app/dashboard/crm/settings/page')),
  '/dashboard/crm/automations': React.lazy(() => import('@/app/dashboard/crm/automations/page')),
  // Detail pages
  '/dashboard/crm/accounts/[accountId]': React.lazy(() => import('@/app/dashboard/crm/accounts/[accountId]/page')),
  '/dashboard/crm/contacts/[contactId]': React.lazy(() => import('@/app/dashboard/crm/contacts/[contactId]/page')),
  '/dashboard/crm/deals/[dealId]': React.lazy(() => import('@/app/dashboard/crm/deals/[dealId]/page')),
  '/dashboard/crm/accounts/[accountId]/edit': React.lazy(() => import('@/app/dashboard/crm/accounts/[accountId]/edit/page')),
};


type Tab = {
  id: string;
  label: string;
  href: string;
  component: React.ComponentType<any>;
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

const allMenuItems = crmMenuItems.flatMap(item => 
  item.subItems ? item.subItems.map(sub => ({ ...sub, parent: item.label })) : [{ ...item, parent: null }]
);

function CrmTabLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();


    const activeTabId = useMemo(() => searchParams.get('tab') || '/dashboard/crm', [searchParams]);

    const [openTabs, setOpenTabs] = useState<Tab[]>(() => {
        const matchingItem = allMenuItems.find(item => item.href === activeTabId);
        const component = pathComponentMap[activeTabId];
        if (matchingItem && component) {
            return [{ id: activeTabId, href: activeTabId, label: matchingItem.label, component }];
        }
        return [];
    });

    useEffect(() => {git add src/app/dashboard/crm/layout.tsx

        // Find the best match for the current full pathname
        const sortedPaths = Object.keys(pathComponentMap).sort((a, b) => b.length - a.length);
        const bestMatch = sortedPaths.find(p => {
            const regex = new RegExp(`^${p.replace(/\[.*?\]/g, '[^/]+')}$`);
            return regex.test(pathname);
        });

        const component = bestMatch ? pathComponentMap[bestMatch] : null;
        setActiveComponent(() => component); // Using a function to ensure it updates correctly

        const tabId = getBaseTab(pathname);
        const matchingItem = allMenuItems.find(item => item.href === tabId);
        
        if (matchingItem) {
            const existingTab = openTabs.find(tab => tab.id === tabId);
            if (!existingTab) {
                const tabComponent = pathComponentMap[tabId];
                if (tabComponent) {
                    setOpenTabs(prev => [...prev, { id: tabId, href: tabId, label: matchingItem.label, component: tabComponent }]);
                }
            }
        }
    }, [pathname, openTabs]);


    const closeTab = (e: React.MouseEvent, tabIdToClose: string) => {
        e.stopPropagation();
        const tabIndex = openTabs.findIndex(tab => tab.id === tabIdToClose);
        
        const newTabs = openTabs.filter(tab => tab.id !== tabIdToClose);
        setOpenTabs(newTabs);
        
        if (activeTabId === tabIdToClose) {
            let newActiveTabId = '/dashboard/crm';
            if (newTabs.length > 0) {
                newActiveTabId = newTabs[Math.max(0, tabIndex - 1)].id;
            }
<<<<<<< HEAD
            router.push(newActiveTabId);
        }
    };

=======
            router.push(`/dashboard/crm?tab=${newActiveTabId}`);
        }
    };

    const handleTabClick = (tabId: string) => {
        router.push(`/dashboard/crm?tab=${tabId}`);
    };

>>>>>>> fe396806 (in crm module tabs are amazing but when i clicking in sidebar a tab open)
    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0">
                <ScrollArea className="w-full whitespace-nowrap border-b">
                    <div className="flex items-center px-1">
                        {openTabs.map(tab => (
                            <Button
                                key={tab.id}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'flex items-center gap-2 pr-1 rounded-b-none border-b-2',
                                    activeTabId === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground'
                                )}
                                onClick={() => router.push(tab.href)}
                            >
                                {tab.label}
                                <div
                                    role="button"
                                    onClick={(e) => closeTab(e, tab.id)}
                                    className="p-1 rounded-full hover:bg-muted"
                                >
                                    <X className="h-3 w-3" />
                                </div>
                            </Button>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
            <div className="flex-1 overflow-y-auto">
                <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}>
                   {ActiveComponent && <div className="p-4 md:p-6 lg:p-8"><ActiveComponent /></div>}
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
