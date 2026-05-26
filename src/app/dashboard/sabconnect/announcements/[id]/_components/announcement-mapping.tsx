import { Badge } from '@/components/zoruui';
import { Pin } from 'lucide-react';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import type { CrmAnnouncementStatus } from '@/lib/rust-client/crm-announcements';

const STATUS_TONE: Record<CrmAnnouncementStatus, StatusTone> = {
    draft: 'neutral',
    scheduled: 'amber',
    published: 'green',
    archived: 'neutral',
};

export function fmtDate(v: string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

interface AnnouncementBadgesProps {
    status: string;
    audience?: string | null;
    category?: string | null;
    priority?: string | null;
    pinned?: boolean | null;
    publishAt?: string | null;
    expiresAt?: string | null;
}

export function AnnouncementBadges({
    status,
    audience,
    category,
    priority,
    pinned,
    publishAt,
    expiresAt,
}: AnnouncementBadgesProps) {
    const tone = STATUS_TONE[status as CrmAnnouncementStatus] ?? 'neutral';

    return (
        <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill label={status} tone={tone} />
            <Badge variant="ghost" className="capitalize">
                Audience: {audience ?? 'all'}
            </Badge>
            {category ? (
                <Badge variant="secondary" className="capitalize">
                    {String(category)}
                </Badge>
            ) : null}
            {priority ? (
                <Badge variant="ghost" className="capitalize">
                    Priority: {String(priority)}
                </Badge>
            ) : null}
            {pinned ? (
                <Badge variant="warning">
                    <Pin className="h-3 w-3" /> Pinned
                </Badge>
            ) : null}
            <Badge variant="secondary">Publish: {fmtDate(publishAt)}</Badge>
            {expiresAt ? (
                <Badge variant="secondary">Expires: {fmtDate(expiresAt)}</Badge>
            ) : null}
        </div>
    );
}

interface AnnouncementStatsProps {
    viewCount?: number | null;
    acknowledgementCount?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export function AnnouncementStats({
    viewCount,
    acknowledgementCount,
    createdAt,
    updatedAt,
}: AnnouncementStatsProps) {
    const stats = [
        { label: 'Views', value: viewCount ?? 0 },
        { label: 'Acknowledgements', value: acknowledgementCount ?? 0 },
        { label: 'Created', value: fmtDate(createdAt) },
        { label: 'Updated', value: fmtDate(updatedAt) },
    ];

    return (
        <dl className="grid gap-2 text-[12.5px]">
            {stats.map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                    <dt className="text-zoru-ink-muted">{label}</dt>
                    <dd className="text-zoru-ink">{value}</dd>
                </div>
            ))}
        </dl>
    );
}
