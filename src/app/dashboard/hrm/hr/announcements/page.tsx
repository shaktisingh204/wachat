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
import {
  Edit,
  LoaderCircle,
  Pin,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Announcements — list page.
 *
 * Server-state is loaded through `getAnnouncements` (Rust-only). Filters
 * drive server-side filtering by re-calling `getAnnouncements` whenever
 * they change. Free-text search is debounced before being sent.
 *
 * Row columns: Title · Category · Priority · Audience · Publish At ·
 * Pinned · Status. Status + priority use `<StatusPill>` with tone
 * variants (urgent→red, high→amber, normal→blue, low→neutral).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deleteAnnouncement,
    getAnnouncements,
} from '@/app/actions/crm-announcements.actions';
import type {
    CrmAnnouncementAudience,
    CrmAnnouncementCategory,
    CrmAnnouncementDoc,
    CrmAnnouncementStatus,
} from '@/lib/rust-client/crm-announcements';

const BASE = '/dashboard/hrm/hr/announcements';

type StatusFilter = 'all' | CrmAnnouncementStatus;
type CategoryFilter = 'all' | CrmAnnouncementCategory;
type AudienceFilter = 'all' | CrmAnnouncementAudience;

const STATUS_TONE: Record<string, StatusTone> = {
    draft: 'neutral',
    scheduled: 'blue',
    published: 'green',
    archived: 'red',
};

const PRIORITY_TONE: Record<string, StatusTone> = {
    low: 'neutral',
    normal: 'blue',
    high: 'amber',
    urgent: 'red',
};

function fmtDateTime(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function titleCase(s?: string | null): string {
    if (!s) return '—';
    return s
        .split('_')
        .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : ''))
        .join(' ');
}

export default function AnnouncementsListPage() {
    const { toast } = useZoruToast();

    const [items, setItems] = React.useState<CrmAnnouncementDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const [search, setSearch] = React.useState('');
    const [debouncedSearch, setDebouncedSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [categoryFilter, setCategoryFilter] =
        React.useState<CategoryFilter>('all');
    const [audienceFilter, setAudienceFilter] =
        React.useState<AudienceFilter>('all');

    const [pendingDelete, setPendingDelete] =
        React.useState<CrmAnnouncementDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();

    React.useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search), 250);
        return () => clearTimeout(id);
    }, [search]);

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getAnnouncements({
                q: debouncedSearch || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                category: categoryFilter !== 'all' ? categoryFilter : undefined,
                audience: audienceFilter !== 'all' ? audienceFilter : undefined,
                limit: 100,
            });
            setItems(res.items ?? []);
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearch, statusFilter, categoryFilter, audienceFilter]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteAnnouncement(id);
            if (result.success) {
                toast({ title: 'Announcement deleted' });
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
                    title="Announcements"
                    subtitle="Company-wide updates, news, and pinned messages."
                    primaryAction={
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New
                                announcement
                            </Link>
                        </ZoruButton>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search announcements…',
                    }}
                    filters={
                        <>
                            <EnumFilterField
                                enumName="announcementStatus"
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v as StatusFilter)}
                                allLabel="All statuses"
                            />
                            <EnumFilterField
                                enumName="announcementCategory"
                                value={categoryFilter}
                                onChange={(v) => setCategoryFilter(v as CategoryFilter)}
                                allLabel="All categories"
                            />
                            <EnumFilterField
                                enumName="announcementAudience"
                                value={audienceFilter}
                                onChange={(v) => setAudienceFilter(v as AudienceFilter)}
                                allLabel="All audiences"
                            />
                        </>
                    }
                    loading={isLoading && items.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Title
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Category
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Priority
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Audience
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Publish at
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Pinned
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Status
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">
                                        Actions
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={8}
                                            className="h-24 text-center"
                                        >
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : items.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={8}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No announcements match these filters.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    items.map((a) => {
                                        const statusKey = String(
                                            a.status ?? 'draft',
                                        ).toLowerCase();
                                        const priorityKey = String(
                                            a.priority ?? 'normal',
                                        ).toLowerCase();
                                        return (
                                            <ZoruTableRow
                                                key={a._id}
                                                className="border-zoru-line"
                                            >
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${a._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {a.title}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {titleCase(a.category as string)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill
                                                        label={titleCase(
                                                            a.priority as string,
                                                        )}
                                                        tone={
                                                            PRIORITY_TONE[
                                                                priorityKey
                                                            ] ?? 'neutral'
                                                        }
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {titleCase(a.audience as string)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDateTime(a.publishAt)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    {a.pinned ? (
                                                        <span
                                                            className="inline-flex items-center gap-1 text-[12px] text-zoru-ink"
                                                            aria-label="Pinned"
                                                        >
                                                            <Pin className="h-3.5 w-3.5" />
                                                            Pinned
                                                        </span>
                                                    ) : (
                                                        <span className="text-zoru-ink-muted">
                                                            —
                                                        </span>
                                                    )}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill
                                                        label={titleCase(a.status)}
                                                        tone={
                                                            STATUS_TONE[statusKey] ??
                                                            'neutral'
                                                        }
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`${BASE}/${a._id}/edit`}
                                                            aria-label={`Edit ${a.title}`}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Delete ${a.title}`}
                                                        onClick={() =>
                                                            setPendingDelete(a)
                                                        }
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
                        <ZoruAlertDialogTitle>
                            Delete announcement?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            &ldquo;{pendingDelete?.title}&rdquo; will be removed
                            and disappear from the company feed.
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
