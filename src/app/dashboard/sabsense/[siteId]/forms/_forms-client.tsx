'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import { Button, Card, CardBody, CardHeader, CardTitle, CardDescription, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, PageHeader, PageTitle, PageDescription, PageActions, Progress, Table, TBody, Td, Th, THead, Tr, EmptyState, useToast } from '@/components/sabcrm/20ui/compat';

import {
    deleteFormAnalytics,
    upsertFormAnalytics,
} from '@/app/actions/sabsense.actions';
import type { FormAnalytics } from '@/lib/rust-client/pagesense-form-analytics';
import type { PagesenseSite } from '@/lib/rust-client/pagesense-sites';

import { PagesenseSiteNav } from '../_site-nav';

interface Props {
    site: PagesenseSite | null;
    forms: FormAnalytics[];
}

export function FormsClient({ site, forms }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [selector, setSelector] = useState('');
    const [pending, startTransition] = useTransition();

    if (!site) {
        return (
            <div className="zoruui p-8 text-sm text-[color:var(--st-text-secondary)]">
                Site not found.
            </div>
        );
    }

    const handleCreate = () => {
        if (!selector.trim()) {
            toast({ title: 'Selector required', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const res = await upsertFormAnalytics({
                siteId: site._id,
                formSelector: selector,
            });
            if (res.success) {
                toast({ title: 'Form tracked' });
                setIsOpen(false);
                setSelector('');
                router.refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    const handleDelete = (id: string) => {
        startTransition(async () => {
            const res = await deleteFormAnalytics(site._id, id);
            if (res.success) router.refresh();
            else toast({ title: 'Error', description: res.error, variant: 'destructive' });
        });
    };

    return (
        <div className="zoruui p-8 space-y-6">
            <PageHeader>
                <PageTitle>{site.name} — Form analytics</PageTitle>
                <PageDescription>
                    Per-form completion rate and per-field dropoff.
                </PageDescription>
                <PageActions>
                    <Button onClick={() => setIsOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Track a form
                    </Button>
                </PageActions>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            {forms.length === 0 ? (
                <EmptyState
                    title="No tracked forms"
                    description="Add the CSS selector of a form you want to instrument. The snippet will start reporting field-level engagement on next visit."
                    action={
                        <Button onClick={() => setIsOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Track a form
                        </Button>
                    }
                />
            ) : (
                <div className="space-y-4">
                    {forms.map((f) => (
                        <Card key={f._id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle>{f.formSelector}</CardTitle>
                                        <CardDescription>
                                            Completion rate:{' '}
                                            {Math.round((f.completionRate || 0) * 100)}%
                                        </CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(f._id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardBody>
                                <Progress value={Math.round((f.completionRate || 0) * 100)} />
                                <div className="mt-4">
                                    {f.perFieldDropoff.length === 0 ? (
                                        <p className="text-xs text-[color:var(--st-text-secondary)]">
                                            No per-field data yet. (Snippet form
                                            instrumentation is TODO.)
                                        </p>
                                    ) : (
                                        <Table>
                                            <THead>
                                                <Tr>
                                                    <Th>Field</Th>
                                                    <Th>Dropoff count</Th>
                                                </Tr>
                                            </THead>
                                            <TBody>
                                                {f.perFieldDropoff.map((fd) => (
                                                    <Tr key={fd.field}>
                                                        <Td>{fd.field}</Td>
                                                        <Td>
                                                            {fd.dropoffCount}
                                                        </Td>
                                                    </Tr>
                                                ))}
                                            </TBody>
                                        </Table>
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Track a form</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="f-selector">CSS selector</Label>
                            <Input
                                id="f-selector"
                                value={selector}
                                onChange={(e) => setSelector(e.target.value)}
                                placeholder="#signup or form.newsletter"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={pending}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
