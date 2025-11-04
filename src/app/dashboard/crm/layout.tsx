'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BarChart, Handshake, ShoppingBag, Briefcase, Database, ChevronDown, FileText, Landmark, Users as UsersIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const CrmNavItems = [
    { href: "/dashboard/crm", label: "Dashboard", icon: BarChart, exact: true },
    {
        href: "/dashboard/crm/sales",
        label: "Sales",
        icon: Handshake,
        subItems: [
            { href: "/dashboard/crm/sales/clients", label: "Clients & Prospects" },
            { href: "/dashboard/crm/sales/quotations", label: "Quotation & Estimates" },
            { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices" },
            { href: "/dashboard/crm/sales/invoices", label: "Invoices" },
            { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts" },
            { href: "/dashboard/crm/sales/orders", label: "Sales Orders" },
            { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans" },
            { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes" },
        ]
    },
    {
        href: "/dashboard/crm/purchases",
        label: 'Purchases',
        icon: ShoppingBag,
        subItems: [
            { href: "/dashboard/crm/purchases/vendors", label: "Vendors & Suppliers" },
            { href: "/dashboard/crm/purchases/expenses", label: "Purchases & Expenses" },
            { href: "/dashboard/crm/purchases/orders", label: "Purchase Orders" },
            { href: "/dashboard/crm/purchases/payouts", label: "Payout Receipts" },
            { href: "/dashboard/crm/purchases/debit-notes", label: "Debit Notes" },
        ]
    },
     {
        href: '/dashboard/crm/inventory',
        label: 'Inventory',
        icon: Briefcase,
        subItems: [
            { href: "/dashboard/crm/inventory/items", label: "All Items" },
            { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses" },
            { href: "/dashboard/crm/inventory/pnl", label: "Product-wise P&L" },
            { href: "/dashboard/crm/inventory/stock-value", label: "Stock Value Report" },
            { href: "/dashboard/crm/inventory/batch-expiry", label: "Batch Expiry Report" },
            { href: "/dashboard/crm/inventory/party-transactions", label: "Party Transactions Report" },
            { href: "/dashboard/crm/inventory/all-transactions", label: "All Transactions Report" },
        ]
    },
    {
        href: "/dashboard/crm/accounting",
        label: "Accounting",
        icon: Database,
        subItems: [
            { href: "/dashboard/crm/accounting/groups", label: "Account Groups" },
            { href: "/dashboard/crm/accounting/charts", label: "Chart of Accounts" },
            { href: "/dashboard/crm/accounting/vouchers", label: "Voucher Books" },
            { href: "/dashboard/crm/accounting/balance-sheet", label: "Balance Sheet" },
            { href: "/dashboard/crm/accounting/trial-balance", label: "Trial Balance" },
            { href: "/dashboard/crm/accounting/pnl", label: "Profit and Loss" },
            { href: "/dashboard/crm/accounting/income-statement", label: "Income Statement" },
            { href: "/dashboard/crm/accounting/day-book", label: "Day Book" },
            { href: "/dashboard/crm/accounting/cash-flow", label: "Cash Flow Statement" },
        ]
    },
    {
        href: "/dashboard/crm/sales-crm",
        label: "Sales CRM",
        icon: BarChart,
        subItems: [
            { href: "/dashboard/crm/contacts", label: "Leads & Contacts" },
            { href: "/dashboard/crm/deals", label: "Deals Pipeline" },
            { href: "/dashboard/crm/tasks", label: "Tasks" },
            { href: "/dashboard/crm/automations", label: "Automations" },
            { href: "/dashboard/crm/sales-crm/pipelines", label: "Manage Pipelines" },
            { href: "/dashboard/crm/sales-crm/forms", label: "Forms" },
            { href: "/dashboard/crm/analytics", label: "Analytics" },
            { href: "/dashboard/crm/sales-crm/leads-summary", label: "Leads Summary" },
            { href: "/dashboard/crm/sales-crm/team-sales-report", label: "Team Sales Report" },
            { href: "/dashboard/crm/sales-crm/client-performance-report", label: "Client Performance Report" },
            { href: "/dashboard/crm/sales-crm/lead-source-report", label: "Lead Source Report" },
        ]
    },
    {
        href: "/dashboard/crm/banking",
        label: "Bank & Payments",
        icon: Landmark,
        subItems: [
            { href: "/dashboard/crm/banking/all", label: "All Payment Accounts" },
            { href: "/dashboard/crm/banking/bank-accounts", label: "Bank Accounts" },
            { href: "/dashboard/crm/banking/employee-accounts", label: "Employee Accounts" },
            { href: "/dashboard/crm/banking/reconciliation", label: "Bank Reconciliation" },
        ]
    },
    {
        href: "/dashboard/crm/hr-payroll",
        label: "HR Management",
        icon: UsersIcon,
        subItems: [
            { href: "/dashboard/crm/hr-payroll/employees", label: "Employee Directory" },
            { href: "/dashboard/crm/hr-payroll/departments", label: "Departments" },
            { href: "/dashboard/crm/hr-payroll/designations", label: "Designations" },
        ],
    },
    {
        href: "/dashboard/crm/reports",
        label: "GST Reports",
        icon: FileText,
        subItems: [
            { href: "/dashboard/crm/reports/gstr-1", label: "GSTR-1 Sales Report" },
            { href: "/dashboard/crm/reports/gstr-2b", label: "GSTR-2B Purchase Report" },
        ]
    },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="w-full">
            <div className="flex justify-start items-center gap-1 border-b">
                {CrmNavItems.map(item => {
                    const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                    if (item.subItems) {
                        return (
                            <DropdownMenu key={item.href}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant={isActive ? "secondary" : "ghost"} className="rounded-b-none border-b-2 border-transparent data-[state=open]:border-primary data-[state=open]:text-primary">
                                        <item.icon className="mr-2 h-4 w-4" />
                                        {item.label} <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {item.subItems.map(subItem => (
                                        <DropdownMenuItem key={subItem.href} asChild>
                                            <Link href={subItem.href}>{subItem.label}</Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    }
                    return (
                        <Button key={item.href} asChild variant={isActive ? "secondary" : "ghost"} className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
                            <Link href={item.href}>
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Link>
                        </Button>
                    )
                })}
            </div>
            <div className="mt-6">
                 {children}
            </div>
        </div>
    );
}
