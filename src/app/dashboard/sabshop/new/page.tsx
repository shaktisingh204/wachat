'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui';

import { createStorefront } from '@/app/actions/sabshop.actions';

export default function NewStorefrontPage(): React.JSX.Element {
    const router = useRouter();
    const { toast } = useToast();
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
                    <CardHeader>
                        <CardTitle>Basics</CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-4">
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
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INR">INR (₹)</SelectItem>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="EUR">EUR (€)</SelectItem>
                                    <SelectItem value="GBP">GBP (£)</SelectItem>
                                </SelectContent>
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
                    </CardBody>
                </Card>
            </form>
        </div>
    );
}
