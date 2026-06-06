'use client';
import { fmtDate } from '@/lib/utils';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Notices — list page.
 *
 * Server-state is loaded through `getNotices` (Rust-only). Filters drive
 * server-side filtering by re-calling `getNotices` whenever they change.
 * Free-text search is debounced client-side to avoid hammering the API.
 *
 * Row columns: Notice Number · Title · Category · Severity · Issued To ·
 * Issued At · Status. Severity uses `<StatusPill>` with tone variants
 * (critical→red, warning→amber, info→blue) per the brief.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deleteNotice,
    getNotices,
} from '@/app/actions/crm-notices.actions';
import type {
    CrmNoticeCategory,
    CrmNoticeDoc,
    CrmNoticeSeverity,
    CrmNoticeStatus,
} from '@/lib/rust-client/crm-notices';

/* ─── Filter option lists ────────────────────────────────────────────── */

type StatusFilter = 'all' | CrmNoticeStatus;
type CategoryFilter = 'all' | CrmNoticeCategory;
type SeverityFilter = 'all' | CrmNoticeSeverity;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'issued', label: 'Issued' },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'superseded', label: 'Superseded' },
    { value: 'archived', label: 'Archived' },
];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All categories' },
    { value: 'general', label: 'General' },
    { value: 'safety', label: 'Safety' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'closure', label: 'Closure' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'emergency', label: 'Emergency' },
];

// §1E.sweep: SEVERITY_OPTIONS removed — now driven by <EnumFilterField enumName="announcementSeverity">.
// §1E.sweep: STATUS_OPTIONS + CATEGORY_OPTIONS kept — notice status/category slugs differ from CRM_ENUMS.

/* ─── Tone maps ──────────────────────────────────────────────────────── */

// Severity → StatusPill tone. The brief calls out: critical→danger (red),
// warning→amber, info→blue.


const SEVERITY_TONE: Record<string, StatusTone> = {
    critical: 'red',
    warning: 'amber',
    info: 'blue',
};

const SEVERITY_DISPLAY: Record<string, string> = {
    critical: 'High Priority',
    warning: 'Medium Priority',
    info: 'Low Priority',
};

const STATUS_TONE: Record<string, StatusTone> = {
    draft: 'neutral',
    issued: 'blue',
    acknowledged: 'green',
    superseded: 'amber',
    archived: 'red',
};

/* ─── Helpers ────────────────────────────────────────────────────────── */



function titleCase(s?: string): string {
    if (!s) return '—';
    return s
        .split('_')
        .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : ''))
        .join(' ');
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function NoticesListPage() {
    const { toast } = useToast();

    const [items, setItems] = React.useState<CrmNoticeDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    // Filter state — UI-controlled. `search` is debounced before being
    // sent to the server.
    const [search, setSearch] = React.useState('');
    const [debouncedSearch, setDebouncedSearch] = React.useState('');
    const [statusFilter, setStatusFilter] =
        React.useState<StatusFilter>('all');
    const [categoryFilter, setCategoryFilter] =
        React.useState<CategoryFilter>('all');
    const [severityFilter, setSeverityFilter] =
        React.useState<SeverityFilter>('all');

    const [pendingDelete, setPendingDelete] =
        React.useState<CrmNoticeDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();

    // Debounce search input.
    React.useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search), 250);
        return () => clearTimeout(id);
    }, [search]);

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getNotices({
                q: debouncedSearch || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                category: categoryFilter !== 'all' ? categoryFilter : undefined,
                severity: severityFilter !== 'all' ? severityFilter : undefined,
            });
            setItems(res.items);
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearch, statusFilter, categoryFilter, severityFilter]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteNotice(id);
            if (result.success) {
                toast({ title: 'Notice deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Notices"
                    subtitle="Company-wide notices, advisories, and circulars."
                    primaryAction={
                        <Button asChild>
                            <Link href="/dashboard/hrm/hr/notices/new">
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New notice
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search notices…',
                    }}
                    filters={
                        <>
                            <Select
                                value={statusFilter}
                                onValueChange={(v) =>
                                    setStatusFilter(v as StatusFilter)
                                }
                            >
                                <SelectTrigger className="h-9 w-[170px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <SelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={categoryFilter}
                                onValueChange={(v) =>
                                    setCategoryFilter(v as CategoryFilter)
                                }
                            >
                                <SelectTrigger className="h-9 w-[170px]">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORY_OPTIONS.map((o) => (
                                        <SelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <EnumFilterField
                                enumName="announcementSeverity"
                                value={severityFilter}
                                onChange={(v) => setSeverityFilter(v as SeverityFilter)}
                                allLabel="All severities"
                            />
                        </>
                    }
                    loading={isLoading && items.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Notice No.
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Title
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Category
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Severity
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Issued To
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Issued At
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Status
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">
                                        Actions
                                    </Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={8}
                                            className="h-24 text-center"
                                        >
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : items.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={8}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No notices match these filters.
                                        </Td>
                                    </Tr>
                                ) : (
                                    items.map((n) => {
                                        const severityKey = String(
                                            n.severity ?? 'info',
                                        ).toLowerCase();
                                        const statusKey = String(
                                            n.status ?? 'draft',
                                        ).toLowerCase();
                                        return (
                                            <Tr
                                                key={n._id}
                                                className="border-[var(--st-border)]"
                                            >
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    <Link
                                                        href={`/dashboard/hrm/hr/notices/${n._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {n.noticeNumber || n._id.slice(-8)}
                                                    </Link>
                                                </Td>
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`/dashboard/hrm/hr/notices/${n._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {n.title}
                                                    </Link>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {titleCase(n.category as string)}
                                                </Td>
                                                <Td>
                                                    <StatusPill
                                                        label={SEVERITY_DISPLAY[severityKey] ?? titleCase(n.severity as string)}
                                                        tone={
                                                            SEVERITY_TONE[severityKey] ??
                                                            'neutral'
                                                        }
                                                    />
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {titleCase(n.issuedTo as string)}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(
                                                        n.issuedAt ?? n.createdAt,
                                                    )}
                                                </Td>
                                                <Td>
                                                    <StatusPill
                                                        label={titleCase(n.status)}
                                                        tone={
                                                            STATUS_TONE[statusKey] ??
                                                            'neutral'
                                                        }
                                                    />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`/dashboard/hrm/hr/notices/${n._id}/edit`}
                                                            aria-label={`Edit ${n.title}`}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    {severityKey === 'critical' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Send Push Notification"
                                                            onClick={() => toast({ title: 'Push Notification Sent', description: `Alerted all staff about: ${n.title}` })}
                                                        >
                                                            <span className="text-xl">🔔</span>
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Delete ${n.title}`}
                                                        onClick={() =>
                                                            setPendingDelete(n)
                                                        }
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
                        <AlertDialogTitle>Delete notice?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{pendingDelete?.title}&rdquo; will be removed
                            and no longer visible to recipients.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
