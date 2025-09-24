
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X, Briefcase, Handshake, Building, Users, ShoppingCart, Truck, FolderKanban, Mail, BarChart, Zap, Settings, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { crmMenuItems } from '@/app/dashboard/crm/layout'; // Assuming this is where you defined your menu
import { cn } from '@/lib/utils';
import ClientsPage from '@/app/dashboard/crm/sales/clients/page';
import QuotationsPage from '@/app/dashboard/crm/sales/quotations/page';
import InvoicesPage from '@/app/dashboard/crm/sales/invoices/page';
import PaymentReceiptsPage from '@/app/dashboard/crm/sales/receipts/page';
import ProformaInvoicesPage from '@/app/dashboard/crm/sales/proforma/page';
import SalesOrdersPage from '@/app/dashboard/crm/sales/orders/page';
import DeliveryChallansPage from '@/app/dashboard/crm/sales/delivery/page';
import CreditNotesPage from '@/app/dashboard/crm/sales/credit-notes/page';
import VendorLeadsPage from '@/app/dashboard/crm/purchases/leads/page';
import VendorsPage from '@/app/dashboard/crm/purchases/vendors/page';
import ExpensesPage from '@/app/dashboard/crm/purchases/expenses/page';
import PurchaseOrdersPage from '@/app/dashboard/crm/purchases/orders/page';
import PayoutReceiptsPage from '@/app/dashboard/crm/purchases/payouts/page';
import DebitNotesPage from '@/app/dashboard/crm/purchases/debit-notes/page';
import HireVendorsPage from '@/app/dashboard/crm/purchases/hire/page';
import CrmDashboardPage from '@/app/dashboard/crm/page';
import CrmContactsPage from '@/app/dashboard/crm/contacts/page';
import CrmAccountsPage from '@/app/dashboard/crm/accounts/page';
import CrmDealsPage from '@/app/dashboard/crm/deals/page';
import CrmProductsPage from '@/app/dashboard/crm/products/page';
import CrmInventoryPage from '@/app/dashboard/crm/inventory/page';
import CrmTasksPage from '@/app/dashboard/crm/tasks/page';
import CrmEmailPage from '@/app/dashboard/crm/email/page';
import CrmTeamChatPage from '@/app/dashboard/crm/team-chat/page';
import CrmAnalyticsPage from '@/app/dashboard/crm/analytics/page';
import CrmSettingsPage from '@/app/dashboard/crm/settings/page';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

type Tab = {
  id: string;
  label: string;
  href: string;
  component: React.ComponentType<any>;
};

const pathComponentMap: Record<string, React.ComponentType<any>> = {
  '/dashboard/crm': CrmDashboardPage,
  '/dashboard/crm/sales/clients': ClientsPage,
  '/dashboard/crm/sales/quotations': QuotationsPage,
  '/dashboard/crm/sales/invoices': InvoicesPage,
  '/dashboard/crm/sales/receipts': PaymentReceiptsPage,
  '/dashboard/crm/sales/proforma': ProformaInvoicesPage,
  '/dashboard/crm/sales/orders': SalesOrdersPage,
  '/dashboard/crm/sales/delivery': DeliveryChallansPage,
  '/dashboard/crm/sales/credit-notes': CreditNotesPage,
  '/dashboard/crm/purchases/leads': VendorLeadsPage,
  '/dashboard/crm/purchases/vendors': VendorsPage,
  '/dashboard/crm/purchases/expenses': ExpensesPage,
  '/dashboard/crm/purchases/orders': PurchaseOrdersPage,
  '/dashboard/crm/purchases/payouts': PayoutReceiptsPage,
  '/dashboard/crm/purchases/debit-notes': DebitNotesPage,
  '/dashboard/crm/purchases/hire': HireVendorsPage,
  '/dashboard/crm/contacts': CrmContactsPage,
  '/dashboard/crm/accounts': CrmAccountsPage,
  '/dashboard/crm/deals': CrmDealsPage,
  '/dashboard/crm/products': CrmProductsPage,
  '/dashboard/crm/inventory': CrmInventoryPage,
  '/dashboard/crm/tasks': CrmTasksPage,
  '/dashboard/crm/email': CrmEmailPage,
  '/dashboard/crm/team-chat': CrmTeamChatPage,
  '/dashboard/crm/analytics': CrmAnalyticsPage,
  '/dashboard/crm/settings': CrmSettingsPage,
};


const allMenuItems = crmMenuItems.flatMap(item => 
  item.subItems ? item.subItems.map(sub => ({ ...sub, parent: item.label })) : [{ ...item, parent: null }]
);

export const CrmTabLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');

  useEffect(() => {
    const matchingItem = allMenuItems.find(item => pathname.startsWith(item.href) && item.href !== '#');

    if (matchingItem) {
      const existingTab = openTabs.find(tab => tab.id === matchingItem.href);
      if (!existingTab) {
        const component = pathComponentMap[matchingItem.href];
        if (component) {
          setOpenTabs(prev => [...prev, { id: matchingItem.href, label: matchingItem.label, href: matchingItem.href, component }]);
        }
      }
      setActiveTab(matchingItem.href);
    }
  }, [pathname, openTabs]);


  const closeTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
    setOpenTabs(prev => prev.filter(tab => tab.id !== tabId));

    if (activeTab === tabId) {
      if (openTabs.length > 1) {
        const newActiveTab = openTabs[tabIndex - 1] || openTabs[tabIndex + 1];
        setActiveTab(newActiveTab.id);
      } else {
        setActiveTab('');
      }
    }
  };
  
  const ActiveComponent = useMemo(() => {
    return openTabs.find(tab => tab.id === activeTab)?.component;
  }, [activeTab, openTabs]);


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
                    activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground'
                    )}
                    onClick={() => setActiveTab(tab.id)}
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
        {openTabs.map(tab => {
          const Component = tab.component;
          return (
            <div key={tab.id} className={cn("p-4 md:p-6 lg:p-8", activeTab === tab.id ? 'block' : 'hidden')}>
               {Component && <Component />}
            </div>
          )
        })}
      </div>
    </div>
  );
};
