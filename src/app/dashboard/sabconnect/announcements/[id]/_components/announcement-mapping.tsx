import { Badge, StatCard, type BadgeVariant } from '@/components/sabcrm/20ui';
import { Pin } from 'lucide-react';
import type { CrmAnnouncementStatus } from '@/lib/rust-client/crm-announcements';

const STATUS_VARIANT: Record<CrmAnnouncementStatus, BadgeVariant> = {
    draft: 'secondary',
    scheduled: 'warning',
    published: 'success',
    archived: 'secondary',
};

export function fmtDate(v: string | null | undefined): string {
    if (!v) return '-';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '-';
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
    const variant = STATUS_VARIANT[status as CrmAnnouncementStatus] ?? 'secondary';

    return (
        <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={variant} className="capitalize">
                {status}
            </Badge>
            <Badge variant="outline" className="capitalize">
                Audience: {audience ?? 'all'}
            </Badge>
            {category ? (
                <Badge variant="secondary" className="capitalize">
                    {String(category)}
                </Badge>
            ) : null}
            {priority ? (
                <Badge variant="outline" className="capitalize">
                    Priority: {String(priority)}
                </Badge>
            ) : null}
            {pinned ? (
                <Badge variant="warning" className="inline-flex items-center gap-1">
                    <Pin className="h-3 w-3" aria-hidden="true" /> Pinned
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
        <div className="grid gap-2 sm:grid-cols-2">
            {stats.map(({ label, value }) => (
                <StatCard key={label} label={label} value={value} />
            ))}
        </div>
    );
}
