'use client';
import { fmtDate } from '@/lib/utils';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Document Templates — list page.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
  deleteDocumentTemplate,
    getDocumentTemplates,
    type CrmDocumentTemplateDoc,
    type CrmDocumentTemplateStatus,
} from '@/app/actions/crm-document-templates.actions';

const BASE = '/dashboard/hrm/hr/document-templates';

const STATUS_TONE: Record<CrmDocumentTemplateStatus, StatusTone> = {
    draft: 'amber',
    active: 'green',
    archived: 'neutral',
};

function statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
}



export default function DocumentTemplatesListPage() {
    const [templates, setTemplates] = React.useState<CrmDocumentTemplateDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmDocumentTemplateStatus | 'all'
    >('all');
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmDocumentTemplateDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getDocumentTemplates({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 100,
            });
            setTemplates(res.items ?? []);
        } catch {
            setTemplates([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter]);

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
            const result = await deleteDocumentTemplate(id);
            if (result.success) {
                toast({ title: 'Template archived' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not archive template.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Document templates"
                    subtitle="Reusable templates for offer letters, contracts and other HR documents."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New template
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search templates…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="documentTemplateStatus"
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as CrmDocumentTemplateStatus | 'all')}
                            allLabel="All statuses"
                        />
                    }
                    loading={isLoading && templates.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Name</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Category</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Variables</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Updated</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : templates.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={6}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No templates match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    templates.map((t) => {
                                        const status = t.status ?? 'draft';
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        const varCount = t.variables?.length ?? 0;
                                        return (
                                            <Tr key={t._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${t._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {t.name}
                                                    </Link>
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {(t.category ?? '—').replace(/_/g, ' ')}
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {varCount}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(t.updatedAt)}
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${t._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(t)}
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
                        <AlertDialogTitle>Archive template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Archiving &ldquo;{pendingDelete?.name}&rdquo; hides it from the
                            active list and stops it being used for new documents.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Archiving…' : 'Archive'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
