'use client';
import { fmtDate } from '@/lib/utils';


import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
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



function titleCase(s?: string | null): string {
    if (!s) return '—';
    return s
        .split('_')
        .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : ''))
        .join(' ');
}

export default function AnnouncementsListPage() {
    const { toast } = useToast();

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
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New
                                announcement
                            </Link>
                        </Button>
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
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Title
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Category
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Priority
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Audience
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Publish at
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Pinned
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
                                            No announcements match these filters.
                                        </Td>
                                    </Tr>
                                ) : (
                                    items.map((a) => {
                                        const statusKey = String(
                                            a.status ?? 'draft',
                                        ).toLowerCase();
                                        const priorityKey = String(
                                            a.priority ?? 'normal',
                                        ).toLowerCase();
                                        return (
                                            <Tr
                                                key={a._id}
                                                className="border-[var(--st-border)]"
                                            >
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${a._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {a.title}
                                                    </Link>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {titleCase(a.category as string)}
                                                </Td>
                                                <Td>
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
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {titleCase(a.audience as string)}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(a.publishAt)}
                                                </Td>
                                                <Td>
                                                    {a.pinned ? (
                                                        <span
                                                            className="inline-flex items-center gap-1 text-[12px] text-[var(--st-text)]"
                                                            aria-label="Pinned"
                                                        >
                                                            <Pin className="h-3.5 w-3.5" />
                                                            Pinned
                                                        </span>
                                                    ) : (
                                                        <span className="text-[var(--st-text-secondary)]">
                                                            —
                                                        </span>
                                                    )}
                                                </Td>
                                                <Td>
                                                    <StatusPill
                                                        label={titleCase(a.status)}
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
                                                            href={`${BASE}/${a._id}/edit`}
                                                            aria-label={`Edit ${a.title}`}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Delete ${a.title}`}
                                                        onClick={() =>
                                                            setPendingDelete(a)
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
                        <AlertDialogTitle>
                            Delete announcement?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{pendingDelete?.title}&rdquo; will be removed
                            and disappear from the company feed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
