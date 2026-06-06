import { fmtDate } from '@/lib/utils';
import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  Eye,
  MessageSquare,
  Pencil,
  Pin,
  Users,
  } from 'lucide-react';

/**
 * HR Announcement detail page.
 *
 * Server component that fetches a single announcement via
 * `getAnnouncementById` (Rust-backed) and renders a stacked Card
 * layout:
 *   1. Header — title, category, status, priority, pinned
 *   2. Banner (when present)
 *   3. Body
 *   4. Audience
 *   5. Schedule + engagement
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getAnnouncementById } from '@/app/actions/crm-announcements.actions';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/announcements';

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

export default async function AnnouncementDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const announcement = await getAnnouncementById(id);
    if (!announcement) notFound();

    const statusKey = String(announcement.status ?? 'draft').toLowerCase();
    const priorityKey = String(announcement.priority ?? 'normal').toLowerCase();

    const audienceIds = Array.isArray(announcement.audienceIds)
        ? announcement.audienceIds
        : [];
    const tags = Array.isArray(announcement.tags) ? announcement.tags : [];
    const viewCount = announcement.viewCount ?? 0;
    const ackCount = announcement.acknowledgementCount ?? 0;

    return (
        <EntityListShell
            title={announcement.title}
            subtitle={titleCase((announcement.category as string) || 'general')}
            primaryAction={
                <Button asChild>
                    <Link href={`${BASE}/${announcement._id}/edit`}>
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            {/* Header card */}
            <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="text-[20px] font-medium text-[var(--st-text)]">
                            {announcement.title}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                            <span>
                                Category:{' '}
                                {titleCase((announcement.category as string) || 'general')}
                            </span>
                            <span aria-hidden>·</span>
                            <span>
                                Audience:{' '}
                                {titleCase((announcement.audience as string) || 'all')}
                            </span>
                            {announcement.authorName ? (
                                <>
                                    <span aria-hidden>·</span>
                                    <span>By {announcement.authorName}</span>
                                </>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <StatusPill
                            label={titleCase((announcement.priority as string) || 'normal')}
                            tone={PRIORITY_TONE[priorityKey] ?? 'neutral'}
                        />
                        <StatusPill
                            label={titleCase((announcement.status as string) || 'draft')}
                            tone={STATUS_TONE[statusKey] ?? 'neutral'}
                        />
                        {announcement.pinned ? (
                            <Badge variant="info">
                                <Pin className="mr-1 h-3 w-3" />
                                Pinned
                            </Badge>
                        ) : null}
                        {announcement.requireAcknowledgement ? (
                            <Badge variant="secondary">
                                Acknowledgement required
                            </Badge>
                        ) : null}
                    </div>
                </div>

                {tags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                            <Badge key={t} variant="ghost">
                                {t}
                            </Badge>
                        ))}
                    </div>
                ) : null}
            </Card>

            {/* Banner */}
            {announcement.bannerUrl ? (
                <Card className="overflow-hidden p-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={announcement.bannerUrl}
                        alt=""
                        className="max-h-[360px] w-full object-cover"
                    />
                </Card>
            ) : null}

            {/* Body */}
            <Card className="p-6">
                <div className="mb-3 text-[14px] font-medium text-[var(--st-text)]">
                    Announcement body
                </div>
                <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--st-text)]">
                    {announcement.body || (
                        <span className="text-[var(--st-text-secondary)]">
                            No body provided.
                        </span>
                    )}
                </div>
            </Card>

            {/* Audience */}
            <Card className="p-6">
                <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    <span className="text-[14px] font-medium text-[var(--st-text)]">
                        Audience
                    </span>
                    <span className="ml-auto text-[12px] text-[var(--st-text-secondary)]">
                        {titleCase((announcement.audience as string) || 'all')} ·{' '}
                        {audienceIds.length} explicit target
                        {audienceIds.length === 1 ? '' : 's'}
                    </span>
                </div>
                {audienceIds.length === 0 ? (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-4 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        {announcement.audience === 'all'
                            ? 'Published to all employees.'
                            : 'No explicit target list — resolved by audience.'}
                    </div>
                ) : (
                    <ul className="flex flex-wrap gap-2">
                        {audienceIds.map((r, i) => (
                            <li key={`${r}-${i}`}>
                                <Badge variant="secondary">{r}</Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {/* Schedule + engagement */}
            <Card className="p-6">
                <div className="mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    <span className="text-[14px] font-medium text-[var(--st-text)]">
                        Schedule & engagement
                    </span>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Publish at</div>
                        <div className="text-[var(--st-text)]">
                            {fmtDate(announcement.publishAt)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Expires at</div>
                        <div className="text-[var(--st-text)]">
                            {fmtDate(announcement.expiresAt)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Published at</div>
                        <div className="text-[var(--st-text)]">
                            {fmtDate(announcement.publishedAt)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Updated</div>
                        <div className="text-[var(--st-text)]">
                            {fmtDate(announcement.updatedAt)}
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[12.5px] text-[var(--st-text)]">
                    <span className="inline-flex items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2.5 py-1">
                        <Eye className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                        {viewCount} view{viewCount === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2.5 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                        {ackCount} acknowledgement
                        {ackCount === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2.5 py-1">
                        <MessageSquare className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                        Comments{' '}
                        {announcement.allowComments ? 'enabled' : 'disabled'}
                    </span>
                </div>
            </Card>
        </EntityListShell>
    );
}
