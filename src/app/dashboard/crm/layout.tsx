
'use client';

import React from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Users, 
    Handshake, 
    BarChart, 
    Settings, 
    FolderKanban, 
    ShoppingCart, 
    Truck,
    BookCopy,
    Building,
    FileText,
    Repeat,
    BadgeInfo,
    CreditCard,
    GitFork,
    MessageSquare,
    IndianRupee
} from 'lucide-react';

export const crmMenuItems = [
    { href: "/dashboard/crm", label: "Dashboard", icon: BarChart, component: null },
    {
        href: "/dashboard/crm/sales",
        label: "Sales",
        icon: Handshake,
        subItems: [
            { href: "/dashboard/crm/sales/clients", label: "Clients", icon: Building },
            { href: "/dashboard/crm/deals", label: "Deals", icon: Handshake },
            { href: "/dashboard/crm/sales/quotations", label: "Quotations", icon: FileText },
            { href: "/dashboard/crm/sales/invoices", label: "Invoices", icon: FileText },
            { href: "/dashboard/crm/sales/orders", label: "Sales Orders", icon: ShoppingCart },
            { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts", icon: CreditCard },
            { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes", icon: Repeat },
            { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans", icon: Truck },
            { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoice", icon: BadgeInfo },
            { href: "/dashboard/crm/sales/forms", label: "Forms", icon: FileText },
        ]
    },
    { href: "/dashboard/crm/contacts", label: "Contacts", icon: Users, component: null },
    { href: "/dashboard/crm/accounts", label: "Accounts", icon: Building, component: null },
    { href: "/dashboard/crm/deals", label: "Deals", icon: Handshake, component: null },
    { href: "/dashboard/crm/tasks", label: "Tasks", icon: FolderKanban, component: null },
    {
        href: "/dashboard/crm/products",
        label: "Products",
        icon: ShoppingCart,
        subItems: [
            { href: "/dashboard/crm/products", label: "Products", icon: ShoppingCart },
        ]
    },
    { href: '/dashboard/crm/inventory', label: 'Inventory', icon: Truck, subItems: [
        { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses", icon: Truck },
        { href: "/dashboard/crm/inventory/adjustments", label: "Adjustments", icon: Repeat },
    ]},
    { href: '/dashboard/crm/purchases', label: 'Purchases', icon: ShoppingCart, subItems: [
        { href: "/dashboard/crm/purchases/vendors", label: "Vendors", icon: Users },
        { href: "/dashboard/crm/purchases/orders", label: "Purchase Orders", icon: FileText },
        { href: "/dashboard/crm/purchases/expenses", label: "Expenses", icon: IndianRupee },
        { href: "/dashboard/crm/purchases/debit-notes", label: "Debit Notes", icon: Repeat },
        { href: "/dashboard/crm/purchases/payouts", label: "Payout Receipts", icon: CreditCard },
    ] },
    { href: "/dashboard/crm/automations", label: "Automations", icon: GitFork, component: null },
    { href: "/dashboard/crm/analytics", label: "Analytics", icon: BarChart, component: null },
    { href: "/dashboard/crm/settings", label: "Settings", icon: Settings, component: null },
    { href: '/dashboard/crm/team-chat', label: 'Team Chat', icon: MessageSquare, component: null },
];

export default function CrmTabLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const renderNav = () => {
        const topLevelItem = crmMenuItems.find(item => pathname.startsWith(item.href) && item.subItems);
        if (topLevelItem && topLevelItem.subItems) {
            const activeTab = topLevelItem.subItems.find(item => pathname.startsWith(item.href))?.href || topLevelItem.subItems[0]?.href;
            return (
                <Tabs defaultValue={activeTab} className="w-full">
                    <TabsList className="overflow-x-auto whitespace-nowrap">
                        {topLevelItem.subItems.map(item => (
                             <TabsTrigger key={item.href} value={item.href} asChild>
                                <Link href={item.href}>
                                    <item.icon className="mr-2 h-4 w-4"/>
                                    {item.label}
                                </Link>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            );
        }
        return null;
    }

    return (
        <div className="flex flex-col gap-6 h-full p-4 md:p-6 lg:p-8">
            {renderNav()}
            <div className="mt-4 flex-1">
                 {children}
            </div>
        </div>
    );
}
