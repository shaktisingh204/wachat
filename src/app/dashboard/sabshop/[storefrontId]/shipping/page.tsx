'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';

import {
    Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardFooter,
    Input, Label, Badge, useZoruToast, Switch,
    Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue,
    Separator, Breadcrumb, ZoruBreadcrumbList, ZoruBreadcrumbItem, ZoruBreadcrumbLink, ZoruBreadcrumbSeparator, ZoruBreadcrumbPage
} from '@/components/zoruui';
import { Plus, Trash2, Globe, Truck, MapPin, Search, PlusCircle, ArrowLeft, MoreHorizontal } from 'lucide-react';

import {
    listShippingZones, upsertShippingZone, deleteShippingZone,
} from '@/app/actions/sabshop.actions';

interface Rate { name: string; kind: 'flat' | 'per_kg' | 'free'; flatPrice?: number; perKg?: number; minTotal?: number }
interface Zone {
    _id?: string;
    name: string;
    regions: string[];
    rates: Rate[];
    active?: boolean;
}

export default function ShippingPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const router = useRouter();
    const { toast } = useZoruToast();
    const id = params.storefrontId;
    
    const [zones, setZones] = React.useState<Zone[]>([]);
    const [draft, setDraft] = React.useState<Zone>({ name: '', regions: [], rates: [{ name: 'Standard', kind: 'flat', flatPrice: 50 }], active: true });
    const [regionInput, setRegionInput] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);

    const load = React.useCallback(async () => {
        const r = await listShippingZones(id);
        if (r.ok) setZones(r.items as Zone[]);
    }, [id]);

    React.useEffect(() => { load(); }, [load]);

    async function onCreate() {
        if (!draft.name.trim()) {
            toast({ title: 'Name required', description: 'Please provide a name for the shipping zone.', variant: 'destructive' });
            return;
        }
        
        const r = await upsertShippingZone({ storefrontId: id, ...draft });
        if (!r.ok) { toast({ title: 'Error', description: r.error, variant: 'destructive' }); return; }
        
        toast({ title: 'Zone created', description: 'Shipping zone has been saved successfully.' });
        setDraft({ name: '', regions: [], rates: [{ name: 'Standard', kind: 'flat', flatPrice: 50 }], active: true });
        setIsCreating(false);
        load();
    }

    async function onDelete(zid: string) {
        if (!confirm('Are you sure you want to delete this shipping zone?')) return;
        const r = await deleteShippingZone(zid);
        if (r.ok) {
            toast({ title: 'Zone deleted', description: 'Shipping zone was removed.' });
            load();
        }
    }

    function addRegion(e?: React.FormEvent) {
        if (e) e.preventDefault();
        const v = regionInput.trim().toUpperCase();
        if (!v) return;
        setDraft((d) => ({ ...d, regions: Array.from(new Set([...d.regions, v])) }));
        setRegionInput('');
    }
    
    function removeRegion(region: string) {
        setDraft((d) => ({ ...d, regions: d.regions.filter(r => r !== region) }));
    }

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
                            <ZoruBreadcrumbPage>Shipping</ZoruBreadcrumbPage>
                        </ZoruBreadcrumbItem>
                    </ZoruBreadcrumbList>
                </Breadcrumb>
                
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zoru-ink">Shipping & Delivery</h1>
                        <p className="text-zoru-ink-muted mt-1">Manage where you ship and how much you charge at checkout.</p>
                    </div>
                    {!isCreating && (
                        <Button onClick={() => setIsCreating(true)} className="gap-2">
                            <Plus className="h-4 w-4" /> Create zone
                        </Button>
                    )}
                </div>
            </div>

            {isCreating ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="lg:col-span-2 space-y-6">
                        <Button variant="ghost" onClick={() => setIsCreating(false)} className="gap-2 -ml-4 mb-2 text-zoru-ink-muted">
                            <ArrowLeft className="h-4 w-4" /> Back to zones
                        </Button>
                        
                        <Card>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Zone Details</ZoruCardTitle>
                                <ZoruCardDescription>Customers in these regions will see this zone's shipping rates at checkout.</ZoruCardDescription>
                            </ZoruCardHeader>
                            <ZoruCardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Zone Name</Label>
                                    <Input 
                                        placeholder="e.g. Domestic, Europe, Rest of World" 
                                        value={draft.name} 
                                        onChange={(e) => setDraft({ ...draft, name: e.target.value })} 
                                    />
                                </div>
                                
                                <div className="space-y-3">
                                    <Label>Regions</Label>
                                    <form onSubmit={addRegion} className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
                                            <Input 
                                                className="pl-9"
                                                value={regionInput} 
                                                placeholder="Search by country or region code (e.g. US, IN, EU)" 
                                                onChange={(e) => setRegionInput(e.target.value)} 
                                            />
                                        </div>
                                        <Button type="button" variant="secondary" onClick={addRegion}>Add</Button>
                                    </form>
                                    
                                    {draft.regions.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {draft.regions.map((r) => (
                                                <Badge key={r} variant="secondary" className="pl-2 pr-1 py-1 gap-1 flex items-center">
                                                    <MapPin className="h-3 w-3 text-zoru-brand" />
                                                    {r}
                                                    <button 
                                                        onClick={() => removeRegion(r)}
                                                        className="ml-1 rounded-full p-0.5 hover:bg-zoru-background-hover transition-colors"
                                                    >
                                                        <Trash2 className="h-3 w-3 text-zoru-ink-muted hover:text-red-500" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="border border-dashed border-zoru-border rounded-lg p-6 text-center">
                                            <Globe className="h-8 w-8 mx-auto text-zoru-ink-muted mb-2 opacity-50" />
                                            <p className="text-sm text-zoru-ink-muted">No regions added yet.</p>
                                        </div>
                                    )}
                                </div>
                            </ZoruCardContent>
                        </Card>

                        <Card>
                            <ZoruCardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <ZoruCardTitle>Shipping Rates</ZoruCardTitle>
                                    <ZoruCardDescription>Set up the rates for customers in this zone.</ZoruCardDescription>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setDraft({ ...draft, rates: [...draft.rates, { name: '', kind: 'flat', flatPrice: 0 }] })}
                                    className="gap-1.5"
                                >
                                    <PlusCircle className="h-4 w-4" /> Add rate
                                </Button>
                            </ZoruCardHeader>
                            <ZoruCardContent className="space-y-4">
                                {draft.rates.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-zoru-ink-muted border border-dashed border-zoru-border rounded-lg">
                                        No rates defined. Add a rate to allow checkout.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {draft.rates.map((rate, idx) => (
                                            <div key={idx} className="p-4 border border-zoru-border rounded-xl bg-zoru-background-hover/30 space-y-4 relative group">
                                                <button 
                                                    onClick={() => {
                                                        const next = [...draft.rates];
                                                        next.splice(idx, 1);
                                                        setDraft({ ...draft, rates: next });
                                                    }}
                                                    className="absolute top-4 right-4 text-zoru-ink-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Rate Name</Label>
                                                        <Input
                                                            value={rate.name}
                                                            placeholder="e.g. Standard, Express"
                                                            onChange={(e) => {
                                                                const next = [...draft.rates];
                                                                next[idx] = { ...rate, name: e.target.value };
                                                                setDraft({ ...draft, rates: next });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Pricing Strategy</Label>
                                                        <Select
                                                            value={rate.kind}
                                                            onValueChange={(v) => {
                                                                const next = [...draft.rates];
                                                                next[idx] = { ...rate, kind: v as Rate['kind'] };
                                                                setDraft({ ...draft, rates: next });
                                                            }}
                                                        >
                                                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                                            <ZoruSelectContent>
                                                                <ZoruSelectItem value="flat">Flat Rate</ZoruSelectItem>
                                                                <ZoruSelectItem value="per_kg">Weight Based (Per kg)</ZoruSelectItem>
                                                                <ZoruSelectItem value="free">Free Shipping</ZoruSelectItem>
                                                            </ZoruSelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                
                                                {rate.kind !== 'free' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zoru-border border-dashed">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Price ({rate.kind === 'per_kg' ? 'per kg' : 'flat'})</Label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zoru-ink-muted">₹</span>
                                                                <Input
                                                                    className="pl-7"
                                                                    type="number"
                                                                    placeholder="0.00"
                                                                    value={rate.kind === 'per_kg' ? rate.perKg ?? '' : rate.flatPrice ?? ''}
                                                                    onChange={(e) => {
                                                                        const next = [...draft.rates];
                                                                        const val = Number(e.target.value);
                                                                        next[idx] = rate.kind === 'per_kg' ? { ...rate, perKg: val } : { ...rate, flatPrice: val };
                                                                        setDraft({ ...draft, rates: next });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Free shipping over (Optional)</Label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zoru-ink-muted">₹</span>
                                                                <Input
                                                                    className="pl-7"
                                                                    type="number"
                                                                    placeholder="e.g. 500"
                                                                    value={rate.minTotal ?? ''}
                                                                    onChange={(e) => {
                                                                        const next = [...draft.rates];
                                                                        next[idx] = { ...rate, minTotal: Number(e.target.value) };
                                                                        setDraft({ ...draft, rates: next });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ZoruCardContent>
                        </Card>
                        
                        <div className="flex justify-end gap-3 pb-8">
                            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                            <Button onClick={onCreate}>Save Zone</Button>
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
                                    <Label className="cursor-pointer" htmlFor="zone-active">Active</Label>
                                    <Switch 
                                        id="zone-active" 
                                        checked={draft.active} 
                                        onCheckedChange={(c) => setDraft({ ...draft, active: c })} 
                                    />
                                </div>
                                <p className="text-xs text-zoru-ink-muted mt-2">
                                    {draft.active ? 'This zone is currently active and rates will apply at checkout.' : 'This zone is disabled. Rates will not appear.'}
                                </p>
                            </ZoruCardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-zoru-background-hover/50 border-b border-zoru-border text-xs uppercase text-zoru-ink-muted">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Zone Name</th>
                                        <th className="px-6 py-4 font-medium">Regions</th>
                                        <th className="px-6 py-4 font-medium">Rates</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 text-right font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zoru-border">
                                    {zones.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-zoru-ink-muted">
                                                <Truck className="h-10 w-10 mx-auto text-zoru-border mb-3" />
                                                <p className="font-medium text-zoru-ink mb-1">No shipping zones</p>
                                                <p className="text-sm">Create a shipping zone to start charging for delivery.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        zones.map((z) => (
                                            <tr key={z._id} className="hover:bg-zoru-background-hover/30 transition-colors group">
                                                <td className="px-6 py-4 font-medium text-zoru-ink">
                                                    {z.name}
                                                </td>
                                                <td className="px-6 py-4 max-w-[200px] truncate">
                                                    <span className="text-zoru-ink-muted" title={z.regions.join(', ')}>
                                                        {z.regions.length > 0 ? z.regions.join(', ') : 'No regions'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="secondary" className="font-normal">{z.rates.length} rate(s)</Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={z.active ? 'success' : 'default'} className={!z.active ? 'bg-zoru-ink-muted text-white' : ''}>
                                                        {z.active ? 'Active' : 'Draft'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                        onClick={() => z._id && onDelete(z._id)}
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
