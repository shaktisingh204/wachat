'use client';

import { useActionState, useState, useEffect } from 'react';
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
import { ClayCard, ClayButton } from '@/components/clay';

const initialState: { message?: string; error?: string } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending: isPending } = useStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={isPending}
            leading={isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Save Settings
        </ClayButton>
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
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-clay-border">
                            <h3 className="text-clay-ink font-semibold">Organization Profile</h3>
                            <p className="text-sm text-clay-ink-muted">Details that will appear on your documents (Invoices, POs).</p>
                        </div>
                        <div className="p-5 grid gap-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="companyName" className="text-clay-ink">Company Name</Label>
                                    <Input id="companyName" name="companyName" defaultValue={settings.companyName} placeholder="Acme Corp" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyPhone" className="text-clay-ink">Phone</Label>
                                    <Input id="companyPhone" name="companyPhone" defaultValue={settings.companyPhone} placeholder="+91 99999 99999" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyEmail" className="text-clay-ink">Email</Label>
                                    <Input id="companyEmail" name="companyEmail" defaultValue={settings.companyEmail} placeholder="info@acme.com" type="email" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gstin" className="text-clay-ink">GSTIN / Tax ID</Label>
                                    <Input id="gstin" name="gstin" defaultValue={settings.gstin} placeholder="GSTIN Number" />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="companyAddress" className="text-clay-ink">Address</Label>
                                    <Textarea id="companyAddress" name="companyAddress" defaultValue={settings.companyAddress} placeholder="Full business address" />
                                </div>
                            </div>
                        </div>
                    </ClayCard>

                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-clay-border">
                            <h3 className="text-clay-ink font-semibold">Regional Settings</h3>
                            <p className="text-sm text-clay-ink-muted">Localization settings for your CRM.</p>
                        </div>
                        <div className="p-5 grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-clay-ink">Currency</Label>
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
                                <Label className="text-clay-ink">Timezone</Label>
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
                                <Label className="text-clay-ink">Date Format</Label>
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
                                <Label className="text-clay-ink">Financial Year Start</Label>
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
                        </div>
                    </ClayCard>
                </TabsContent>

                {/* --- SALES SETTINGS --- */}
                <TabsContent value="sales" className="mt-6 space-y-6">
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-clay-border">
                            <h3 className="text-clay-ink font-semibold">Document Prefixes & Defaults</h3>
                            <p className="text-sm text-clay-ink-muted">Automate your sales document generation.</p>
                        </div>
                        <div className="p-5 grid gap-6">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="invoicePrefix" className="text-clay-ink">Invoice Prefix</Label>
                                    <Input id="invoicePrefix" name="invoicePrefix" defaultValue={settings.invoicePrefix} placeholder="INV-" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quotationPrefix" className="text-clay-ink">Quotation Prefix</Label>
                                    <Input id="quotationPrefix" name="quotationPrefix" defaultValue={settings.quotationPrefix} placeholder="QUO-" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="defaultTaxRate" className="text-clay-ink">Default GST/Tax %</Label>
                                    <Input id="defaultTaxRate" name="defaultTaxRate" type="number" defaultValue={settings.defaultTaxRate} placeholder="18" />
                                </div>
                            </div>
                            <Separator className="border-clay-border" />
                            <div className="space-y-2">
                                <Label htmlFor="defaultInvoiceTerms" className="text-clay-ink">Default Invoice Terms</Label>
                                <Textarea id="defaultInvoiceTerms" name="defaultInvoiceTerms" defaultValue={settings.defaultInvoiceTerms} rows={3} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="defaultQuotationTerms" className="text-clay-ink">Default Quotation Terms</Label>
                                <Textarea id="defaultQuotationTerms" name="defaultQuotationTerms" defaultValue={settings.defaultQuotationTerms} rows={3} />
                            </div>
                        </div>
                    </ClayCard>
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-clay-border">
                            <h3 className="text-clay-ink font-semibold">Sales Validation</h3>
                        </div>
                        <div className="p-5">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-clay-ink">Prevent Negative Stock</Label>
                                    <p className="text-sm text-clay-ink-muted">Don't allow invoices if product stock is insufficient.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="hidden" name="enableStockValidation" value={stockValidation ? "on" : "off"} />
                                    <Switch checked={stockValidation} onCheckedChange={setStockValidation} />
                                </div>
                            </div>
                        </div>
                    </ClayCard>
                </TabsContent>

                {/* --- INVENTORY SETTINGS --- */}
                <TabsContent value="inventory" className="mt-6 space-y-6">
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-clay-border">
                            <h3 className="text-clay-ink font-semibold">Stock Management</h3>
                            <p className="text-sm text-clay-ink-muted">Configure alerts and inventory behavior.</p>
                        </div>
                        <div className="p-5 grid gap-6">
                            <div className="flex items-center justify-between p-4 border border-clay-border rounded-clay-md">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-clay-ink">Low Stock Alerts</Label>
                                    <p className="text-sm text-clay-ink-muted">Show warnings when inventory drops below threshold.</p>
                                </div>
                                <input type="hidden" name="enableLowStockAlerts" value={lowStockAlerts ? "on" : "off"} />
                                <Switch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />
                            </div>
                            {lowStockAlerts && (
                                <div className="space-y-2 max-w-xs">
                                    <Label htmlFor="lowStockThreshold" className="text-clay-ink">Low Stock Threshold</Label>
                                    <Input id="lowStockThreshold" name="lowStockThreshold" type="number" defaultValue={settings.lowStockThreshold} />
                                    <p className="text-xs text-clay-ink-muted">Minimum quantity before flagging.</p>
                                </div>
                            )}
                        </div>
                    </ClayCard>
                </TabsContent>

                {/* --- HR SETTINGS --- */}
                <TabsContent value="hr" className="mt-6 space-y-6">
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-clay-border">
                            <h3 className="text-clay-ink font-semibold">Work & Payroll Defaults</h3>
                            <p className="text-sm text-clay-ink-muted">Define standard working parameters for employees.</p>
                        </div>
                        <div className="p-5 grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="standardWorkingDays" className="text-clay-ink">Working Days per Week</Label>
                                <Input id="standardWorkingDays" name="standardWorkingDays" type="number" defaultValue={settings.standardWorkingDays} max={7} min={1} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dailyWorkingHours" className="text-clay-ink">Working Hours per Day</Label>
                                <Input id="dailyWorkingHours" name="dailyWorkingHours" type="number" defaultValue={settings.dailyWorkingHours} max={24} min={1} />
                            </div>
                        </div>
                    </ClayCard>
                </TabsContent>

                {/* --- MODULES --- */}
                <TabsContent value="modules" className="mt-6 space-y-6">
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-clay-border">
                            <h3 className="text-clay-ink font-semibold">Feature Management</h3>
                            <p className="text-sm text-clay-ink-muted">Enable or disable specific CRM modules.</p>
                        </div>
                        <div className="p-5 grid gap-4">
                            {[
                                { key: 'proforma', label: 'Proforma Invoices', desc: 'Enable creating draft invoices before main tax invoice.' },
                                { key: 'challans', label: 'Delivery Challans', desc: 'Enable delivery notes for goods movement.' },
                                { key: 'estimates', label: 'Estimates / Quotations', desc: 'Enable sales quotations workflow.' },
                                { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Send SMS alerts for invoices and payments.' },
                                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Send automatic email PDFs.' },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between p-3 border border-clay-border rounded-clay-md">
                                    <div className="space-y-0.5">
                                        <Label className="text-base text-clay-ink">{item.label}</Label>
                                        <p className="text-sm text-clay-ink-muted">{item.desc}</p>
                                    </div>
                                    <input type="hidden" name={`module_${item.key}`} value={modules[item.key as keyof typeof modules] ? "on" : "off"} />
                                    <Switch
                                        checked={modules[item.key as keyof typeof modules]}
                                        onCheckedChange={(checked) => setModules(prev => ({ ...prev, [item.key]: checked }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </ClayCard>
                </TabsContent>

                <div className="mt-6 flex justify-end">
                    <SubmitButton />
                </div>
            </Tabs>
        </form>
    );
}
