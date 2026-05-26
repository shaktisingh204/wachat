'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import {
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCardDescription,
    Dialog,
    ZoruDialogContent,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogFooter,
    Input,
    Label,
    PageHeader,
    ZoruPageTitle,
    ZoruPageDescription,
    ZoruPageActions,
    Progress,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    EmptyState,
    useZoruToast,
} from '@/components/zoruui';

import {
    deleteFormAnalytics,
    upsertFormAnalytics,
} from '@/app/actions/pagesense.actions';
import type { FormAnalytics } from '@/lib/rust-client/pagesense-form-analytics';
import type { PagesenseSite } from '@/lib/rust-client/pagesense-sites';

import { PagesenseSiteNav } from '../_site-nav';

interface Props {
    site: PagesenseSite | null;
    forms: FormAnalytics[];
}

export function FormsClient({ site, forms }: Props) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [isOpen, setIsOpen] = useState(false);
    const [selector, setSelector] = useState('');
    const [pending, startTransition] = useTransition();

    if (!site) {
        return (
            <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
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
                <ZoruPageTitle>{site.name} — Form analytics</ZoruPageTitle>
                <ZoruPageDescription>
                    Per-form completion rate and per-field dropoff.
                </ZoruPageDescription>
                <ZoruPageActions>
                    <Button onClick={() => setIsOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Track a form
                    </Button>
                </ZoruPageActions>
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
                            <ZoruCardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <ZoruCardTitle>{f.formSelector}</ZoruCardTitle>
                                        <ZoruCardDescription>
                                            Completion rate:{' '}
                                            {Math.round((f.completionRate || 0) * 100)}%
                                        </ZoruCardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(f._id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <Progress value={Math.round((f.completionRate || 0) * 100)} />
                                <div className="mt-4">
                                    {f.perFieldDropoff.length === 0 ? (
                                        <p className="text-xs text-[color:var(--zoru-fg-muted)]">
                                            No per-field data yet. (Snippet form
                                            instrumentation is TODO.)
                                        </p>
                                    ) : (
                                        <Table>
                                            <ZoruTableHeader>
                                                <ZoruTableRow>
                                                    <ZoruTableHead>Field</ZoruTableHead>
                                                    <ZoruTableHead>Dropoff count</ZoruTableHead>
                                                </ZoruTableRow>
                                            </ZoruTableHeader>
                                            <ZoruTableBody>
                                                {f.perFieldDropoff.map((fd) => (
                                                    <ZoruTableRow key={fd.field}>
                                                        <ZoruTableCell>{fd.field}</ZoruTableCell>
                                                        <ZoruTableCell>
                                                            {fd.dropoffCount}
                                                        </ZoruTableCell>
                                                    </ZoruTableRow>
                                                ))}
                                            </ZoruTableBody>
                                        </Table>
                                    )}
                                </div>
                            </ZoruCardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Track a form</ZoruDialogTitle>
                    </ZoruDialogHeader>
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
                    <ZoruDialogFooter>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={pending}>
                            Save
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}
