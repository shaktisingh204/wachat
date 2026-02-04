'use client';

import { useActionState, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LoaderCircle, Save, Building, FileText, Package, Users, Bell, Layers, CheckCircle } from 'lucide-react';
import { saveCrmSettings } from '@/app/actions/crm-settings.actions';
import { useToast } from '@/hooks/use-toast';
import { CrmSettings, WithId } from '@/lib/definitions';

const initialState: { message?: string; error?: string } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending: isPending } = useStatus();
    return (
        <Button type="submit" disabled={isPending}>
            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
        </Button>
    );
}
// Workaround for useFormStatus not being available directly in the same component tree sometimes or simpler isolation
import { useFormStatus as useStatus } from 'react-dom';

export function CrmSettingsForm({ settings }: { settings: WithId<CrmSettings> }) {
    const [state, formAction] = useActionState(saveCrmSettings, initialState);
    const { toast } = useToast();

    // Controlled states for Select/Switch inputs to ensure sync with hidden inputs
    const [currency, setCurrency] = useState(settings.currency);
    const [dateFormat, setDateFormat] = useState(settings.dateFormat);
    const [timezone, setTimezone] = useState(settings.timezone);
    const [financialYear, setFinancialYear] = useState(settings.financialYearStart);

    // Toggles
    const [stockValidation, setStockValidation] = useState(settings.enableStockValidation);
    const [lowStockAlerts, setLowStockAlerts] = useState(settings.enableLowStockAlerts);

    // Modules
    const [modules, setModules] = useState(settings.modules);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success", description: state.message });
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: "destructive" });
        }
    }, [state, toast]);

    return (
        <form action={formAction}>
            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto">
                    <TabsTrigger value="general" className="py-2"><Building className="w-4 h-4 mr-2" /> General</TabsTrigger>
                    <TabsTrigger value="sales" className="py-2"><FileText className="w-4 h-4 mr-2" /> Sales</TabsTrigger>
                    <TabsTrigger value="inventory" className="py-2"><Package className="w-4 h-4 mr-2" /> Inventory</TabsTrigger>
                    <TabsTrigger value="hr" className="py-2"><Users className="w-4 h-4 mr-2" /> HR</TabsTrigger>
                    <TabsTrigger value="modules" className="py-2"><Layers className="w-4 h-4 mr-2" /> Modules</TabsTrigger>
                    {/* <TabsTrigger value="notifications" className="py-2"><Bell className="w-4 h-4 mr-2" /> Alerts</TabsTrigger> */}
                </TabsList>

                {/* --- GENERAL SETTINGS --- */}
                <TabsContent value="general" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Organization Profile</CardTitle>
                            <CardDescription>Details that will appear on your documents (Invoices, POs).</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="companyName">Company Name</Label>
                                    <Input id="companyName" name="companyName" defaultValue={settings.companyName} placeholder="Acme Corp" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyPhone">Phone</Label>
                                    <Input id="companyPhone" name="companyPhone" defaultValue={settings.companyPhone} placeholder="+91 99999 99999" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyEmail">Email</Label>
                                    <Input id="companyEmail" name="companyEmail" defaultValue={settings.companyEmail} placeholder="info@acme.com" type="email" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gstin">GSTIN / Tax ID</Label>
                                    <Input id="gstin" name="gstin" defaultValue={settings.gstin} placeholder="GSTIN Number" />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="companyAddress">Address</Label>
                                    <Textarea id="companyAddress" name="companyAddress" defaultValue={settings.companyAddress} placeholder="Full business address" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Regional Settings</CardTitle>
                            <CardDescription>Localization settings for your CRM.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select value={currency} onValueChange={setCurrency} name="currency">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">Indian Rupee (INR)</SelectItem>
                                        <SelectItem value="USD">US Dollar (USD)</SelectItem>
                                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                                        <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Timezone</Label>
                                <Select value={timezone} onValueChange={setTimezone} name="timezone">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                                        <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date Format</Label>
                                <Select value={dateFormat} onValueChange={setDateFormat} name="dateFormat">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                                        <SelectItem value="MM-DD-YYYY">MM-DD-YYYY</SelectItem>
                                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Financial Year Start</Label>
                                <Select value={financialYear} onValueChange={setFinancialYear} name="financialYearStart">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="April">April</SelectItem>
                                        <SelectItem value="January">January</SelectItem>
                                        <SelectItem value="March">March</SelectItem>
                                        {/* Added March/July as needed */}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- SALES SETTINGS --- */}
                <TabsContent value="sales" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Document Prefixes & Defaults</CardTitle>
                            <CardDescription>Automate your sales document generation.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                                    <Input id="invoicePrefix" name="invoicePrefix" defaultValue={settings.invoicePrefix} placeholder="INV-" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quotationPrefix">Quotation Prefix</Label>
                                    <Input id="quotationPrefix" name="quotationPrefix" defaultValue={settings.quotationPrefix} placeholder="QUO-" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="defaultTaxRate">Default GST/Tax %</Label>
                                    <Input id="defaultTaxRate" name="defaultTaxRate" type="number" defaultValue={settings.defaultTaxRate} placeholder="18" />
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <Label htmlFor="defaultInvoiceTerms">Default Invoice Terms</Label>
                                <Textarea id="defaultInvoiceTerms" name="defaultInvoiceTerms" defaultValue={settings.defaultInvoiceTerms} rows={3} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="defaultQuotationTerms">Default Quotation Terms</Label>
                                <Textarea id="defaultQuotationTerms" name="defaultQuotationTerms" defaultValue={settings.defaultQuotationTerms} rows={3} />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Sales Validation</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Prevent Negative Stock</Label>
                                    <p className="text-sm text-muted-foreground">Don't allow invoices if product stock is insufficient.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="hidden" name="enableStockValidation" value={stockValidation ? "on" : "off"} />
                                    <Switch checked={stockValidation} onCheckedChange={setStockValidation} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- INVENTORY SETTINGS --- */}
                <TabsContent value="inventory" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stock Management</CardTitle>
                            <CardDescription>Configure alerts and inventory behavior.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Low Stock Alerts</Label>
                                    <p className="text-sm text-muted-foreground">Show warnings when inventory drops below threshold.</p>
                                </div>
                                <input type="hidden" name="enableLowStockAlerts" value={lowStockAlerts ? "on" : "off"} />
                                <Switch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />
                            </div>
                            {lowStockAlerts && (
                                <div className="space-y-2 max-w-xs">
                                    <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                                    <Input id="lowStockThreshold" name="lowStockThreshold" type="number" defaultValue={settings.lowStockThreshold} />
                                    <p className="text-xs text-muted-foreground">Minimum quantity before flagging.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- HR SETTINGS --- */}
                <TabsContent value="hr" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Work & Payroll Defaults</CardTitle>
                            <CardDescription>Define standard working parameters for employees.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="standardWorkingDays">Working Days per Week</Label>
                                <Input id="standardWorkingDays" name="standardWorkingDays" type="number" defaultValue={settings.standardWorkingDays} max={7} min={1} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dailyWorkingHours">Working Hours per Day</Label>
                                <Input id="dailyWorkingHours" name="dailyWorkingHours" type="number" defaultValue={settings.dailyWorkingHours} max={24} min={1} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- MODULES --- */}
                <TabsContent value="modules" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Feature Management</CardTitle>
                            <CardDescription>Enable or disable specific CRM modules.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            {[
                                { key: 'proforma', label: 'Proforma Invoices', desc: 'Enable creating draft invoices before main tax invoice.' },
                                { key: 'challans', label: 'Delivery Challans', desc: 'Enable delivery notes for goods movement.' },
                                { key: 'estimates', label: 'Estimates / Quotations', desc: 'Enable sales quotations workflow.' },
                                { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Send SMS alerts for invoices and payments.' },
                                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Send automatic email PDFs.' },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between p-3 border rounded-md">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">{item.label}</Label>
                                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <input type="hidden" name={`module_${item.key}`} value={modules[item.key as keyof typeof modules] ? "on" : "off"} />
                                    <Switch
                                        checked={modules[item.key as keyof typeof modules]}
                                        onCheckedChange={(checked) => setModules(prev => ({ ...prev, [item.key]: checked }))}
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <div className="mt-6 flex justify-end">
                    <SubmitButton />
                </div>
            </Tabs>
        </form>
    );
}
