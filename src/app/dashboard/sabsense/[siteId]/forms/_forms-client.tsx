'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Field,
    Input,
    IconButton,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Progress,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    EmptyState,
    useToast,
} from '@/components/sabcrm/20ui';

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
            <div className="20ui p-8 text-sm text-[color:var(--st-text-secondary)]">
                Site not found.
            </div>
        );
    }

    const handleCreate = () => {
        if (!selector.trim()) {
            toast.error('Selector required');
            return;
        }
        startTransition(async () => {
            const res = await upsertFormAnalytics({
                siteId: site._id,
                formSelector: selector,
            });
            if (res.success) {
                toast.success('Form tracked');
                setIsOpen(false);
                setSelector('');
                router.refresh();
            } else {
                toast.error({ title: 'Error', description: res.error });
            }
        });
    };

    const handleDelete = (id: string) => {
        startTransition(async () => {
            const res = await deleteFormAnalytics(site._id, id);
            if (res.success) router.refresh();
            else toast.error({ title: 'Error', description: res.error });
        });
    };

    return (
        <div className="20ui p-8 space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>{site.name}, Form analytics</PageTitle>
                    <PageDescription>
                        Per-form completion rate and per-field dropoff.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary" iconLeft={Plus} onClick={() => setIsOpen(true)}>
                        Track a form
                    </Button>
                </PageActions>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            {forms.length === 0 ? (
                <EmptyState
                    icon={Plus}
                    title="No tracked forms"
                    description="Add the CSS selector of a form you want to instrument. The snippet will start reporting field-level engagement on next visit."
                    action={
                        <Button variant="primary" iconLeft={Plus} onClick={() => setIsOpen(true)}>
                            Track a form
                        </Button>
                    }
                />
            ) : (
                <div className="space-y-4">
                    {forms.map((f) => {
                        const pct = Math.round((f.completionRate || 0) * 100);
                        return (
                            <Card key={f._id}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle>{f.formSelector}</CardTitle>
                                            <CardDescription>
                                                Completion rate: {pct}%
                                            </CardDescription>
                                        </div>
                                        <IconButton
                                            icon={Trash2}
                                            label={`Delete tracking for ${f.formSelector}`}
                                            size="sm"
                                            onClick={() => handleDelete(f._id)}
                                            disabled={pending}
                                        />
                                    </div>
                                </CardHeader>
                                <CardBody>
                                    <Progress
                                        value={pct}
                                        aria-label={`Completion rate for ${f.formSelector}`}
                                    />
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
                                                            <Td>{fd.dropoffCount}</Td>
                                                        </Tr>
                                                    ))}
                                                </TBody>
                                            </Table>
                                        )}
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Track a form</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <Field label="CSS selector" htmlFor="f-selector">
                            <Input
                                id="f-selector"
                                value={selector}
                                onChange={(e) => setSelector(e.target.value)}
                                placeholder="#signup or form.newsletter"
                            />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleCreate} loading={pending}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
