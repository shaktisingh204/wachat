'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import {
    Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription,
    Input, Label, Badge, Checkbox, useZoruToast, Switch,
    Breadcrumb, ZoruBreadcrumbList, ZoruBreadcrumbItem, ZoruBreadcrumbLink, ZoruBreadcrumbSeparator, ZoruBreadcrumbPage
} from '@/components/sabcrm/20ui/compat';
import { Plus, Trash2, Receipt, Search, ArrowLeft, Percent } from 'lucide-react';

import { listTaxRules, upsertTaxRule, deleteTaxRule } from '@/app/actions/sabshop.actions';

interface Rule {
    _id?: string;
    name: string;
    region: string;
    rate: number;
    inclusive?: boolean;
    active?: boolean;
}

export default function TaxesPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const { toast } = useZoruToast();
    const id = params.storefrontId;
    
    const [items, setItems] = React.useState<Rule[]>([]);
    const [draft, setDraft] = React.useState<Rule>({ name: '', region: '', rate: 0.18, inclusive: false, active: true });
    const [isCreating, setIsCreating] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');

    const load = React.useCallback(async () => {
        const r = await listTaxRules(id);
        if (r.ok) setItems(r.items as Rule[]);
    }, [id]);

    React.useEffect(() => { load(); }, [load]);

    async function onCreate() {
        if (!draft.name.trim() || !draft.region.trim()) {
            toast({ title: 'Missing fields', description: 'Name and Region are required.', variant: 'destructive' });
            return;
        }
        
        const r = await upsertTaxRule({ storefrontId: id, ...draft });
        if (!r.ok) { toast({ title: 'Error', description: r.error, variant: 'destructive' }); return; }
        
        toast({ title: 'Tax rule created', description: 'The tax rule has been successfully saved.' });
        setDraft({ name: '', region: '', rate: 0.18, inclusive: false, active: true });
        setIsCreating(false);
        load();
    }

    async function onDelete(rid: string) {
        if (!confirm('Are you sure you want to delete this tax rule?')) return;
        const r = await deleteTaxRule(rid);
        if (r.ok) {
            toast({ title: 'Tax rule deleted', description: 'The tax rule was removed.' });
            load();
        }
    }

    const filteredItems = items.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.region.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="zoruui flex flex-col gap-6 p-8 max-w-6xl mx-auto w-full h-full">
            <div className="flex flex-col gap-2">
                <Breadcrumb>
                    <ZoruBreadcrumbList>
                        <ZoruBreadcrumbItem>
                            <ZoruBreadcrumbLink href={`/dashboard/sabshop/${id}`}>Store</ZoruBreadcrumbLink>
                        </ZoruBreadcrumbItem>
                        <ZoruBreadcrumbSeparator />
                        <ZoruBreadcrumbItem>
                            <ZoruBreadcrumbLink href={`/dashboard/sabshop/${id}/settings`}>Settings</ZoruBreadcrumbLink>
                        </ZoruBreadcrumbItem>
                        <ZoruBreadcrumbSeparator />
                        <ZoruBreadcrumbItem>
                            <ZoruBreadcrumbPage>Taxes & Duties</ZoruBreadcrumbPage>
                        </ZoruBreadcrumbItem>
                    </ZoruBreadcrumbList>
                </Breadcrumb>
                
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-[var(--st-text)]">Taxes & Duties</h1>
                        <p className="text-[var(--st-text-secondary)] mt-1">Configure regional tax overrides and how taxes are applied to prices.</p>
                    </div>
                    {!isCreating && (
                        <Button onClick={() => setIsCreating(true)} className="gap-2">
                            <Plus className="h-4 w-4" /> Add Tax Rule
                        </Button>
                    )}
                </div>
            </div>

            {isCreating ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="lg:col-span-2 space-y-6">
                        <Button variant="ghost" onClick={() => setIsCreating(false)} className="gap-2 -ml-4 mb-2 text-[var(--st-text-secondary)]">
                            <ArrowLeft className="h-4 w-4" /> Back to tax rules
                        </Button>
                        
                        <Card>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Tax Rule Details</ZoruCardTitle>
                                <ZoruCardDescription>Specify the region and rate for this tax configuration.</ZoruCardDescription>
                            </ZoruCardHeader>
                            <ZoruCardContent className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tax Name</Label>
                                        <Input 
                                            placeholder="e.g. GST, VAT, Sales Tax" 
                                            value={draft.name} 
                                            onChange={(e) => setDraft({ ...draft, name: e.target.value })} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Region (Code)</Label>
                                        <Input 
                                            placeholder="e.g. IN, IN-MH, US, EU"
                                            value={draft.region} 
                                            onChange={(e) => setDraft({ ...draft, region: e.target.value.toUpperCase() })} 
                                        />
                                        <p className="text-[10px] text-[var(--st-text-secondary)]">Use ISO country or state codes.</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Tax Rate</Label>
                                    <div className="relative max-w-[200px]">
                                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-secondary)]" />
                                        <Input
                                            className="pl-9"
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            value={draft.rate * 100}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setDraft({ ...draft, rate: val / 100 });
                                            }}
                                        />
                                    </div>
                                </div>
                            </ZoruCardContent>
                        </Card>
                        
                        <Card>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Tax Calculation</ZoruCardTitle>
                                <ZoruCardDescription>How this tax behaves with your product prices.</ZoruCardDescription>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <label className="flex items-start gap-3 p-4 border border-[var(--st-border)] rounded-lg cursor-pointer hover:bg-[var(--st-hover)] transition-colors">
                                    <Checkbox 
                                        className="mt-1"
                                        checked={!!draft.inclusive} 
                                        onCheckedChange={(c) => setDraft({ ...draft, inclusive: c === true })} 
                                    />
                                    <div>
                                        <p className="font-medium text-[var(--st-text)] text-sm">Tax is included in product prices</p>
                                        <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                                            Customers will pay the exact price shown on your store. The tax portion is calculated from that total.
                                        </p>
                                    </div>
                                </label>
                            </ZoruCardContent>
                        </Card>

                        <div className="flex justify-end gap-3 pb-8">
                            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                            <Button onClick={onCreate}>Save Tax Rule</Button>
                        </div>
                    </div>
                    
                    {/* Sidebar / Status for Draft */}
                    <div className="space-y-6">
                        <Card>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Status</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="flex items-center justify-between">
                                    <Label className="cursor-pointer" htmlFor="tax-active">Active</Label>
                                    <Switch 
                                        id="tax-active" 
                                        checked={draft.active} 
                                        onCheckedChange={(c) => setDraft({ ...draft, active: c })} 
                                    />
                                </div>
                                <p className="text-xs text-[var(--st-text-secondary)] mt-2">
                                    {draft.active ? 'This tax rule is currently active and will be applied at checkout.' : 'This tax rule is disabled and will not apply.'}
                                </p>
                            </ZoruCardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                    {items.length > 0 && (
                        <div className="flex items-center gap-2 max-w-sm">
                            <Search className="h-4 w-4 text-[var(--st-text-secondary)] absolute ml-3" />
                            <Input 
                                placeholder="Search tax rules..." 
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    )}
                    
                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[var(--st-hover)]/50 border-b border-[var(--st-border)] text-xs uppercase text-[var(--st-text-secondary)]">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Tax Name</th>
                                        <th className="px-6 py-4 font-medium">Region</th>
                                        <th className="px-6 py-4 font-medium">Rate</th>
                                        <th className="px-6 py-4 font-medium">Calculation</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 text-right font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--st-border)]">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-[var(--st-text-secondary)]">
                                                <Receipt className="h-10 w-10 mx-auto text-[var(--st-border)] mb-3" />
                                                <p className="font-medium text-[var(--st-text)] mb-1">No tax rules</p>
                                                <p className="text-sm">Create a tax rule to start charging taxes on orders.</p>
                                            </td>
                                        </tr>
                                    ) : filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-[var(--st-text-secondary)]">
                                                No tax rules match your search.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((r) => (
                                            <tr key={r._id} className="hover:bg-[var(--st-hover)]/30 transition-colors group">
                                                <td className="px-6 py-4 font-medium text-[var(--st-text)]">
                                                    {r.name}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="font-mono">{r.region}</Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {(r.rate * 100).toFixed(1)}%
                                                </td>
                                                <td className="px-6 py-4 text-[var(--st-text-secondary)]">
                                                    {r.inclusive ? 'Included in price' : 'Added at checkout'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={r.active ? 'success' : 'default'} className={!r.active ? 'bg-[var(--st-text-secondary)] text-white' : ''}>
                                                        {r.active ? 'Active' : 'Disabled'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                        onClick={() => r._id && onDelete(r._id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
