'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent, ZoruCardFooter,
    Button, Input, Label, Badge, Switch, Select, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem,
    Separator, useZoruToast, Breadcrumb, ZoruBreadcrumbList, ZoruBreadcrumbItem, ZoruBreadcrumbLink, ZoruBreadcrumbSeparator, ZoruBreadcrumbPage
} from '@/components/zoruui';
import { 
    Settings, Store, CreditCard, ShoppingBag, Bell, Globe, 
    Truck, Receipt, Save, RefreshCw, Upload, Plus, AlertCircle 
} from 'lucide-react';
import Link from 'next/link';

type TabKey = 'general' | 'payments' | 'checkout' | 'notifications' | 'domains' | 'navigation';

export default function SettingsPage() {
    const params = useParams<{ storefrontId: string }>();
    const router = useRouter();
    const { toast } = useZoruToast();
    const [activeTab, setActiveTab] = React.useState<TabKey>('general');
    const [isSaving, setIsSaving] = React.useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            toast({
                title: 'Settings Saved',
                description: 'Your changes have been successfully saved.',
                variant: 'default',
            });
        }, 1000);
    };

    const tabs = [
        { id: 'general', label: 'General', icon: Store, description: 'Store details, timezone, and currency' },
        { id: 'payments', label: 'Payments', icon: CreditCard, description: 'Payment providers and manual payments' },
        { id: 'checkout', label: 'Checkout', icon: ShoppingBag, description: 'Customer accounts and form options' },
        { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email templates and alerts' },
        { id: 'domains', label: 'Domains', icon: Globe, description: 'Custom domain configuration' },
    ] as const;

    const quickLinks = [
        { id: 'shipping', label: 'Shipping & Delivery', icon: Truck, href: `/dashboard/sabshop/${params.storefrontId}/shipping`, description: 'Manage shipping zones and rates' },
        { id: 'taxes', label: 'Taxes & Duties', icon: Receipt, href: `/dashboard/sabshop/${params.storefrontId}/taxes`, description: 'Configure regional tax overrides' },
    ];

    return (
        <div className="zoruui flex h-full flex-col gap-6 p-8 max-w-7xl mx-auto w-full">
            <div className="flex flex-col gap-2">
                <Breadcrumb>
                    <ZoruBreadcrumbList>
                        <ZoruBreadcrumbItem>
                            <ZoruBreadcrumbLink href={`/dashboard/sabshop/${params.storefrontId}`}>Store</ZoruBreadcrumbLink>
                        </ZoruBreadcrumbItem>
                        <ZoruBreadcrumbSeparator />
                        <ZoruBreadcrumbItem>
                            <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
                        </ZoruBreadcrumbItem>
                    </ZoruBreadcrumbList>
                </Breadcrumb>
                
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zoru-ink">Settings</h1>
                        <p className="text-zoru-ink-muted mt-1">Manage your store's configuration and preferences.</p>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 mt-4">
                {/* Sidebar Navigation */}
                <aside className="md:w-64 flex-shrink-0 space-y-6">
                    <nav className="flex flex-col space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabKey)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                                        isActive 
                                            ? 'bg-zoru-brand/10 text-zoru-brand' 
                                            : 'text-zoru-ink-muted hover:bg-zoru-background-hover hover:text-zoru-ink'
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 ${isActive ? 'text-zoru-brand' : 'text-zoru-ink-muted'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>

                    <Separator />

                    <div>
                        <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-zoru-ink-muted mb-2">Operations</h3>
                        <nav className="flex flex-col space-y-1">
                            {quickLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={link.id}
                                        href={link.href}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium text-zoru-ink-muted hover:bg-zoru-background-hover hover:text-zoru-ink"
                                    >
                                        <Icon className="h-4 w-4" />
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 space-y-6">
                    {activeTab === 'general' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>Store Details</ZoruCardTitle>
                                    <ZoruCardDescription>Your customers will use this information to contact you.</ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Store Name</Label>
                                            <Input defaultValue="SabShop Official" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Store Contact Email</Label>
                                            <Input defaultValue="support@sabshop.com" type="email" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone Number</Label>
                                        <Input defaultValue="+1 (555) 123-4567" type="tel" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Store Industry</Label>
                                        <Select defaultValue="apparel">
                                            <ZoruSelectTrigger>
                                                <ZoruSelectValue placeholder="Select industry" />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="apparel">Clothing & Apparel</ZoruSelectItem>
                                                <ZoruSelectItem value="electronics">Electronics</ZoruSelectItem>
                                                <ZoruSelectItem value="beauty">Health & Beauty</ZoruSelectItem>
                                                <ZoruSelectItem value="home">Home & Garden</ZoruSelectItem>
                                                <ZoruSelectItem value="other">Other</ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </Select>
                                    </div>
                                </ZoruCardContent>
                            </Card>

                            <Card>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>Standards and Formats</ZoruCardTitle>
                                    <ZoruCardDescription>Standards and formats are used to calculate product prices, shipping weights, and order times.</ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Timezone</Label>
                                            <Select defaultValue="pst">
                                                <ZoruSelectTrigger>
                                                    <ZoruSelectValue placeholder="Select timezone" />
                                                </ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    <ZoruSelectItem value="pst">(GMT-08:00) Pacific Time (US & Canada)</ZoruSelectItem>
                                                    <ZoruSelectItem value="est">(GMT-05:00) Eastern Time (US & Canada)</ZoruSelectItem>
                                                    <ZoruSelectItem value="ist">(GMT+05:30) Indian Standard Time</ZoruSelectItem>
                                                </ZoruSelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Unit System</Label>
                                            <Select defaultValue="metric">
                                                <ZoruSelectTrigger>
                                                    <ZoruSelectValue placeholder="Select unit system" />
                                                </ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    <ZoruSelectItem value="metric">Metric system (kg, g, cm)</ZoruSelectItem>
                                                    <ZoruSelectItem value="imperial">Imperial system (lb, oz, in)</ZoruSelectItem>
                                                </ZoruSelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Store Currency</Label>
                                        <Select defaultValue="usd">
                                            <ZoruSelectTrigger>
                                                <ZoruSelectValue placeholder="Select currency" />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="usd">US Dollar (USD)</ZoruSelectItem>
                                                <ZoruSelectItem value="inr">Indian Rupee (INR)</ZoruSelectItem>
                                                <ZoruSelectItem value="eur">Euro (EUR)</ZoruSelectItem>
                                                <ZoruSelectItem value="gbp">British Pound (GBP)</ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </Select>
                                        <p className="text-xs text-zoru-ink-muted mt-1">Changing your store currency can affect the pricing of your products and discounts.</p>
                                    </div>
                                </ZoruCardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card>
                                <ZoruCardHeader className="flex flex-row items-start justify-between">
                                    <div>
                                        <ZoruCardTitle>Payment Providers</ZoruCardTitle>
                                        <ZoruCardDescription>Accept payments on your store using third-party providers.</ZoruCardDescription>
                                    </div>
                                    <Badge variant="success">Active</Badge>
                                </ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="p-4 border border-zoru-border rounded-lg bg-zoru-background-hover flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-[#635BFF] rounded-md flex items-center justify-center">
                                                <CreditCard className="text-white h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-zoru-ink">Stripe</p>
                                                <p className="text-sm text-zoru-ink-muted">Credit cards, Apple Pay, Google Pay</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">Manage</Button>
                                    </div>
                                    
                                    <div className="p-4 border border-zoru-border rounded-lg flex items-center justify-between opacity-70">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-[#00457C] rounded-md flex items-center justify-center">
                                                <CreditCard className="text-white h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-zoru-ink">PayPal Express Checkout</p>
                                                <p className="text-sm text-zoru-ink-muted">Accept PayPal payments</p>
                                            </div>
                                        </div>
                                        <Button variant="secondary" size="sm">Connect</Button>
                                    </div>
                                </ZoruCardContent>
                            </Card>

                            <Card>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>Manual Payments</ZoruCardTitle>
                                    <ZoruCardDescription>Payments that are made outside of your online store.</ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="flex items-center justify-between p-4 border border-zoru-border rounded-lg">
                                        <div className="space-y-1">
                                            <p className="font-medium text-zoru-ink">Cash on Delivery (COD)</p>
                                            <p className="text-sm text-zoru-ink-muted">Collect payment when the order is delivered.</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border border-zoru-border rounded-lg">
                                        <div className="space-y-1">
                                            <p className="font-medium text-zoru-ink">Bank Deposit</p>
                                            <p className="text-sm text-zoru-ink-muted">Customers transfer funds directly to your bank account.</p>
                                        </div>
                                        <Switch />
                                    </div>
                                </ZoruCardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'checkout' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>Customer Accounts</ZoruCardTitle>
                                    <ZoruCardDescription>Choose how customers interact with accounts at checkout.</ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <label className="flex items-start gap-3 p-3 border border-zoru-border rounded-lg cursor-pointer hover:bg-zoru-background-hover transition-colors">
                                            <input type="radio" name="accounts" className="mt-1" />
                                            <div>
                                                <p className="font-medium text-zoru-ink text-sm">Don't use accounts</p>
                                                <p className="text-xs text-zoru-ink-muted">Customers will only be able to check out as guests.</p>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-3 p-3 border border-zoru-brand bg-zoru-brand/5 rounded-lg cursor-pointer transition-colors">
                                            <input type="radio" name="accounts" className="mt-1" defaultChecked />
                                            <div>
                                                <p className="font-medium text-zoru-ink text-sm">Accounts are optional</p>
                                                <p className="text-xs text-zoru-ink-muted">Customers can check out with a customer account or as a guest.</p>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-3 p-3 border border-zoru-border rounded-lg cursor-pointer hover:bg-zoru-background-hover transition-colors">
                                            <input type="radio" name="accounts" className="mt-1" />
                                            <div>
                                                <p className="font-medium text-zoru-ink text-sm">Accounts are required</p>
                                                <p className="text-xs text-zoru-ink-muted">Customers must create an account or log in to complete checkout.</p>
                                            </div>
                                        </label>
                                    </div>
                                </ZoruCardContent>
                            </Card>

                            <Card>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>Customer Contact Method</ZoruCardTitle>
                                    <ZoruCardDescription>Choose how customers are contacted after placing an order.</ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Switch defaultChecked />
                                            <Label>Phone number or email</Label>
                                        </div>
                                        <p className="text-sm text-zoru-ink-muted pl-11">Customers can check out using either their phone number or email address.</p>
                                    </div>
                                </ZoruCardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>Customer Notifications</ZoruCardTitle>
                                    <ZoruCardDescription>Customize the emails and SMS messages sent to your customers.</ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <div className="divide-y divide-zoru-border border border-zoru-border rounded-lg">
                                        <div className="flex items-center justify-between p-4 hover:bg-zoru-background-hover transition-colors">
                                            <div>
                                                <p className="font-medium text-zoru-ink text-sm">Order Confirmation</p>
                                                <p className="text-xs text-zoru-ink-muted">Sent automatically to the customer after they place their order.</p>
                                            </div>
                                            <Button variant="outline" size="sm">Edit</Button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 hover:bg-zoru-background-hover transition-colors">
                                            <div>
                                                <p className="font-medium text-zoru-ink text-sm">Shipping Confirmation</p>
                                                <p className="text-xs text-zoru-ink-muted">Sent automatically when their order has been shipped.</p>
                                            </div>
                                            <Button variant="outline" size="sm">Edit</Button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 hover:bg-zoru-background-hover transition-colors">
                                            <div>
                                                <p className="font-medium text-zoru-ink text-sm">Customer Account Invite</p>
                                                <p className="text-xs text-zoru-ink-muted">Sent to the customer with account activation instructions.</p>
                                            </div>
                                            <Button variant="outline" size="sm">Edit</Button>
                                        </div>
                                    </div>
                                </ZoruCardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'domains' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card>
                                <ZoruCardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <ZoruCardTitle>Domains</ZoruCardTitle>
                                        <ZoruCardDescription>Manage your custom domains and subdomains.</ZoruCardDescription>
                                    </div>
                                    <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Domain</Button>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <div className="border border-zoru-border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-zoru-background-hover border-b border-zoru-border text-xs uppercase text-zoru-ink-muted">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Domain</th>
                                                    <th className="px-4 py-3 font-medium">Status</th>
                                                    <th className="px-4 py-3 font-medium">Type</th>
                                                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zoru-border">
                                                <tr className="hover:bg-zoru-background-hover/50">
                                                    <td className="px-4 py-4 font-medium text-zoru-ink flex items-center gap-2">
                                                        sabshop-official.vercel.app
                                                        <Badge variant="default" className="text-[10px] px-1 py-0 h-4">Primary</Badge>
                                                    </td>
                                                    <td className="px-4 py-4"><Badge variant="success">Connected</Badge></td>
                                                    <td className="px-4 py-4 text-zoru-ink-muted">Sabnode Subdomain</td>
                                                    <td className="px-4 py-4 text-right"><Button variant="ghost" size="sm">Manage</Button></td>
                                                </tr>
                                                <tr className="hover:bg-zoru-background-hover/50">
                                                    <td className="px-4 py-4 font-medium text-zoru-ink">
                                                        www.sabshop.com
                                                    </td>
                                                    <td className="px-4 py-4"><Badge variant="warning">Pending SSL</Badge></td>
                                                    <td className="px-4 py-4 text-zoru-ink-muted">Custom Domain</td>
                                                    <td className="px-4 py-4 text-right"><Button variant="ghost" size="sm">Manage</Button></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </ZoruCardContent>
                            </Card>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
