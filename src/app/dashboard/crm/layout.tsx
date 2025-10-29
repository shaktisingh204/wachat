
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Handshake, ShoppingBag, Briefcase, Database, Landmark, Users as UsersIcon, FileText, Settings, Zap, Bot, MessageSquare } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

const salesNavItems = [
    { href: "/dashboard/crm/sales/clients", label: "Clients & Prospects" },
    { href: "/dashboard/crm/sales/quotations", label: "Quotations" },
    { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices" },
    { href: "/dashboard/crm/sales/invoices", label: "Invoices" },
    { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts" },
    { href: "/dashboard/crm/sales/orders", label: "Sales Orders" },
    { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans" },
    { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes" },
];

const purchasesNavItems = [
    { href: "/dashboard/crm/purchases/leads", label: "Vendor Leads" },
    { href: "/dashboard/crm/purchases/vendors", label: "Vendors" },
    { href: "/dashboard/crm/purchases/expenses", label: "Expenses" },
    { href: "/dashboard/crm/purchases/orders", label: "Purchase Orders" },
    { href: "/dashboard/crm/purchases/payouts", label: "Payouts" },
    { href: "/dashboard/crm/purchases/debit-notes", label: "Debit Notes" },
    { href: "/dashboard/crm/purchases/hire", label: "Hire Vendors" },
];

const inventoryNavItems = [
    { href: "/dashboard/crm/inventory/items", label: "All Items" },
    { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses" },
    { href: "/dashboard/crm/inventory/adjustments", label: "Adjustments" },
    { href: "/dashboard/crm/inventory/all-transactions", label: "All Transactions" },
    { href: "/dashboard/crm/inventory/pnl", label: "Product P&L" },
    { href: "/dashboard/crm/inventory/stock-value", label: "Stock Value Report" },
    { href: "/dashboard/crm/inventory/batch-expiry", label: "Batch Expiry Report" },
    { href: "/dashboard/crm/inventory/party-transactions", label: "Party Transactions" },
];

const accountingNavItems = [
    { href: "/dashboard/crm/accounting/groups", label: "Account Groups" },
    { href: "/dashboard/crm/accounting/charts", label: "Chart of Accounts" },
    { href: "/dashboard/crm/accounting/vouchers", label: "Voucher Books" },
    { href: "/dashboard/crm/accounting/balance-sheet", label: "Balance Sheet" },
    { href: "/dashboard/crm/accounting/trial-balance", label: "Trial Balance" },
    { href: "/dashboard/crm/accounting/pnl", label: "Profit & Loss" },
    { href: "/dashboard/crm/accounting/income-statement", label: "Income Statement" },
    { href: "/dashboard/crm/accounting/day-book", label: "Day Book" },
    { href: "/dashboard/crm/accounting/cash-flow", label: "Cash Flow Statement" },
];

const bankingNavItems = [
    { href: "/dashboard/crm/banking/all", label: "All Payment Accounts" },
    { href: "/dashboard/crm/banking/bank-accounts", label: "Bank Accounts" },
    { href: "/dashboard/crm/banking/employee-accounts", label: "Employee Accounts" },
    { href: "/dashboard/crm/banking/reconciliation", label: "Bank Reconciliation" },
];

const teamNavItems = [
    { href: "/dashboard/crm/team/manage-users", label: "Manage Users" },
    { href: "/dashboard/crm/team/manage-roles", label: "Manage Team Roles" },
];


const CrmNavSection = ({ title, icon: Icon, basePath, subItems, isOpen: isSidebarOpen }: { title: string, icon: React.ElementType, basePath: string, subItems: {href: string, label: string}[], isOpen: boolean }) => {
    const pathname = usePathname();
    const isSectionActive = pathname.startsWith(basePath);

    return (
        <Collapsible defaultOpen={isSectionActive}>
            <CollapsibleTrigger asChild>
                <Button variant={isSectionActive ? 'secondary' : 'ghost'} className="w-full justify-start">
                    <Icon className="mr-2 h-4 w-4" />
                    {title}
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-90"/>
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="py-1 pl-6 space-y-1">
                {subItems.map(item => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.href} href={item.href}>
                             <Button variant={isActive ? 'ghost' : 'ghost'} size="sm" className={`w-full justify-start font-normal ${isActive ? 'bg-primary/10 text-primary' : ''}`}>
                                {item.label}
                            </Button>
                        </Link>
                    )
                })}
            </CollapsibleContent>
        </Collapsible>
    );
};


export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const { isOpen } = useSidebar();
    const pathname = usePathname();
    
    return (
        <div className="grid md:grid-cols-[240px_1fr] gap-8 h-full">
            <aside className="hidden md:block">
                 <Card>
                    <CardHeader className="p-4">
                        <CardTitle className="text-lg">CRM Suite</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                        <nav className="flex flex-col gap-1">
                            <Link href="/dashboard/crm"><Button variant={pathname === '/dashboard/crm' ? 'secondary' : 'ghost'} className="w-full justify-start"><BarChart className="mr-2 h-4 w-4"/>Dashboard</Button></Link>
                            <CrmNavSection title="Sales" icon={Handshake} basePath="/dashboard/crm/sales" subItems={salesNavItems} isOpen={isOpen} />
                            <CrmNavSection title="Purchases" icon={ShoppingBag} basePath="/dashboard/crm/purchases" subItems={purchasesNavItems} isOpen={isOpen} />
                            <CrmNavSection title="Inventory" icon={Briefcase} basePath="/dashboard/crm/inventory" subItems={inventoryNavItems} isOpen={isOpen} />
                            <CrmNavSection title="Accounting" icon={Database} basePath="/dashboard/crm/accounting" subItems={accountingNavItems} isOpen={isOpen} />
                            <CrmNavSection title="Bank & Payments" icon={Landmark} basePath="/dashboard/crm/banking" subItems={bankingNavItems} isOpen={isOpen} />
                            <CrmNavSection title="Manage Team" icon={UsersIcon} basePath="/dashboard/crm/team" subItems={teamNavItems} isOpen={isOpen} />
                            <Link href="/dashboard/crm/reports/gstr-1"><Button variant={pathname.startsWith('/dashboard/crm/reports') ? 'secondary' : 'ghost'} className="w-full justify-start"><FileText className="mr-2 h-4 w-4"/>GST Reports</Button></Link>
                            <Link href="/dashboard/crm/integrations"><Button variant={pathname === '/dashboard/crm/integrations' ? 'secondary' : 'ghost'} className="w-full justify-start"><Zap className="mr-2 h-4 w-4"/>Integrations</Button></Link>
                            <Link href="/dashboard/crm/hr-payroll"><Button variant={pathname === '/dashboard/crm/hr-payroll' ? 'secondary' : 'ghost'} className="w-full justify-start"><UsersIcon className="mr-2 h-4 w-4"/>HR & Payroll</Button></Link>
                            <Link href="/dashboard/crm/auto-leads-setup"><Button variant={pathname === '/dashboard/crm/auto-leads-setup' ? 'secondary' : 'ghost'} className="w-full justify-start"><Bot className="mr-2 h-4 w-4"/>Auto Leads Setup</Button></Link>
                        </nav>
                    </CardContent>
                </Card>
            </aside>
            <main className="min-h-0">
                {children}
            </main>
        </div>
    );
}
