'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
    Card, CardHeader, CardTitle, CardDescription, CardBody,
    Button, Input, Field, Badge, Switch,
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
    RadioGroup, Radio,
    Table, THead, TBody, Tr, Th, Td,
    Separator, useToast,
    Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage,
    PageHeader, PageHeaderHeading, PageTitle, PageDescription, PageActions,
} from '@/components/sabcrm/20ui';
import {
    Store, CreditCard, ShoppingBag, Bell, Globe,
    Truck, Receipt, Save, RefreshCw, Plus,
} from 'lucide-react';
import Link from 'next/link';

type TabKey = 'general' | 'payments' | 'checkout' | 'notifications' | 'domains' | 'navigation';

export default function SettingsPage() {
    const params = useParams<{ storefrontId: string }>();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = React.useState<TabKey>('general');
    const [isSaving, setIsSaving] = React.useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            toast({
                title: 'Settings saved',
                description: 'Your changes have been successfully saved.',
                tone: 'success',
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
        <div className="flex h-full flex-col gap-6 p-8 max-w-7xl mx-auto w-full">
            <div className="flex flex-col gap-2">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href={`/dashboard/sabshop/${params.storefrontId}`}>Store</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Settings</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <PageHeader>
                    <PageHeaderHeading>
                        <PageTitle>Settings</PageTitle>
                        <PageDescription>Manage your store&apos;s configuration and preferences.</PageDescription>
                    </PageHeaderHeading>
                    <PageActions>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            disabled={isSaving}
                            loading={isSaving}
                            iconLeft={isSaving ? RefreshCw : Save}
                        >
                            Save Changes
                        </Button>
                    </PageActions>
                </PageHeader>
            </div>

            <div className="flex flex-col md:flex-row gap-8 mt-4">
                {/* Sidebar Navigation */}
                <aside className="md:w-64 flex-shrink-0 space-y-6">
                    <nav className="flex flex-col space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <Button
                                    key={tab.id}
                                    variant="ghost"
                                    block
                                    aria-pressed={isActive}
                                    onClick={() => setActiveTab(tab.id as TabKey)}
                                    iconLeft={Icon}
                                    className={`justify-start ${isActive ? 'text-[var(--st-accent)] bg-[var(--st-accent)]/10' : 'text-[var(--st-text-secondary)]'}`}
                                >
                                    {tab.label}
                                </Button>
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
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--st-radius)] transition-colors text-sm font-medium text-[var(--st-text-secondary)] hover:bg-[var(--st-hover)] hover:text-[var(--st-text)]"
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
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
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Store Details</CardTitle>
                                    <CardDescription>Your customers will use this information to contact you.</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Store Name">
                                            <Input defaultValue="SabShop Official" />
                                        </Field>
                                        <Field label="Store Contact Email">
                                            <Input defaultValue="support@sabshop.com" type="email" />
                                        </Field>
                                    </div>
                                    <Field label="Phone Number">
                                        <Input defaultValue="+1 (555) 123-4567" type="tel" />
                                    </Field>
                                    <Field label="Store Industry">
                                        <Select defaultValue="apparel">
                                            <SelectTrigger aria-label="Store Industry">
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
                                    </Field>
                                </CardBody>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Standards and Formats</CardTitle>
                                    <CardDescription>Standards and formats are used to calculate product prices, shipping weights, and order times.</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Timezone">
                                            <Select defaultValue="pst">
                                                <SelectTrigger aria-label="Timezone">
                                                    <SelectValue placeholder="Select timezone" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pst">(GMT-08:00) Pacific Time (US & Canada)</SelectItem>
                                                    <SelectItem value="est">(GMT-05:00) Eastern Time (US & Canada)</SelectItem>
                                                    <SelectItem value="ist">(GMT+05:30) Indian Standard Time</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                        <Field label="Unit System">
                                            <Select defaultValue="metric">
                                                <SelectTrigger aria-label="Unit System">
                                                    <SelectValue placeholder="Select unit system" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="metric">Metric system (kg, g, cm)</SelectItem>
                                                    <SelectItem value="imperial">Imperial system (lb, oz, in)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    </div>
                                    <Field
                                        label="Store Currency"
                                        help="Changing your store currency can affect the pricing of your products and discounts."
                                    >
                                        <Select defaultValue="usd">
                                            <SelectTrigger aria-label="Store Currency">
                                                <SelectValue placeholder="Select currency" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="usd">US Dollar (USD)</SelectItem>
                                                <SelectItem value="inr">Indian Rupee (INR)</SelectItem>
                                                <SelectItem value="eur">Euro (EUR)</SelectItem>
                                                <SelectItem value="gbp">British Pound (GBP)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-start justify-between">
                                    <div>
                                        <CardTitle>Payment Providers</CardTitle>
                                        <CardDescription>Accept payments on your store using third-party providers.</CardDescription>
                                    </div>
                                    <Badge tone="success">Active</Badge>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="p-4 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-hover)] flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-md flex items-center justify-center bg-[#635BFF]">
                                                <CreditCard className="text-white h-5 w-5" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-[var(--st-text)]">Stripe</p>
                                                <p className="text-sm text-[var(--st-text-secondary)]">Credit cards, Apple Pay, Google Pay</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">Manage</Button>
                                    </div>

                                    <div className="p-4 border border-[var(--st-border)] rounded-[var(--st-radius)] flex items-center justify-between opacity-70">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-md flex items-center justify-center bg-[#00457C]">
                                                <CreditCard className="text-white h-5 w-5" aria-hidden="true" />
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
                                    <div className="flex items-center justify-between p-4 border border-[var(--st-border)] rounded-[var(--st-radius)]">
                                        <div className="space-y-1">
                                            <p className="font-medium text-[var(--st-text)]">Cash on Delivery (COD)</p>
                                            <p className="text-sm text-[var(--st-text-secondary)]">Collect payment when the order is delivered.</p>
                                        </div>
                                        <Switch defaultChecked aria-label="Cash on Delivery (COD)" />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border border-[var(--st-border)] rounded-[var(--st-radius)]">
                                        <div className="space-y-1">
                                            <p className="font-medium text-[var(--st-text)]">Bank Deposit</p>
                                            <p className="text-sm text-[var(--st-text-secondary)]">Customers transfer funds directly to your bank account.</p>
                                        </div>
                                        <Switch aria-label="Bank Deposit" />
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'checkout' && (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Accounts</CardTitle>
                                    <CardDescription>Choose how customers interact with accounts at checkout.</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <RadioGroup defaultValue="optional" aria-label="Customer accounts" className="space-y-3">
                                        <label className="flex items-start gap-3 p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] cursor-pointer hover:bg-[var(--st-hover)] transition-colors">
                                            <Radio value="none" className="mt-1" />
                                            <div>
                                                <p className="font-medium text-[var(--st-text)] text-sm">Don&apos;t use accounts</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Customers will only be able to check out as guests.</p>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-3 p-3 border border-[var(--st-accent)] bg-[var(--st-accent)]/5 rounded-[var(--st-radius)] cursor-pointer transition-colors">
                                            <Radio value="optional" className="mt-1" />
                                            <div>
                                                <p className="font-medium text-[var(--st-text)] text-sm">Accounts are optional</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Customers can check out with a customer account or as a guest.</p>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-3 p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] cursor-pointer hover:bg-[var(--st-hover)] transition-colors">
                                            <Radio value="required" className="mt-1" />
                                            <div>
                                                <p className="font-medium text-[var(--st-text)] text-sm">Accounts are required</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">Customers must create an account or log in to complete checkout.</p>
                                            </div>
                                        </label>
                                    </RadioGroup>
                                </CardBody>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Contact Method</CardTitle>
                                    <CardDescription>Choose how customers are contacted after placing an order.</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="space-y-2">
                                        <Switch defaultChecked label="Phone number or email" />
                                        <p className="text-sm text-[var(--st-text-secondary)] pl-11">Customers can check out using either their phone number or email address.</p>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Notifications</CardTitle>
                                    <CardDescription>Customize the emails and SMS messages sent to your customers.</CardDescription>
                                </CardHeader>
                                <CardBody>
                                    <div className="divide-y divide-[var(--st-border)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
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
                        <div className="space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Domains</CardTitle>
                                        <CardDescription>Manage your custom domains and subdomains.</CardDescription>
                                    </div>
                                    <Button variant="primary" size="sm" iconLeft={Plus}>Add Domain</Button>
                                </CardHeader>
                                <CardBody>
                                    <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden">
                                        <Table>
                                            <THead>
                                                <Tr>
                                                    <Th>Domain</Th>
                                                    <Th>Status</Th>
                                                    <Th>Type</Th>
                                                    <Th align="right">Actions</Th>
                                                </Tr>
                                            </THead>
                                            <TBody>
                                                <Tr>
                                                    <Td>
                                                        <span className="inline-flex items-center gap-2 font-medium text-[var(--st-text)]">
                                                            sabshop-official.vercel.app
                                                            <Badge tone="neutral">Primary</Badge>
                                                        </span>
                                                    </Td>
                                                    <Td><Badge tone="success">Connected</Badge></Td>
                                                    <Td><span className="text-[var(--st-text-secondary)]">Sabnode Subdomain</span></Td>
                                                    <Td align="right"><Button variant="ghost" size="sm">Manage</Button></Td>
                                                </Tr>
                                                <Tr>
                                                    <Td><span className="font-medium text-[var(--st-text)]">www.sabshop.com</span></Td>
                                                    <Td><Badge tone="warning">Pending SSL</Badge></Td>
                                                    <Td><span className="text-[var(--st-text-secondary)]">Custom Domain</span></Td>
                                                    <Td align="right"><Button variant="ghost" size="sm">Manage</Button></Td>
                                                </Tr>
                                            </TBody>
                                        </Table>
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
