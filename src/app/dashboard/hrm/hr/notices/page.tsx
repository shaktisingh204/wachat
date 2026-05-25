'use client';
import { fmtDate } from '@/lib/utils';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
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
    const { toast } = useZoruToast();

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
                                <ZoruSelectTrigger className="h-9 w-[170px]">
                                    <ZoruSelectValue placeholder="Status" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <ZoruSelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                            <Select
                                value={categoryFilter}
                                onValueChange={(v) =>
                                    setCategoryFilter(v as CategoryFilter)
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[170px]">
                                    <ZoruSelectValue placeholder="Category" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {CATEGORY_OPTIONS.map((o) => (
                                        <ZoruSelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
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
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-border hover:bg-transparent">
                                    <ZoruTableHead className="text-muted-foreground">
                                        Notice No.
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">
                                        Title
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">
                                        Category
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">
                                        Severity
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">
                                        Issued To
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">
                                        Issued At
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">
                                        Status
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">
                                        Actions
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell
                                            colSpan={8}
                                            className="h-24 text-center"
                                        >
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : items.length === 0 ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell
                                            colSpan={8}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            No notices match these filters.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    items.map((n) => {
                                        const severityKey = String(
                                            n.severity ?? 'info',
                                        ).toLowerCase();
                                        const statusKey = String(
                                            n.status ?? 'draft',
                                        ).toLowerCase();
                                        return (
                                            <ZoruTableRow
                                                key={n._id}
                                                className="border-border"
                                            >
                                                <ZoruTableCell className="font-mono text-[12px] text-foreground">
                                                    <Link
                                                        href={`/dashboard/hrm/hr/notices/${n._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {n.noticeNumber || n._id.slice(-8)}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-medium text-foreground">
                                                    <Link
                                                        href={`/dashboard/hrm/hr/notices/${n._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {n.title}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-foreground">
                                                    {titleCase(n.category as string)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill
                                                        label={SEVERITY_DISPLAY[severityKey] ?? titleCase(n.severity as string)}
                                                        tone={
                                                            SEVERITY_TONE[severityKey] ??
                                                            'neutral'
                                                        }
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-foreground">
                                                    {titleCase(n.issuedTo as string)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-foreground">
                                                    {fmtDate(
                                                        n.issuedAt ?? n.createdAt,
                                                    )}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill
                                                        label={titleCase(n.status)}
                                                        tone={
                                                            STATUS_TONE[statusKey] ??
                                                            'neutral'
                                                        }
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
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
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete notice?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            &ldquo;{pendingDelete?.title}&rdquo; will be removed
                            and no longer visible to recipients.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
