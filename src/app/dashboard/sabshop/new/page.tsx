'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    Input,
    Label,
    Textarea,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';

import { createStorefront } from '@/app/actions/sabshop.actions';

export default function NewStorefrontPage(): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [busy, setBusy] = React.useState(false);
    const [form, setForm] = React.useState({
        slug: '',
        displayName: '',
        description: '',
        currency: 'INR',
    });

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        const res = await createStorefront(form);
        setBusy(false);
        if (!res.ok) {
            toast({ title: 'Could not create storefront', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Storefront created' });
        router.push(`/dashboard/sabshop/${res.id}`);
    }

    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <header>
                <h1 className="text-2xl font-semibold text-[var(--st-text)]">New storefront</h1>
                <p className="text-sm text-[var(--st-text-secondary)]">
                    Create a tenant-scoped public store reachable at <code>/store/&lt;slug&gt;</code>.
                </p>
            </header>

            <form onSubmit={onSubmit}>
                <Card className="max-w-xl">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Basics</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex flex-col gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Display name</Label>
                            <Input
                                id="displayName"
                                required
                                value={form.displayName}
                                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="slug">Slug</Label>
                            <Input
                                id="slug"
                                required
                                placeholder="my-shop"
                                value={form.slug}
                                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                            />
                            <p className="text-xs text-[var(--st-text-secondary)]">Public URL: /store/{form.slug || 'your-slug'}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Select
                                value={form.currency}
                                onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="INR">INR (₹)</ZoruSelectItem>
                                    <ZoruSelectItem value="USD">USD ($)</ZoruSelectItem>
                                    <ZoruSelectItem value="EUR">EUR (€)</ZoruSelectItem>
                                    <ZoruSelectItem value="GBP">GBP (£)</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" asChild>
                                <Link href="/dashboard/sabshop">Cancel</Link>
                            </Button>
                            <Button type="submit" disabled={busy}>
                                {busy ? 'Creating…' : 'Create storefront'}
                            </Button>
                        </div>
                    </ZoruCardContent>
                </Card>
            </form>
        </div>
    );
}
