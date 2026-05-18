'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getCrmForms } from '@/app/actions/crm-forms.actions';
import type { CrmForm } from '@/lib/definitions';

import { Search, Plus, ClipboardList, Eye, Edit, Trash2 } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';

import { useDebouncedCallback } from 'use-debounce';
import { formatDistanceToNow } from 'date-fns';


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
        return <ZoruSkeleton className="h-96 w-full" />;
    }

    if (forms.length === 0 && !isLoading) {
        return (
            <EntityListShell
                title="Forms"
                subtitle="Create and embed forms on your website to capture leads directly into your CRM."
            >
                <ZoruCard variant="outline" className="border-dashed">
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                            <ClipboardList className="h-6 w-6 text-accent-foreground" strokeWidth={1.75} />
                        </div>
                        <h3 className="text-[15px] font-semibold text-foreground">Lead Capture Forms</h3>
                        <p className="max-w-md text-[12.5px] text-muted-foreground">
                            Create and embed forms on your website to capture leads directly into your CRM.
                        </p>
                        <Link href="/dashboard/crm/sales/forms/new">
                            <ZoruButton>
                                Create First Form
                            </ZoruButton>
                        </Link>
                    </div>
                </ZoruCard>
            </EntityListShell>
        );
    }

    return (
        <EntityListShell
            title="Forms"
            subtitle="Manage your lead capture forms."
            primaryAction={
                <Link href="/dashboard/crm/sales/forms/new">
                    <ZoruButton>
                        New Form
                    </ZoruButton>
                </Link>
            }
        >

            <ZoruCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-foreground">All Forms</h2>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <ZoruInput
                            placeholder="Search by name..."
                            className="h-10 rounded-lg border-border bg-card pl-9 text-[13px]"
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Form Name</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Submissions</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Created</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {forms.map((form) => (
                                <ZoruTableRow key={form._id.toString()} className="border-border">
                                    <ZoruTableCell className="font-medium text-foreground">{form.name}</ZoruTableCell>
                                    <ZoruTableCell className="text-foreground">{form.submissionCount || 0}</ZoruTableCell>
                                    <ZoruTableCell><ZoruBadge variant="success">Published</ZoruBadge></ZoruTableCell>
                                    <ZoruTableCell className="text-foreground">{formatDistanceToNow(new Date(form.createdAt), { addSuffix: true })}</ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <a href={`/embed/crm-form/${form._id.toString()}`} target="_blank" rel="noopener noreferrer">
                                            <ZoruButton variant="ghost" size="icon"><Eye className="h-4 w-4" /></ZoruButton>
                                        </a>
                                        <Link href={`/dashboard/crm/sales/forms/${form._id.toString()}/edit`}>
                                            <ZoruButton variant="ghost" size="icon"><Edit className="h-4 w-4" /></ZoruButton>
                                        </Link>
                                        <ZoruButton variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-600" /></ZoruButton>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
