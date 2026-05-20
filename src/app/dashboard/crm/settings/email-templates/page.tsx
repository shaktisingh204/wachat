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
  ZoruCheckbox,
  ZoruStatCard,
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
  Download,
  Edit,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';

/**
 * Email Templates — list page.
 *
 * Additions:
 *  - ZoruCheckbox multi-select
 *  - Bulk activate, bulk deactivate, bulk delete with confirm
 *  - Export CSV
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    bulkActivateEmailTemplates,
    bulkDeactivateEmailTemplates,
    bulkDeleteEmailTemplates,
    deleteEmailTemplate,
    getEmailTemplates,
} from '@/app/actions/crm-email-templates.actions';
import type {
    CrmEmailTemplateDoc,
    CrmEmailTemplateStatus,
} from '@/lib/rust-client/crm-email-templates';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

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
    const [bulkPending, startBulkTransition] = React.useTransition();
    const { toast } = useZoruToast();

    // Selection
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    // Bulk dialog state
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

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

    // Selection helpers
    const displayedIds = React.useMemo(
        () => templates.map((t) => t._id),
        [templates],
    );
    const allChecked =
        displayedIds.length > 0 && displayedIds.every((id) => selected.has(id));
    const someChecked = displayedIds.some((id) => selected.has(id));

    const toggleAll = () => {
        if (allChecked) {
            setSelected((prev) => {
                const next = new Set(prev);
                displayedIds.forEach((id) => next.delete(id));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                displayedIds.forEach((id) => next.add(id));
                return next;
            });
        }
    };

    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectedIds = React.useMemo(
        () => [...selected].filter((id) => displayedIds.includes(id)),
        [selected, displayedIds],
    );
    const hasSelection = selectedIds.length > 0;

    // Single delete
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

    // Bulk activate
    const handleBulkActivate = () => {
        startBulkTransition(async () => {
            const res = await bulkActivateEmailTemplates(selectedIds);
            if (res.ok) {
                toast({ title: `${res.count} template(s) activated` });
                setSelected(new Set());
                await refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    // Bulk deactivate
    const handleBulkDeactivate = () => {
        startBulkTransition(async () => {
            const res = await bulkDeactivateEmailTemplates(selectedIds);
            if (res.ok) {
                toast({ title: `${res.count} template(s) deactivated` });
                setSelected(new Set());
                await refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    // Bulk delete
    const handleBulkDelete = () => {
        startBulkTransition(async () => {
            const res = await bulkDeleteEmailTemplates(selectedIds);
            if (res.ok) {
                toast({ title: `${res.count} template(s) deleted` });
                setSelected(new Set());
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
            setBulkDeleteOpen(false);
            await refresh();
        });
    };

    // Export CSV
    const handleExport = () => {
        const exportRows = templates.map((t) => ({
            Name: t.name,
            Subject: t.subject,
            Category: t.category ?? '',
            Status: t.status ?? 'active',
            Updated: fmtDate(t.updatedAt),
        }));
        downloadCsv(
            `email-templates-${dateStamp()}.csv`,
            Object.keys(exportRows[0] ?? {}),
            exportRows,
        );
        toast({ title: 'CSV exported' });
    };

    return (
        <>
            <EntityListShell
                title="Email Templates"
                subtitle="Reusable subject + body templates for transactional and marketing email."
                primaryAction={
                    <div className="flex items-center gap-2">
                        <ZoruButton
                            variant="outline"
                            onClick={handleExport}
                            disabled={templates.length === 0}
                        >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Export CSV
                        </ZoruButton>
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New template
                            </Link>
                        </ZoruButton>
                    </div>
                }
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
                {/* KPI strip */}
                {(() => {
                    const totalCount = templates.length;
                    const activeTemplates = templates.filter((t) => (t.status ?? 'active') === 'active').length;
                    const categorySet = new Set(templates.map((t) => t.category).filter(Boolean));
                    const lastUsed = templates.reduce<string | null>((acc, t) => {
                        if (!t.updatedAt) return acc;
                        if (!acc) return t.updatedAt as string;
                        return new Date(t.updatedAt as string) > new Date(acc) ? (t.updatedAt as string) : acc;
                    }, null);
                    return (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
                            <ZoruStatCard label="Total templates" value={totalCount.toLocaleString()} />
                            <ZoruStatCard label="Active" value={activeTemplates.toLocaleString()} />
                            <ZoruStatCard label="Event categories" value={categorySet.size.toLocaleString()} />
                            <ZoruStatCard label="Last updated" value={lastUsed ? new Date(lastUsed).toLocaleDateString() : '—'} />
                        </div>
                    );
                })()}

                {/* Bulk bar */}
                {hasSelection && (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm mb-3">
                        <span className="font-medium text-foreground">
                            {selectedIds.length} selected
                        </span>
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            onClick={handleBulkActivate}
                            disabled={bulkPending}
                        >
                            {bulkPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            Activate
                        </ZoruButton>
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            onClick={handleBulkDeactivate}
                            disabled={bulkPending}
                        >
                            Deactivate
                        </ZoruButton>
                        <ZoruAlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                            <ZoruButton
                                variant="destructive"
                                size="sm"
                                disabled={bulkPending}
                                onClick={() => setBulkDeleteOpen(true)}
                            >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Delete selected
                            </ZoruButton>
                            <ZoruAlertDialogContent>
                                <ZoruAlertDialogHeader>
                                    <ZoruAlertDialogTitle>
                                        Delete {selectedIds.length} template(s)?
                                    </ZoruAlertDialogTitle>
                                    <ZoruAlertDialogDescription>
                                        This will permanently delete the selected templates. Existing
                                        sends are not affected.
                                    </ZoruAlertDialogDescription>
                                </ZoruAlertDialogHeader>
                                <ZoruAlertDialogFooter>
                                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                    <ZoruAlertDialogAction
                                        onClick={handleBulkDelete}
                                        disabled={bulkPending}
                                    >
                                        {bulkPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Delete
                                    </ZoruAlertDialogAction>
                                </ZoruAlertDialogFooter>
                            </ZoruAlertDialogContent>
                        </ZoruAlertDialog>
                        <ZoruButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(new Set())}
                        >
                            Clear selection
                        </ZoruButton>
                    </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="w-10">
                                    <ZoruCheckbox
                                        checked={allChecked}
                                        aria-checked={someChecked && !allChecked ? 'mixed' : allChecked}
                                        onCheckedChange={toggleAll}
                                        aria-label="Select all"
                                        disabled={templates.length === 0}
                                    />
                                </ZoruTableHead>
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
                                    <ZoruTableCell colSpan={8} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : templates.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={8}
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
                                            <ZoruTableCell>
                                                <ZoruCheckbox
                                                    checked={selected.has(t._id)}
                                                    onCheckedChange={() => toggleOne(t._id)}
                                                    aria-label={`Select ${t.name}`}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                <EntityRowLink
                                                    href={`${BASE}/${t._id}`}
                                                    label={t.name}
                                                />
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

            {/* Single delete dialog */}
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
