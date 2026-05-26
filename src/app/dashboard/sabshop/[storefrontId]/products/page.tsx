'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import {
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    Checkbox,
    Input,
    useZoruToast,
} from '@/components/zoruui';

import {
    getStorefront,
    listAvailableProducts,
    setPublishedProducts,
} from '@/app/actions/sabshop.actions';

interface ProductRow {
    _id: string;
    name?: string;
    sku?: string;
    price?: number;
}

export default function StorefrontProductsPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const { toast } = useZoruToast();
    const id = params.storefrontId;

    const [items, setItems] = React.useState<ProductRow[]>([]);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [search, setSearch] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        (async () => {
            const [sfRes, prodRes] = await Promise.all([getStorefront(id), listAvailableProducts()]);
            if (prodRes.ok) setItems(prodRes.items as ProductRow[]);
            if (sfRes.ok) {
                const sf = sfRes.item as { publishedProductIds?: string[] };
                setSelected(new Set(sf.publishedProductIds ?? []));
            }
            setLoading(false);
        })();
    }, [id]);

    const filtered = React.useMemo(() => {
        if (!search.trim()) return items;
        const n = search.toLowerCase();
        return items.filter((p) => (p.name ?? '').toLowerCase().includes(n) || (p.sku ?? '').toLowerCase().includes(n));
    }, [items, search]);

    async function onSave() {
        setBusy(true);
        const res = await setPublishedProducts(id, Array.from(selected));
        setBusy(false);
        toast({ title: res.ok ? `${selected.size} products published` : res.error, variant: res.ok ? 'default' : 'destructive' });
    }

    function toggle(pid: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(pid)) next.delete(pid); else next.add(pid);
            return next;
        });
    }

    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-zoru-ink">Publish products</h1>
                    <p className="text-sm text-zoru-ink-muted">
                        Choose which CRM products are listed on this storefront.
                    </p>
                </div>
                <Button onClick={onSave} disabled={busy}>{busy ? 'Saving…' : 'Save selection'}</Button>
            </header>

            <Card>
                <ZoruCardHeader className="flex flex-row items-center gap-3">
                    <ZoruCardTitle className="flex-1">Available CRM products</ZoruCardTitle>
                    <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
                </ZoruCardHeader>
                <ZoruCardContent>
                    {loading ? (
                        <div className="text-sm text-zoru-ink-muted">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-sm text-zoru-ink-muted">No products yet. Create some in /dashboard/crm/products.</div>
                    ) : (
                        <ul className="divide-y divide-zoru-border">
                            {filtered.map((p) => (
                                <li key={p._id} className="flex items-center gap-3 py-2">
                                    <Checkbox checked={selected.has(p._id)} onCheckedChange={() => toggle(p._id)} />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-zoru-ink">{p.name ?? 'Untitled'}</div>
                                        <div className="text-xs text-zoru-ink-muted">{p.sku ?? ''}</div>
                                    </div>
                                    <div className="text-sm text-zoru-ink">{p.price != null ? `₹${p.price}` : '—'}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}
