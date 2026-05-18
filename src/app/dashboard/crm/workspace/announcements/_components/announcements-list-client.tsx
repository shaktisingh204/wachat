'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  useDebouncedCallback } from 'use-debounce';
import { Megaphone,
  Pin,
  Plus,
  Trash2,
  X } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill,
  type StatusTone } from '@/components/crm/status-pill';

/**
 * <AnnouncementsListClient> — interactive list with status / audience /
 * pinned filters and free-text search. Receives an initial snapshot from
 * the server page; deletes refetch via `getAnnouncements`.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    deleteAnnouncement,
    getAnnouncements,
} from '@/app/actions/crm-announcements.actions';
import type {
    CrmAnnouncementDoc,
    CrmAnnouncementStatus,
} from '@/lib/rust-client/crm-announcements';

interface ListClientProps {
    initialItems: CrmAnnouncementDoc[];
}

const STATUS_TONE: Record<CrmAnnouncementStatus, StatusTone> = {
    draft: 'neutral',
    scheduled: 'amber',
    published: 'green',
    archived: 'neutral',
};

function fmtDate(v: string | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function AnnouncementsListClient({
    initialItems,
}: ListClientProps): React.JSX.Element {
    const { toast } = useZoruToast();

    const [items, setItems] = React.useState<CrmAnnouncementDoc[]>(initialItems);
    const [statusFilter, setStatusFilter] = React.useState<
        CrmAnnouncementStatus | 'all'
    >('all');
    const [audienceFilter, setAudienceFilter] = React.useState<string>('all');
    const [search, setSearch] = React.useState<string>('');
    const [searchDraft, setSearchDraft] = React.useState<string>('');
    const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
    const [loading, startTransition] = React.useTransition();

    const refetch = React.useCallback(() => {
        startTransition(async () => {
            const r = await getAnnouncements();
            setItems(r.items);
        });
    }, []);

    const onSearch = useDebouncedCallback((v: string) => setSearch(v), 200);

    const visible = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return items
            .filter((a) => statusFilter === 'all' || a.status === statusFilter)
            .filter((a) => {
                if (audienceFilter === 'all') return true;
                const aud = (a.audience ?? '') as string;
                if (audienceFilter === 'everyone') return aud === 'all';
                return aud === audienceFilter;
            })
            .filter((a) => {
                if (!q) return true;
                return (
                    a.title.toLowerCase().includes(q) ||
                    a.body.toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                const ap = a.pinned ? 1 : 0;
                const bp = b.pinned ? 1 : 0;
                if (ap !== bp) return bp - ap;
                return (
                    new Date(b.createdAt ?? 0).getTime() -
                    new Date(a.createdAt ?? 0).getTime()
                );
            });
    }, [items, search, statusFilter, audienceFilter]);

    const kpis = React.useMemo(() => {
        const total = items.length;
        const pinned = items.filter((a) => a.pinned).length;
        const published = items.filter((a) => a.status === 'published').length;
        const drafts = items.filter((a) => a.status === 'draft').length;
        return { total, pinned, published, drafts };
    }, [items]);

    const hasActiveFilters =
        statusFilter !== 'all' || audienceFilter !== 'all' || search !== '';

    const clear = () => {
        setStatusFilter('all');
        setAudienceFilter('all');
        setSearch('');
        setSearchDraft('');
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        const r = await deleteAnnouncement(pendingDelete);
        if (r.success) {
            toast({ title: 'Announcement deleted' });
            refetch();
        } else {
            toast({
                title: 'Delete failed',
                description: r.error,
                variant: 'destructive',
            });
        }
        setPendingDelete(null);
    };

    return (
        <>
            <EntityListShell
                title="Announcements"
                subtitle="Broadcast updates, schedule rollouts, and track who has acknowledged."
                search={{
                    value: searchDraft,
                    onChange: (v) => {
                        setSearchDraft(v);
                        onSearch(v);
                    },
                    placeholder: 'Search title or body…',
                }}
                primaryAction={
                    <ZoruButton asChild>
                        <Link href="/dashboard/crm/workspace/announcements/new">
                            <Plus className="h-4 w-4" /> New announcement
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <EnumFilterField
                            enumName="announcementStatus"
                            value={statusFilter}
                            onChange={(v) =>
                                setStatusFilter(v as CrmAnnouncementStatus | 'all')
                            }
                            allLabel="All statuses"
                        />
                        <ZoruSelect
                            value={audienceFilter}
                            onValueChange={(v) => setAudienceFilter(v)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[160px]">
                                <ZoruSelectValue placeholder="Audience" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">Any audience</ZoruSelectItem>
                                <ZoruSelectItem value="everyone">Everyone</ZoruSelectItem>
                                <ZoruSelectItem value="department">Department</ZoruSelectItem>
                                <ZoruSelectItem value="team">Team</ZoruSelectItem>
                                <ZoruSelectItem value="role">Role</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        {hasActiveFilters ? (
                            <ZoruButton variant="ghost" size="sm" onClick={clear}>
                                <X className="h-3.5 w-3.5" /> Clear
                            </ZoruButton>
                        ) : null}
                    </div>
                }
                empty={
                    !loading && items.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <h3 className="text-base font-medium text-zoru-ink">
                                No announcements yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Draft and publish your first company announcement.
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/workspace/announcements/new">
                                    <Plus className="h-4 w-4" /> Create announcement
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={loading && items.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <ZoruStatCard
                            label="Total"
                            value={kpis.total}
                            icon={<Megaphone className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Published"
                            value={kpis.published}
                            icon={<Megaphone className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Drafts"
                            value={kpis.drafts}
                            icon={<Megaphone className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Pinned"
                            value={kpis.pinned}
                            icon={<Pin className="h-4 w-4" />}
                        />
                    </div>
                    <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
                        <table className="w-full min-w-[800px] text-[13px]">
                            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                <tr>
                                    {[
                                        'Title',
                                        'Audience',
                                        'Pinned',
                                        'Published',
                                        'Expires',
                                        'Status',
                                        '',
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            className="px-3 py-2 text-left font-medium"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                                {visible.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="p-6 text-center text-zoru-ink-muted"
                                        >
                                            No announcements match the current filters.
                                        </td>
                                    </tr>
                                ) : null}
                                {visible.map((a) => {
                                    const tone =
                                        STATUS_TONE[a.status as CrmAnnouncementStatus] ??
                                        'neutral';
                                    return (
                                        <tr key={a._id} className="hover:bg-zoru-surface">
                                            <td className="px-3 py-2">
                                                <Link
                                                    href={`/dashboard/crm/workspace/announcements/${a._id}`}
                                                    className="font-medium text-zoru-ink hover:underline"
                                                >
                                                    {a.title}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 capitalize text-zoru-ink-muted">
                                                {a.audience ?? '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                {a.pinned ? (
                                                    <ZoruBadge variant="warning">
                                                        <Pin className="h-3 w-3" /> Pinned
                                                    </ZoruBadge>
                                                ) : (
                                                    <span className="text-zoru-ink-muted">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-zoru-ink-muted">
                                                {fmtDate(a.publishedAt ?? a.publishAt)}
                                            </td>
                                            <td className="px-3 py-2 text-zoru-ink-muted">
                                                {fmtDate(a.expiresAt)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusPill label={a.status} tone={tone} />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setPendingDelete(a._id)}
                                                    aria-label={`Delete ${a.title}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </ZoruButton>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
                title="Delete this announcement?"
                description="The announcement will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={confirmDelete}
            />
        </>
    );
}

export default AnnouncementsListClient;
