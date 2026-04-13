'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getCrmForms } from '@/app/actions/crm-forms.actions';
import type { CrmForm } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, ClipboardList, Eye, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import { formatDistanceToNow } from 'date-fns';

import { ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

const FORMS_PER_PAGE = 20;

export default function CrmFormsPage() {
    const [forms, setForms] = useState<WithId<CrmForm>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const { forms: data, total } = await getCrmForms(currentPage, FORMS_PER_PAGE, searchQuery);
            setForms(data);
            setTotalPages(Math.ceil(total / FORMS_PER_PAGE));
        });
    }, [currentPage, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);

    if (isLoading && forms.length === 0) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (forms.length === 0 && !isLoading) {
        return (
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Forms"
                    subtitle="Create and embed forms on your website to capture leads directly into your CRM."
                    icon={ClipboardList}
                />
                <ClayCard variant="outline" className="border-dashed">
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                            <ClipboardList className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
                        </div>
                        <h3 className="text-[15px] font-semibold text-clay-ink">Lead Capture Forms</h3>
                        <p className="max-w-md text-[12.5px] text-clay-ink-muted">
                            Create and embed forms on your website to capture leads directly into your CRM.
                        </p>
                        <Link href="/dashboard/crm/sales-crm/forms/new">
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                                Create First Form
                            </ClayButton>
                        </Link>
                    </div>
                </ClayCard>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Forms"
                subtitle="Manage your lead capture forms."
                icon={ClipboardList}
                actions={
                    <Link href="/dashboard/crm/sales-crm/forms/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Form
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-clay-ink">All Forms</h2>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
                        <Input
                            placeholder="Search by name..."
                            className="h-10 rounded-clay-md border-clay-border bg-clay-surface pl-9 text-[13px]"
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Form Name</TableHead>
                                <TableHead className="text-clay-ink-muted">Submissions</TableHead>
                                <TableHead className="text-clay-ink-muted">Status</TableHead>
                                <TableHead className="text-clay-ink-muted">Created</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {forms.map((form) => (
                                <TableRow key={form._id.toString()} className="border-clay-border">
                                    <TableCell className="font-medium text-clay-ink">{form.name}</TableCell>
                                    <TableCell className="text-clay-ink">{form.submissionCount || 0}</TableCell>
                                    <TableCell><ClayBadge tone="green" dot>Published</ClayBadge></TableCell>
                                    <TableCell className="text-clay-ink">{formatDistanceToNow(new Date(form.createdAt), { addSuffix: true })}</TableCell>
                                    <TableCell className="text-right">
                                        <a href={`/embed/crm-form/${form._id.toString()}`} target="_blank" rel="noopener noreferrer">
                                            <ClayButton variant="ghost" size="icon"><Eye className="h-4 w-4" /></ClayButton>
                                        </a>
                                        <Link href={`/dashboard/crm/sales-crm/forms/${form._id.toString()}/edit`}>
                                            <ClayButton variant="ghost" size="icon"><Edit className="h-4 w-4" /></ClayButton>
                                        </Link>
                                        <ClayButton variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-600" /></ClayButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
