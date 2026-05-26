'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import {
    Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle,
    Input, Label, Badge, useZoruToast,
    Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue,
} from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';

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
    const { toast } = useZoruToast();
    const id = params.storefrontId;
    const [zones, setZones] = React.useState<Zone[]>([]);
    const [draft, setDraft] = React.useState<Zone>({ name: '', regions: [], rates: [{ name: 'Standard', kind: 'flat', flatPrice: 50 }], active: true });
    const [regionInput, setRegionInput] = React.useState('');

    const load = React.useCallback(async () => {
        const r = await listShippingZones(id);
        if (r.ok) setZones(r.items as Zone[]);
    }, [id]);

    React.useEffect(() => { load(); }, [load]);

    async function onCreate() {
        if (!draft.name.trim()) return;
        const r = await upsertShippingZone({ storefrontId: id, ...draft });
        if (!r.ok) { toast({ title: r.error, variant: 'destructive' }); return; }
        setDraft({ name: '', regions: [], rates: [{ name: 'Standard', kind: 'flat', flatPrice: 50 }], active: true });
        load();
    }

    async function onDelete(zid: string) {
        if (!confirm('Delete this zone?')) return;
        const r = await deleteShippingZone(zid);
        if (r.ok) load();
    }

    function addRegion() {
        const v = regionInput.trim().toUpperCase();
        if (!v) return;
        setDraft((d) => ({ ...d, regions: Array.from(new Set([...d.regions, v])) }));
        setRegionInput('');
    }

    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <h1 className="text-2xl font-semibold text-zoru-ink">Shipping zones</h1>

            <Card className="max-w-3xl">
                <ZoruCardHeader><ZoruCardTitle>New zone</ZoruCardTitle></ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-3">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <Label>Regions (ISO country / region codes)</Label>
                        <div className="flex gap-2">
                            <Input value={regionInput} placeholder="IN, IN-MH, US-CA" onChange={(e) => setRegionInput(e.target.value)} />
                            <Button type="button" variant="outline" onClick={addRegion}>Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {draft.regions.map((r) => (
                                <Badge key={r} variant="ghost">{r}</Badge>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Rates</Label>
                        {draft.rates.map((rate, idx) => (
                            <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                                <Input
                                    value={rate.name}
                                    placeholder="Rate name"
                                    onChange={(e) => {
                                        const next = [...draft.rates];
                                        next[idx] = { ...rate, name: e.target.value };
                                        setDraft({ ...draft, rates: next });
                                    }}
                                />
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
                                        <ZoruSelectItem value="flat">Flat</ZoruSelectItem>
                                        <ZoruSelectItem value="per_kg">Per kg</ZoruSelectItem>
                                        <ZoruSelectItem value="free">Free</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </Select>
                                <Input
                                    type="number"
                                    placeholder={rate.kind === 'per_kg' ? '₹/kg' : '₹ flat'}
                                    value={rate.kind === 'per_kg' ? rate.perKg ?? '' : rate.flatPrice ?? ''}
                                    onChange={(e) => {
                                        const next = [...draft.rates];
                                        const val = Number(e.target.value);
                                        next[idx] = rate.kind === 'per_kg' ? { ...rate, perKg: val } : { ...rate, flatPrice: val };
                                        setDraft({ ...draft, rates: next });
                                    }}
                                />
                                <Input
                                    type="number"
                                    placeholder="Free over ₹"
                                    value={rate.minTotal ?? ''}
                                    onChange={(e) => {
                                        const next = [...draft.rates];
                                        next[idx] = { ...rate, minTotal: Number(e.target.value) };
                                        setDraft({ ...draft, rates: next });
                                    }}
                                />
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDraft({ ...draft, rates: [...draft.rates, { name: '', kind: 'flat', flatPrice: 0 }] })}
                        >
                            <Plus className="h-3.5 w-3.5" /> Add rate
                        </Button>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={onCreate}>Save zone</Button>
                    </div>
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader><ZoruCardTitle>All zones</ZoruCardTitle></ZoruCardHeader>
                <ZoruCardContent>
                    {zones.length === 0 ? (
                        <p className="text-sm text-zoru-ink-muted">No zones yet.</p>
                    ) : (
                        <ul className="divide-y divide-zoru-border">
                            {zones.map((z) => (
                                <li key={z._id} className="flex items-center gap-3 py-2 text-sm">
                                    <div className="flex-1">
                                        <div className="font-medium text-zoru-ink">{z.name}</div>
                                        <div className="text-xs text-zoru-ink-muted">{z.regions.join(', ')}</div>
                                    </div>
                                    <div className="text-zoru-ink-muted">{z.rates.length} rate(s)</div>
                                    <Badge variant={z.active ? 'success' : 'ghost'}>{z.active ? 'Active' : 'Off'}</Badge>
                                    <Button variant="destructive" size="sm" onClick={() => z._id && onDelete(z._id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}
