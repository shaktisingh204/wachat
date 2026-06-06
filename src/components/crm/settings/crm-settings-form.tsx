'use client';

import { Button, Input, Label, Textarea, Switch, Separator, Tabs, TabsContent, TabsList, TabsTrigger, Card } from '@/components/sabcrm/20ui';
import { useActionState, useState, useEffect } from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { LoaderCircle, Save, Building, FileText, Package, Users, Bell, Layers, CheckCircle } from 'lucide-react';
import { saveCrmSettings } from '@/app/actions/crm-settings.actions';
import { useToast } from '@/hooks/use-toast';
import { CrmSettings, WithId } from '@/lib/definitions';

const initialState: { message?: string; error?: string } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending: isPending } = useStatus();
    return (
        <Button
            type="submit"
            variant="obsidian"
            disabled={isPending}
            leading={isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Save Settings
        </Button>
    );
}
// Workaround for useFormStatus not being available directly in the same component tree sometimes or simpler isolation
import { useFormStatus as useStatus } from 'react-dom';

export function CrmSettingsForm({ settings }: { settings: WithId<CrmSettings> }) {
    const [state, formAction] = useActionState(saveCrmSettings, initialState);
    const { toast } = useToast();

    // Controlled states for ZoruSelect/ZoruSwitch inputs to ensure sync with hidden inputs
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
                    <Card className="p-0">
                        <div className="p-5 border-b border-[var(--st-border)]">
                            <h3 className="text-[var(--st-text)] font-semibold">Organization Profile</h3>
                            <p className="text-sm text-[var(--st-text-secondary)]">Details that will appear on your documents (Invoices, POs).</p>
                        </div>
                        <div className="p-5 grid gap-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="companyName" className="text-[var(--st-text)]">Company Name</Label>
                                    <Input id="companyName" name="companyName" defaultValue={settings.companyName} placeholder="Acme Corp" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyPhone" className="text-[var(--st-text)]">Phone</Label>
                                    <Input id="companyPhone" name="companyPhone" defaultValue={settings.companyPhone} placeholder="+91 99999 99999" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyEmail" className="text-[var(--st-text)]">Email</Label>
                                    <Input id="companyEmail" name="companyEmail" defaultValue={settings.companyEmail} placeholder="info@acme.com" type="email" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gstin" className="text-[var(--st-text)]">GSTIN / Tax ID</Label>
                                    <Input id="gstin" name="gstin" defaultValue={settings.gstin} placeholder="GSTIN Number" />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="companyAddress" className="text-[var(--st-text)]">Address</Label>
                                    <Textarea id="companyAddress" name="companyAddress" defaultValue={settings.companyAddress} placeholder="Full business address" />
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-0">
                        <div className="p-5 border-b border-[var(--st-border)]">
                            <h3 className="text-[var(--st-text)] font-semibold">Regional Settings</h3>
                            <p className="text-sm text-[var(--st-text-secondary)]">Localization settings for your CRM.</p>
                        </div>
                        <div className="p-5 grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-[var(--st-text)]">Currency</Label>
                                <EntityFormField
                                    entity="currency"
                                    name="currency"
                                    initialId={currency}
                                    onChange={(id) => setCurrency(id ?? '')}
                                    allowCreate
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[var(--st-text)]">Timezone</Label>
                                <EnumFormField
                                    name="timezone"
                                    enumName="timezonePreset"
                                    initialId={timezone}
                                    onChange={(id) => setTimezone(id ?? '')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[var(--st-text)]">Date Format</Label>
                                <EnumFormField
                                    name="dateFormat"
                                    enumName="momentFormat"
                                    initialId={dateFormat}
                                    onChange={(id) => setDateFormat(id ?? '')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[var(--st-text)]">Financial Year Start</Label>
                                {/* This form uses month names (April/January/March) rather than the canonical
                                    'apr'/'jan'/'mar' ids — preserved as-is via inline-create. */}
                                <EnumFormField
                                    name="financialYearStart"
                                    enumName="fiscalYearStart"
                                    initialId={financialYear}
                                    onChange={(id) => setFinancialYear(id ?? '')}
                                />
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                {/* --- SALES SETTINGS --- */}
                <TabsContent value="sales" className="mt-6 space-y-6">
                    <Card className="p-0">
                        <div className="p-5 border-b border-[var(--st-border)]">
                            <h3 className="text-[var(--st-text)] font-semibold">Document Prefixes & Defaults</h3>
                            <p className="text-sm text-[var(--st-text-secondary)]">Automate your sales document generation.</p>
                        </div>
                        <div className="p-5 grid gap-6">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="invoicePrefix" className="text-[var(--st-text)]">Invoice Prefix</Label>
                                    <Input id="invoicePrefix" name="invoicePrefix" defaultValue={settings.invoicePrefix} placeholder="INV-" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quotationPrefix" className="text-[var(--st-text)]">Quotation Prefix</Label>
                                    <Input id="quotationPrefix" name="quotationPrefix" defaultValue={settings.quotationPrefix} placeholder="QUO-" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="defaultTaxRate" className="text-[var(--st-text)]">Default GST/Tax %</Label>
                                    <Input id="defaultTaxRate" name="defaultTaxRate" type="number" defaultValue={settings.defaultTaxRate} placeholder="18" />
                                </div>
                            </div>
                            <Separator className="border-[var(--st-border)]" />
                            <div className="space-y-2">
                                <Label htmlFor="defaultInvoiceTerms" className="text-[var(--st-text)]">Default Invoice Terms</Label>
                                <Textarea id="defaultInvoiceTerms" name="defaultInvoiceTerms" defaultValue={settings.defaultInvoiceTerms} rows={3} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="defaultQuotationTerms" className="text-[var(--st-text)]">Default Quotation Terms</Label>
                                <Textarea id="defaultQuotationTerms" name="defaultQuotationTerms" defaultValue={settings.defaultQuotationTerms} rows={3} />
                            </div>
                        </div>
                    </Card>
                    <Card className="p-0">
                        <div className="p-5 border-b border-[var(--st-border)]">
                            <h3 className="text-[var(--st-text)] font-semibold">Sales Validation</h3>
                        </div>
                        <div className="p-5">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-[var(--st-text)]">Prevent Negative Stock</Label>
                                    <p className="text-sm text-[var(--st-text-secondary)]">Don't allow invoices if product stock is insufficient.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="hidden" name="enableStockValidation" value={stockValidation ? "on" : "off"} />
                                    <Switch checked={stockValidation} onCheckedChange={setStockValidation} />
                                </div>
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                {/* --- INVENTORY SETTINGS --- */}
                <TabsContent value="inventory" className="mt-6 space-y-6">
                    <Card className="p-0">
                        <div className="p-5 border-b border-[var(--st-border)]">
                            <h3 className="text-[var(--st-text)] font-semibold">Stock Management</h3>
                            <p className="text-sm text-[var(--st-text-secondary)]">Configure alerts and inventory behavior.</p>
                        </div>
                        <div className="p-5 grid gap-6">
                            <div className="flex items-center justify-between p-4 border border-[var(--st-border)] rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-[var(--st-text)]">Low Stock Alerts</Label>
                                    <p className="text-sm text-[var(--st-text-secondary)]">Show warnings when inventory drops below threshold.</p>
                                </div>
                                <input type="hidden" name="enableLowStockAlerts" value={lowStockAlerts ? "on" : "off"} />
                                <Switch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />
                            </div>
                            {lowStockAlerts && (
                                <div className="space-y-2 max-w-xs">
                                    <Label htmlFor="lowStockThreshold" className="text-[var(--st-text)]">Low Stock Threshold</Label>
                                    <Input id="lowStockThreshold" name="lowStockThreshold" type="number" defaultValue={settings.lowStockThreshold} />
                                    <p className="text-xs text-[var(--st-text-secondary)]">Minimum quantity before flagging.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>

                {/* --- HR SETTINGS --- */}
                <TabsContent value="hr" className="mt-6 space-y-6">
                    <Card className="p-0">
                        <div className="p-5 border-b border-[var(--st-border)]">
                            <h3 className="text-[var(--st-text)] font-semibold">Work & Payroll Defaults</h3>
                            <p className="text-sm text-[var(--st-text-secondary)]">Define standard working parameters for employees.</p>
                        </div>
                        <div className="p-5 grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="standardWorkingDays" className="text-[var(--st-text)]">Working Days per Week</Label>
                                <Input id="standardWorkingDays" name="standardWorkingDays" type="number" defaultValue={settings.standardWorkingDays} max={7} min={1} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dailyWorkingHours" className="text-[var(--st-text)]">Working Hours per Day</Label>
                                <Input id="dailyWorkingHours" name="dailyWorkingHours" type="number" defaultValue={settings.dailyWorkingHours} max={24} min={1} />
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                {/* --- MODULES --- */}
                <TabsContent value="modules" className="mt-6 space-y-6">
                    <Card className="p-0">
                        <div className="p-5 border-b border-[var(--st-border)]">
                            <h3 className="text-[var(--st-text)] font-semibold">Feature Management</h3>
                            <p className="text-sm text-[var(--st-text-secondary)]">Enable or disable specific CRM modules.</p>
                        </div>
                        <div className="p-5 grid gap-4">
                            {[
                                { key: 'proforma', label: 'Proforma Invoices', desc: 'Enable creating draft invoices before main tax invoice.' },
                                { key: 'challans', label: 'Delivery Challans', desc: 'Enable delivery notes for goods movement.' },
                                { key: 'estimates', label: 'Estimates / Quotations', desc: 'Enable sales quotations workflow.' },
                                { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Send SMS alerts for invoices and payments.' },
                                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Send automatic email PDFs.' },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between p-3 border border-[var(--st-border)] rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label className="text-base text-[var(--st-text)]">{item.label}</Label>
                                        <p className="text-sm text-[var(--st-text-secondary)]">{item.desc}</p>
                                    </div>
                                    <input type="hidden" name={`module_${item.key}`} value={modules[item.key as keyof typeof modules] ? "on" : "off"} />
                                    <Switch
                                        checked={modules[item.key as keyof typeof modules]}
                                        onCheckedChange={(checked) => setModules(prev => ({ ...prev, [item.key]: checked }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </Card>
                </TabsContent>

                <div className="mt-6 flex justify-end">
                    <SubmitButton />
                </div>
            </Tabs>
        </form>
    );
}
