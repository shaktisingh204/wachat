'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import {
    Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle,
    Input, Label, Badge, Checkbox, useZoruToast,
} from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';

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
    const [draft, setDraft] = React.useState<Rule>({ name: '', region: 'IN', rate: 0.18, inclusive: false, active: true });

    const load = React.useCallback(async () => {
        const r = await listTaxRules(id);
        if (r.ok) setItems(r.items as Rule[]);
    }, [id]);

    React.useEffect(() => { load(); }, [load]);

    async function onCreate() {
        if (!draft.name.trim() || !draft.region.trim()) return;
        const r = await upsertTaxRule({ storefrontId: id, ...draft });
        if (!r.ok) { toast({ title: r.error, variant: 'destructive' }); return; }
        setDraft({ name: '', region: 'IN', rate: 0.18, inclusive: false, active: true });
        load();
    }

    async function onDelete(rid: string) {
        if (!confirm('Delete this tax rule?')) return;
        const r = await deleteTaxRule(rid);
        if (r.ok) load();
    }

    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <h1 className="text-2xl font-semibold text-zoru-ink">Tax rules</h1>

            <Card className="max-w-2xl">
                <ZoruCardHeader><ZoruCardTitle>New rule</ZoruCardTitle></ZoruCardHeader>
                <ZoruCardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <Label>Region</Label>
                        <Input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <Label>Rate (0–1.5)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={draft.rate}
                            onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })}
                        />
                    </div>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm">
                        <Checkbox checked={!!draft.inclusive} onCheckedChange={(c) => setDraft({ ...draft, inclusive: c === true })} />
                        Tax inclusive in price
                    </label>
                    <div className="sm:col-span-2 flex justify-end">
                        <Button onClick={onCreate}><Plus className="h-4 w-4" /> Add rule</Button>
                    </div>
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader><ZoruCardTitle>All rules</ZoruCardTitle></ZoruCardHeader>
                <ZoruCardContent>
                    {items.length === 0 ? (
                        <p className="text-sm text-zoru-ink-muted">No rules yet.</p>
                    ) : (
                        <ul className="divide-y divide-zoru-border">
                            {items.map((r) => (
                                <li key={r._id} className="flex items-center gap-3 py-2 text-sm">
                                    <div className="flex-1">
                                        <div className="font-medium text-zoru-ink">{r.name}</div>
                                        <div className="text-xs text-zoru-ink-muted">{r.region} · {Math.round(r.rate * 100)}% {r.inclusive ? '(incl.)' : '(excl.)'}</div>
                                    </div>
                                    <Badge variant={r.active ? 'success' : 'ghost'}>{r.active ? 'Active' : 'Off'}</Badge>
                                    <Button variant="destructive" size="sm" onClick={() => r._id && onDelete(r._id)}>
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
