'use client';

import { Button, Input, Label, Textarea, Switch, Separator } from '@/components/zoruui';
import { useActionState, useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { LoaderCircle, Save, Building, FileText, Package, Users, Bell, Layers, CheckCircle } from 'lucide-react';
import { saveCrmSettings } from '@/app/actions/crm-settings.actions';
import { useToast } from '@/hooks/use-toast';
import { CrmSettings, WithId } from '@/lib/definitions';
import { ClayCard } from '@/components/clay';

const initialState: { message?: string; error?: string } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending: isPending } = useStatus();
    return (
        <ZoruButton
            type="submit"
            variant="obsidian"
            disabled={isPending}
            leading={isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Save Settings
        </ZoruButton>
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
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-border">
                            <h3 className="text-foreground font-semibold">Organization Profile</h3>
                            <p className="text-sm text-muted-foreground">Details that will appear on your documents (Invoices, POs).</p>
                        </div>
                        <div className="p-5 grid gap-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="companyName" className="text-foreground">Company Name</ZoruLabel>
                                    <ZoruInput id="companyName" name="companyName" defaultValue={settings.companyName} placeholder="Acme Corp" required />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="companyPhone" className="text-foreground">Phone</ZoruLabel>
                                    <ZoruInput id="companyPhone" name="companyPhone" defaultValue={settings.companyPhone} placeholder="+91 99999 99999" />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="companyEmail" className="text-foreground">Email</ZoruLabel>
                                    <ZoruInput id="companyEmail" name="companyEmail" defaultValue={settings.companyEmail} placeholder="info@acme.com" type="email" />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="gstin" className="text-foreground">GSTIN / Tax ID</ZoruLabel>
                                    <ZoruInput id="gstin" name="gstin" defaultValue={settings.gstin} placeholder="GSTIN Number" />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <ZoruLabel htmlFor="companyAddress" className="text-foreground">Address</ZoruLabel>
                                    <ZoruTextarea id="companyAddress" name="companyAddress" defaultValue={settings.companyAddress} placeholder="Full business address" />
                                </div>
                            </div>
                        </div>
                    </ClayCard>

                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-border">
                            <h3 className="text-foreground font-semibold">Regional Settings</h3>
                            <p className="text-sm text-muted-foreground">Localization settings for your CRM.</p>
                        </div>
                        <div className="p-5 grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <ZoruLabel className="text-foreground">Currency</ZoruLabel>
                                <EntityFormField
                                    entity="currency"
                                    name="currency"
                                    initialId={currency}
                                    onChange={(id) => setCurrency(id ?? '')}
                                    allowCreate
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel className="text-foreground">Timezone</ZoruLabel>
                                <EnumFormField
                                    name="timezone"
                                    enumName="timezonePreset"
                                    initialId={timezone}
                                    onChange={(id) => setTimezone(id ?? '')}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel className="text-foreground">Date Format</ZoruLabel>
                                <EnumFormField
                                    name="dateFormat"
                                    enumName="momentFormat"
                                    initialId={dateFormat}
                                    onChange={(id) => setDateFormat(id ?? '')}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel className="text-foreground">Financial Year Start</ZoruLabel>
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
                    </ClayCard>
                </TabsContent>

                {/* --- SALES SETTINGS --- */}
                <TabsContent value="sales" className="mt-6 space-y-6">
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-border">
                            <h3 className="text-foreground font-semibold">Document Prefixes & Defaults</h3>
                            <p className="text-sm text-muted-foreground">Automate your sales document generation.</p>
                        </div>
                        <div className="p-5 grid gap-6">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="invoicePrefix" className="text-foreground">Invoice Prefix</ZoruLabel>
                                    <ZoruInput id="invoicePrefix" name="invoicePrefix" defaultValue={settings.invoicePrefix} placeholder="INV-" />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="quotationPrefix" className="text-foreground">Quotation Prefix</ZoruLabel>
                                    <ZoruInput id="quotationPrefix" name="quotationPrefix" defaultValue={settings.quotationPrefix} placeholder="QUO-" />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="defaultTaxRate" className="text-foreground">Default GST/Tax %</ZoruLabel>
                                    <ZoruInput id="defaultTaxRate" name="defaultTaxRate" type="number" defaultValue={settings.defaultTaxRate} placeholder="18" />
                                </div>
                            </div>
                            <ZoruSeparator className="border-border" />
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="defaultInvoiceTerms" className="text-foreground">Default Invoice Terms</ZoruLabel>
                                <ZoruTextarea id="defaultInvoiceTerms" name="defaultInvoiceTerms" defaultValue={settings.defaultInvoiceTerms} rows={3} />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="defaultQuotationTerms" className="text-foreground">Default Quotation Terms</ZoruLabel>
                                <ZoruTextarea id="defaultQuotationTerms" name="defaultQuotationTerms" defaultValue={settings.defaultQuotationTerms} rows={3} />
                            </div>
                        </div>
                    </ClayCard>
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-border">
                            <h3 className="text-foreground font-semibold">Sales Validation</h3>
                        </div>
                        <div className="p-5">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <ZoruLabel className="text-base text-foreground">Prevent Negative Stock</ZoruLabel>
                                    <p className="text-sm text-muted-foreground">Don't allow invoices if product stock is insufficient.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="hidden" name="enableStockValidation" value={stockValidation ? "on" : "off"} />
                                    <ZoruSwitch checked={stockValidation} onCheckedChange={setStockValidation} />
                                </div>
                            </div>
                        </div>
                    </ClayCard>
                </TabsContent>

                {/* --- INVENTORY SETTINGS --- */}
                <TabsContent value="inventory" className="mt-6 space-y-6">
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-border">
                            <h3 className="text-foreground font-semibold">Stock Management</h3>
                            <p className="text-sm text-muted-foreground">Configure alerts and inventory behavior.</p>
                        </div>
                        <div className="p-5 grid gap-6">
                            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                                <div className="space-y-0.5">
                                    <ZoruLabel className="text-base text-foreground">Low Stock Alerts</ZoruLabel>
                                    <p className="text-sm text-muted-foreground">Show warnings when inventory drops below threshold.</p>
                                </div>
                                <input type="hidden" name="enableLowStockAlerts" value={lowStockAlerts ? "on" : "off"} />
                                <ZoruSwitch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />
                            </div>
                            {lowStockAlerts && (
                                <div className="space-y-2 max-w-xs">
                                    <ZoruLabel htmlFor="lowStockThreshold" className="text-foreground">Low Stock Threshold</ZoruLabel>
                                    <ZoruInput id="lowStockThreshold" name="lowStockThreshold" type="number" defaultValue={settings.lowStockThreshold} />
                                    <p className="text-xs text-muted-foreground">Minimum quantity before flagging.</p>
                                </div>
                            )}
                        </div>
                    </ClayCard>
                </TabsContent>

                {/* --- HR SETTINGS --- */}
                <TabsContent value="hr" className="mt-6 space-y-6">
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-border">
                            <h3 className="text-foreground font-semibold">Work & Payroll Defaults</h3>
                            <p className="text-sm text-muted-foreground">Define standard working parameters for employees.</p>
                        </div>
                        <div className="p-5 grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="standardWorkingDays" className="text-foreground">Working Days per Week</ZoruLabel>
                                <ZoruInput id="standardWorkingDays" name="standardWorkingDays" type="number" defaultValue={settings.standardWorkingDays} max={7} min={1} />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="dailyWorkingHours" className="text-foreground">Working Hours per Day</ZoruLabel>
                                <ZoruInput id="dailyWorkingHours" name="dailyWorkingHours" type="number" defaultValue={settings.dailyWorkingHours} max={24} min={1} />
                            </div>
                        </div>
                    </ClayCard>
                </TabsContent>

                {/* --- MODULES --- */}
                <TabsContent value="modules" className="mt-6 space-y-6">
                    <ClayCard padded={false}>
                        <div className="p-5 border-b border-border">
                            <h3 className="text-foreground font-semibold">Feature Management</h3>
                            <p className="text-sm text-muted-foreground">Enable or disable specific CRM modules.</p>
                        </div>
                        <div className="p-5 grid gap-4">
                            {[
                                { key: 'proforma', label: 'Proforma Invoices', desc: 'Enable creating draft invoices before main tax invoice.' },
                                { key: 'challans', label: 'Delivery Challans', desc: 'Enable delivery notes for goods movement.' },
                                { key: 'estimates', label: 'Estimates / Quotations', desc: 'Enable sales quotations workflow.' },
                                { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Send SMS alerts for invoices and payments.' },
                                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Send automatic email PDFs.' },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between p-3 border border-border rounded-lg">
                                    <div className="space-y-0.5">
                                        <ZoruLabel className="text-base text-foreground">{item.label}</ZoruLabel>
                                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <input type="hidden" name={`module_${item.key}`} value={modules[item.key as keyof typeof modules] ? "on" : "off"} />
                                    <ZoruSwitch
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
