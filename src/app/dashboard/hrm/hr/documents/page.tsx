'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Documents — list page.
 *
 * Settings-style list with search + status + category filters and an
 * inline-rendered table. The "New document" CTA links to the dedicated
 * `/new` page.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deleteDocument,
    getDocuments,
} from '@/app/actions/crm-documents.actions';
import type {
    CrmDocumentCategory,
    CrmDocumentDoc,
    CrmDocumentStatus,
} from '@/lib/rust-client/crm-documents';
import { fmtDate } from '@/lib/utils';

const BASE = '/dashboard/hrm/hr/documents';

const STATUS_TONE: Record<CrmDocumentStatus, StatusTone> = {
    pending: 'amber',
    verified: 'green',
    expired: 'red',
    rejected: 'red',
    archived: 'neutral',
};

function statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
}

function categoryLabel(c?: string): string {
    if (!c) return '—';
    return c.replace(/_/g, ' ');
}


export default function DocumentsListPage() {
    const [documents, setDocuments] = React.useState<CrmDocumentDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmDocumentStatus | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = React.useState<CrmDocumentCategory | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmDocumentDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getDocuments({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                category: categoryFilter === 'all' ? undefined : categoryFilter,
                limit: 100,
            });
            setDocuments(res.items ?? []);
        } catch {
            setDocuments([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, categoryFilter]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteDocument(id);
            if (result.success) {
                toast({ title: 'Document deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete document.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Documents"
                    subtitle="HR documents — contracts, IDs, certifications and other files."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New document
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search documents…',
                    }}
                    filters={
                        <>
                            <EnumFilterField
                                enumName="documentStatus"
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v as CrmDocumentStatus | 'all')}
                                allLabel="All statuses"
                            />
                            <EnumFilterField
                                enumName="documentCategory"
                                value={categoryFilter}
                                onChange={(v) => setCategoryFilter(v as CrmDocumentCategory | 'all')}
                                allLabel="All categories"
                            />
                        </>
                    }
                    loading={isLoading && documents.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Name</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Category</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Number</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Expiry</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : documents.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={7}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No documents match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    documents.map((d) => {
                                        const status = (d.status ?? 'pending') as CrmDocumentStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={d._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${d._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {d.name}
                                                    </Link>
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {categoryLabel(d.category)}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {d.employeeName ?? d.employeeId ?? '—'}
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {d.documentNumber ?? '—'}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(d.expiryDate)}
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${d._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(d)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>
            </EntityListShell>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will remove it from
                            the active document list. Audit records remain intact.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
