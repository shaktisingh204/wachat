'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Field,
    Input,
    Textarea,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    useToast,
} from '@/components/sabcrm/20ui';

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
            toast.error({ title: 'Could not create storefront', description: res.error });
            return;
        }
        toast.success('Storefront created');
        router.push(`/dashboard/sabshop/${res.id}`);
    }

    return (
        <div className="flex flex-col gap-4 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>New storefront</PageTitle>
                    <PageDescription>
                        Create a tenant-scoped public store reachable at{' '}
                        <code className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-1 py-0.5 text-[var(--st-text)]">
                            /store/&lt;slug&gt;
                        </code>
                        .
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <form onSubmit={onSubmit}>
                <Card className="max-w-xl">
                    <CardHeader>
                        <CardTitle>Basics</CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-4">
                        <Field label="Display name" required>
                            <Input
                                required
                                value={form.displayName}
                                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                            />
                        </Field>

                        <Field
                            label="Slug"
                            required
                            help={`Public URL: /store/${form.slug || 'your-slug'}`}
                        >
                            <Input
                                required
                                placeholder="my-shop"
                                value={form.slug}
                                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                            />
                        </Field>

                        <Field label="Description">
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            />
                        </Field>

                        <Field label="Currency">
                            <Select
                                value={form.currency}
                                onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                            >
                                <SelectTrigger aria-label="Currency">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INR">INR (₹)</SelectItem>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="EUR">EUR (€)</SelectItem>
                                    <SelectItem value="GBP">GBP (£)</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => router.push('/dashboard/sabshop')}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" loading={busy}>
                                {busy ? 'Creating' : 'Create storefront'}
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            </form>
        </div>
    );
}
