'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter, Button, Input, Label, Badge, Switch, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Separator, useToast, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/sabcrm/20ui/compat';
import { 
    Settings, Store, CreditCard, ShoppingBag, Bell, Globe, 
    Truck, Receipt, Save, RefreshCw, Upload, Plus, AlertCircle 
} from 'lucide-react';
import Link from 'next/link';

type TabKey = 'general' | 'payments' | 'checkout' | 'notifications' | 'domains' | 'navigation';

export default function SettingsPage() {
    const params = useParams<{ storefrontId: string }>();
    const router = useRouter();
    const { toast } = useToast();
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
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href={`/dashboard/sabshop/${params.storefrontId}`}>Store</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Settings</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-[var(--st-text)]">Settings</h1>
                        <p className="text-[var(--st-text-secondary)] mt-1">Manage your store's configuration and preferences.</p>
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
                                            ? 'bg-[var(--st-accent)]/10 text-[var(--st-accent)]' 
                                            : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-hover)] hover:text-[var(--st-text)]'
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 ${isActive ? 'text-[var(--st-accent)]' : 'text-[var(--st-text-secondary)]'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>

                    <Separator />

                    <div>
                        <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] mb-2">Operations</h3>
                        <nav className="flex flex-col space-y-1">
                            {quickLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={link.id}
                                        href={link.href}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium text-[var(--st-text-secondary)] hover:bg-[var(--st-hover)] hover:text-[var(--st-text)]"
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
                                <CardHeader>
                                    <CardTitle>Store Details</CardTitle>
                                    <CardDescription>Your customers will use this information to contact you.</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-4">
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
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select industry" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="apparel">Clothing & Apparel</SelectItem>
                                                <SelectItem value="electronics">Electronics</SelectItem>
                                                <SelectItem value="beauty">Health & Beauty</SelectItem>
                                                <SelectItem value="home">Home & Garden</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardBody>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Standards and Formats</CardTitle>
                                    <CardDescription>Standards and formats are used to calculate product prices, shipping weights, and order times.</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Timezone</Label>
                                            <Select defaultValue="pst">
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select timezone" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pst">(GMT-08:00) Pacific Time (US & Canada)</SelectItem>
                                                    <SelectItem value="est">(GMT-05:00) Eastern Time (US & Canada)</SelectItem>
                                                    <SelectItem value="ist">(GMT+05:30) Indian Standard Time</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Unit System</Label>
                                            <Select defaultValue="metric">
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select unit system" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="metric">Metric system (kg, g, cm)</SelectItem>
                                                    <SelectItem value="imperial">Imperial system (lb, oz, in)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Store Currency</Label>
                                        <Select defaultValue="usd">
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select currency" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="usd">US Dollar (USD)</SelectItem>
                                                <SelectItem value="inr">Indian Rupee (INR)</SelectItem>
                                                <SelectItem value="eur">Euro (EUR)</SelectItem>
                                                <SelectItem value="gbp">British Pound (GBP)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-[var(--st-text-secondary)] mt-1">Changing your store currency can affect the pricing of your products and discounts.</p>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card>
                                <CardHeader className="flex flex-row items-start justify-between">
                                    <div>
                                        <CardTitle>Payment Providers</CardTitle>
                                        <CardDescription>Accept payments on your store using third-party providers.</CardDescription>
                                    </div>
                                    <Badge variant="success">Active</Badge>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="p-4 border border-[var(--st-border)] rounded-lg bg-[var(--st-hover)] flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-[#635BFF] rounded-md flex items-center justify-center">
                                                <CreditCard className="text-white h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-[var(--st-text)]">Stripe</p>
                                                <p className="text-sm text-[var(--st-text-secondary)]">Credit cards, Apple Pay, Google Pay</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">Manage</Button>
                                    </div>
                                    
                                    <div className="p-4 border border-[var(--st-border)] rounded-lg flex items-center justify-between opacity-70">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-[#00457C] rounded-md flex items-center justify-center">
                                                <CreditCard className="text-white h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-[var(--st-text)]">PayPal Express Checkout</p>
                                                <p className="text-sm text-[var(--st-text-secondary)]">Accept PayPal payments</p>
                                            </div>
                                        </div>
                                        <Button variant="secondary" size="sm">Connect</Button>
                                    </div>
                                </CardBody>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Manual Payments</CardTitle>
                                    <CardDescription>Payments that are made outside of your online store.</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="flex items-center justify-between p-4 border border-[var(--st-border)] rounded-lg">
                                        <div className="space-y-1">
                                            <p className="font-medium text-[var(--st-text)]">Cash on Delivery (COD)</p>
                                            <p className="text-sm text-[var(--st-text-secondary)]">Collect payment when the order is delivered.</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border border-[var(--st-border)] rounded-lg">
                                        <div className="space-y-1">
                                            <p className="font-medium text-[var(--st-text)]">Bank Deposit</p>
                                            <p className="text-sm text-[var(--st-text-secondary)]">Customers transfer funds directly to your bank account.</p>
                                        </div>
                                        <Switch />
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'checkout' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Accounts</CardTitle>
                                    <CardDescription>Choose how customers interact with accounts at checkout.</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="space-y-3">
                                        <label className="flex items-start gap-3 p-3 border border-[var(--st-border)] rounded-lg cursor-pointer hover:bg-[var(--st-hover)] transition-colors">
                                            <input type="radio" name="accounts" className="mt-1" />
                                            <div>
                                                <p className="font-medium text-[var(--st-text)] text-sm">Don't use accounts</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Customers will only be able to check out as guests.</p>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-3 p-3 border border-[var(--st-accent)] bg-[var(--st-accent)]/5 rounded-lg cursor-pointer transition-colors">
                                            <input type="radio" name="accounts" className="mt-1" defaultChecked />
                                            <div>
                                                <p className="font-medium text-[var(--st-text)] text-sm">Accounts are optional</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Customers can check out with a customer account or as a guest.</p>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-3 p-3 border border-[var(--st-border)] rounded-lg cursor-pointer hover:bg-[var(--st-hover)] transition-colors">
                                            <input type="radio" name="accounts" className="mt-1" />
                                            <div>
                                                <p className="font-medium text-[var(--st-text)] text-sm">Accounts are required</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Customers must create an account or log in to complete checkout.</p>
                                            </div>
                                        </label>
                                    </div>
                                </CardBody>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Contact Method</CardTitle>
                                    <CardDescription>Choose how customers are contacted after placing an order.</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Switch defaultChecked />
                                            <Label>Phone number or email</Label>
                                        </div>
                                        <p className="text-sm text-[var(--st-text-secondary)] pl-11">Customers can check out using either their phone number or email address.</p>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Notifications</CardTitle>
                                    <CardDescription>Customize the emails and SMS messages sent to your customers.</CardDescription>
                                </CardHeader>
                                <CardBody>
                                    <div className="divide-y divide-[var(--st-border)] border border-[var(--st-border)] rounded-lg">
                                        <div className="flex items-center justify-between p-4 hover:bg-[var(--st-hover)] transition-colors">
                                            <div>
                                                <p className="font-medium text-[var(--st-text)] text-sm">Order Confirmation</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Sent automatically to the customer after they place their order.</p>
                                            </div>
                                            <Button variant="outline" size="sm">Edit</Button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 hover:bg-[var(--st-hover)] transition-colors">
                                            <div>
                                                <p className="font-medium text-[var(--st-text)] text-sm">Shipping Confirmation</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Sent automatically when their order has been shipped.</p>
                                            </div>
                                            <Button variant="outline" size="sm">Edit</Button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 hover:bg-[var(--st-hover)] transition-colors">
                                            <div>
                                                <p className="font-medium text-[var(--st-text)] text-sm">Customer Account Invite</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Sent to the customer with account activation instructions.</p>
                                            </div>
                                            <Button variant="outline" size="sm">Edit</Button>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'domains' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Domains</CardTitle>
                                        <CardDescription>Manage your custom domains and subdomains.</CardDescription>
                                    </div>
                                    <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Domain</Button>
                                </CardHeader>
                                <CardBody>
                                    <div className="border border-[var(--st-border)] rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[var(--st-hover)] border-b border-[var(--st-border)] text-xs uppercase text-[var(--st-text-secondary)]">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Domain</th>
                                                    <th className="px-4 py-3 font-medium">Status</th>
                                                    <th className="px-4 py-3 font-medium">Type</th>
                                                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--st-border)]">
                                                <tr className="hover:bg-[var(--st-hover)]/50">
                                                    <td className="px-4 py-4 font-medium text-[var(--st-text)] flex items-center gap-2">
                                                        sabshop-official.vercel.app
                                                        <Badge variant="default" className="text-[10px] px-1 py-0 h-4">Primary</Badge>
                                                    </td>
                                                    <td className="px-4 py-4"><Badge variant="success">Connected</Badge></td>
                                                    <td className="px-4 py-4 text-[var(--st-text-secondary)]">Sabnode Subdomain</td>
                                                    <td className="px-4 py-4 text-right"><Button variant="ghost" size="sm">Manage</Button></td>
                                                </tr>
                                                <tr className="hover:bg-[var(--st-hover)]/50">
                                                    <td className="px-4 py-4 font-medium text-[var(--st-text)]">
                                                        www.sabshop.com
                                                    </td>
                                                    <td className="px-4 py-4"><Badge variant="warning">Pending SSL</Badge></td>
                                                    <td className="px-4 py-4 text-[var(--st-text-secondary)]">Custom Domain</td>
                                                    <td className="px-4 py-4 text-right"><Button variant="ghost" size="sm">Manage</Button></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
