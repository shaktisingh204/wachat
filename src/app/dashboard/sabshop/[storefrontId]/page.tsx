'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import {
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    Input,
    Label,
    Textarea,
    Badge,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    useZoruToast,
} from '@/components/zoruui';

import {
    getStorefront,
    updateStorefront,
    deleteStorefront,
} from '@/app/actions/sabshop.actions';

interface StorefrontDoc {
    _id: string;
    slug: string;
    displayName: string;
    description?: string;
    currency?: string;
    status?: 'draft' | 'live' | 'paused';
    customCss?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    heroImageUrl?: string;
    logoUrl?: string;
    themeId?: string;
}

export default function StorefrontSettingsPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const router = useRouter();
    const { toast } = useZoruToast();
    const id = params.storefrontId;

    const [sf, setSf] = React.useState<StorefrontDoc | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);

    const load = React.useCallback(async () => {
        setLoading(true);
        const res = await getStorefront(id);
        if (res.ok) setSf(res.item as StorefrontDoc);
        setLoading(false);
    }, [id]);

    React.useEffect(() => {
        load();
    }, [load]);

    if (loading) return <div className="zoruui p-6 text-zoru-ink-muted">Loading…</div>;
    if (!sf) return <div className="zoruui p-6 text-red-500">Storefront not found.</div>;

    async function onSave() {
        if (!sf) return;
        setBusy(true);
        const res = await updateStorefront(id, sf);
        setBusy(false);
        toast({ title: res.ok ? 'Saved' : `Save failed: ${res.error}`, variant: res.ok ? 'default' : 'destructive' });
    }

    async function onDelete() {
        if (!confirm('Delete this storefront?')) return;
        setBusy(true);
        const res = await deleteStorefront(id);
        setBusy(false);
        if (res.ok) {
            toast({ title: 'Storefront deleted' });
            router.push('/dashboard/sabshop');
        } else {
            toast({ title: res.error, variant: 'destructive' });
        }
    }

    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-zoru-ink-muted">Storefront</p>
                    <h1 className="text-2xl font-semibold text-zoru-ink">{sf.displayName}</h1>
                    <p className="text-sm text-zoru-ink-muted">/store/{sf.slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge variant={sf.status === 'live' ? 'success' : sf.status === 'paused' ? 'warning' : 'ghost'}>
                        {sf.status ?? 'draft'}
                    </Badge>
                    <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/sabshop/${id}/products`}>Products</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/sabshop/${id}/collections`}>Collections</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/sabshop/${id}/orders`}>Orders</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/sabshop/${id}/shipping`}>Shipping</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/sabshop/${id}/taxes`}>Taxes</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/sabshop/${id}/themes`}>Themes</Link>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                        <Link href={`/store/${sf.slug}`} target="_blank">View store →</Link>
                    </Button>
                </div>
            </header>

            <Card className="max-w-3xl">
                <ZoruCardHeader>
                    <ZoruCardTitle>Basics</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Display name</Label>
                        <Input value={sf.displayName} onChange={(e) => setSf({ ...sf, displayName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input value={sf.slug} onChange={(e) => setSf({ ...sf, slug: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={sf.currency ?? 'INR'} onValueChange={(v) => setSf({ ...sf, currency: v })}>
                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="INR">INR (₹)</ZoruSelectItem>
                                <ZoruSelectItem value="USD">USD ($)</ZoruSelectItem>
                                <ZoruSelectItem value="EUR">EUR (€)</ZoruSelectItem>
                                <ZoruSelectItem value="GBP">GBP (£)</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                            value={sf.status ?? 'draft'}
                            onValueChange={(v) => setSf({ ...sf, status: v as StorefrontDoc['status'] })}
                        >
                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                                <ZoruSelectItem value="live">Live</ZoruSelectItem>
                                <ZoruSelectItem value="paused">Paused</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label>Description</Label>
                        <Textarea
                            value={sf.description ?? ''}
                            onChange={(e) => setSf({ ...sf, description: e.target.value })}
                        />
                    </div>
                </ZoruCardContent>
            </Card>

            <Card className="max-w-3xl">
                <ZoruCardHeader>
                    <ZoruCardTitle>Home hero</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Hero title</Label>
                        <Input value={sf.heroTitle ?? ''} onChange={(e) => setSf({ ...sf, heroTitle: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Hero subtitle</Label>
                        <Input value={sf.heroSubtitle ?? ''} onChange={(e) => setSf({ ...sf, heroSubtitle: e.target.value })} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label>Hero image URL (SabFiles)</Label>
                        <Input value={sf.heroImageUrl ?? ''} onChange={(e) => setSf({ ...sf, heroImageUrl: e.target.value })} />
                        <p className="text-xs text-zoru-ink-muted">
                            TODO: replace with SabFilePickerButton.
                        </p>
                    </div>
                </ZoruCardContent>
            </Card>

            <Card className="max-w-3xl">
                <ZoruCardHeader>
                    <ZoruCardTitle>Custom CSS</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <Textarea
                        rows={8}
                        value={sf.customCss ?? ''}
                        onChange={(e) => setSf({ ...sf, customCss: e.target.value })}
                        placeholder=":root { --primary: #5b21b6; }"
                    />
                </ZoruCardContent>
            </Card>

            <div className="flex max-w-3xl items-center justify-between">
                <Button variant="destructive" onClick={onDelete} disabled={busy}>Delete storefront</Button>
                <Button onClick={onSave} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            </div>
        </div>
    );
}
