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
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  Edit,
  LoaderCircle,
  Mail,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Email Templates — list page.
 *
 * Settings-style list with search + status + category filters. Mirrors
 * the `/dashboard/hrm/hr/policies` reference: client component bound to
 * the Rust-backed `getEmailTemplates` action.
 */

import * as React from 'react';
import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteEmailTemplate,
    getEmailTemplates,
} from '@/app/actions/crm-email-templates.actions';
import type {
    CrmEmailTemplateDoc,
    CrmEmailTemplateStatus,
} from '@/lib/rust-client/crm-email-templates';

const BASE = '/dashboard/crm/settings/email-templates';

const STATUS_TONE: Record<CrmEmailTemplateStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function EmailTemplatesListPage() {
    const [templates, setTemplates] = React.useState<CrmEmailTemplateDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmEmailTemplateStatus | 'all'
    >('all');
    const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmEmailTemplateDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getEmailTemplates({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                category: categoryFilter === 'all' ? undefined : categoryFilter,
                limit: 100,
            });
            setTemplates(res.items ?? []);
        } catch {
            setTemplates([]);
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
            const result = await deleteEmailTemplate(id);
            if (result.success) {
                toast({ title: 'Template deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete template.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    breadcrumbs={[
                        { label: 'CRM', href: '/dashboard/crm' },
                        { label: 'Settings', href: '/dashboard/crm/settings' },
                        { label: 'Email Templates' },
                    ]}
                    title="Email Templates"
                    subtitle="Reusable subject + body templates for transactional and marketing email."
                    icon={Mail}
                    actions={
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New template
                            </Link>
                        </ZoruButton>
                    }
                />

                <EntityListShell
                    title=""
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search templates…',
                    }}
                    filters={
                        <>
                            <EnumFilterField
                                enumName="emailTemplateStatus"
                                value={statusFilter}
                                onChange={(v) =>
                                    setStatusFilter(v as CrmEmailTemplateStatus | 'all')
                                }
                                allLabel="All statuses"
                            />
                            <EnumFilterField
                                enumName="emailTemplateCategory"
                                value={categoryFilter}
                                onChange={setCategoryFilter}
                                allLabel="All categories"
                            />
                        </>
                    }
                    loading={isLoading && templates.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Subject</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Variables</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Updated</ZoruTableHead>
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
                                ) : templates.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No templates match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    templates.map((t) => {
                                        const status = (t.status ??
                                            'active') as CrmEmailTemplateStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        const vars = Array.isArray(t.variables)
                                            ? t.variables
                                            : [];
                                        return (
                                            <ZoruTableRow
                                                key={t._id}
                                                className="border-zoru-line"
                                            >
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${t._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {t.name}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="max-w-[280px] truncate text-zoru-ink">
                                                    {t.subject}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize text-zoru-ink">
                                                    {t.category || '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[11.5px] text-zoru-ink-muted">
                                                    {vars.length > 0 ? vars.join(', ') : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={status} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(t.updatedAt)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${t._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(t)}
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
            </div>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete email template?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will remove it from
                            the template picker. Existing sends are not affected.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
