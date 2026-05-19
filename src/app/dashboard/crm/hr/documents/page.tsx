'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
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
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteDocument,
    getDocuments,
} from '@/app/actions/crm-documents.actions';
import type {
    CrmDocumentCategory,
    CrmDocumentDoc,
    CrmDocumentStatus,
} from '@/lib/rust-client/crm-documents';

const BASE = '/dashboard/crm/hr/documents';

const STATUS_OPTIONS: Array<{ value: CrmDocumentStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'verified', label: 'Verified' },
    { value: 'expired', label: 'Expired' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'archived', label: 'Archived' },
];

const CATEGORY_OPTIONS: Array<{ value: CrmDocumentCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All categories' },
    { value: 'id_proof', label: 'ID proof' },
    { value: 'address_proof', label: 'Address proof' },
    { value: 'qualification', label: 'Qualification' },
    { value: 'experience', label: 'Experience' },
    { value: 'contract', label: 'Contract' },
    { value: 'appointment', label: 'Appointment' },
    { value: 'resignation', label: 'Resignation' },
    { value: 'other', label: 'Other' },
];

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

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function DocumentsListPage() {
    const [documents, setDocuments] = React.useState<CrmDocumentDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmDocumentStatus | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = React.useState<CrmDocumentCategory | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmDocumentDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

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
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New document
                            </Link>
                        </ZoruButton>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search documents…',
                    }}
                    filters={
                        <>
                            <ZoruSelect
                                value={statusFilter}
                                onValueChange={(v) =>
                                    setStatusFilter(v as CrmDocumentStatus | 'all')
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[180px]">
                                    <ZoruSelectValue placeholder="Status" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            <ZoruSelect
                                value={categoryFilter}
                                onValueChange={(v) =>
                                    setCategoryFilter(v as CrmDocumentCategory | 'all')
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[200px]">
                                    <ZoruSelectValue placeholder="Category" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {CATEGORY_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </>
                    }
                    loading={isLoading && documents.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Number</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Expiry</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : documents.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No documents match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    documents.map((d) => {
                                        const status = (d.status ?? 'pending') as CrmDocumentStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={d._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <EntityRowLink
                                                        href={`${BASE}/${d._id}`}
                                                        label={d.name}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize text-zoru-ink">
                                                    {categoryLabel(d.category)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {d.employeeName ?? d.employeeId ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {d.documentNumber ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(d.expiryDate)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${d._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(d)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </ZoruButton>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete document?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will remove it from
                            the active document list. Audit records remain intact.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
