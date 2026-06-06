import { fmtDate } from '@/lib/utils';
import { Badge, Button, Card } from '@/components/sabcrm/20ui';
import {
  redirect } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  Edit,
  Paperclip,
  Users,
  } from 'lucide-react';

/**
 * HR Notice detail page.
 *
 * Server component that fetches a single notice via `getNoticeById` and
 * renders a stacked Card layout:
 *   1. Header — notice number, title, severity badge, status
 *   2. Body   — main notice text (whitespace preserved)
 *   3. Recipients
 *   4. Effective dates
 *   5. Attachments (SabFile refs rendered as download links)
 *   6. Acknowledgement count
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getNoticeById } from '@/app/actions/crm-notices.actions';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

/* ─── Tone maps ──────────────────────────────────────────────────────── */

const SEVERITY_TONE: Record<string, StatusTone> = {
    critical: 'red',
    warning: 'amber',
    info: 'blue',
};

const STATUS_TONE: Record<string, StatusTone> = {
    draft: 'neutral',
    issued: 'blue',
    acknowledged: 'green',
    superseded: 'amber',
    archived: 'red',
};

/* ─── Helpers ────────────────────────────────────────────────────────── */



function titleCase(s?: string | null): string {
    if (!s) return '—';
    return s
        .split('_')
        .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : ''))
        .join(' ');
}

function fileNameFromUrl(url: string): string {
    if (!url) return 'attachment';
    try {
        const path = new URL(url, 'http://x').pathname;
        const last = path.split('/').filter(Boolean).pop() ?? '';
        const decoded = decodeURIComponent(last);
        return decoded.replace(/^[0-9a-f]{16,}-/i, '') || decoded || 'attachment';
    } catch {
        return 'attachment';
    }
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default async function NoticeDetailPage({
    params,
}: {
    params: Promise<{ noticeId: string }>;
}) {
    const { noticeId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/dashboard/hrm/hr/notices');

    const notice = await getNoticeById(noticeId);
    if (!notice) redirect('/dashboard/hrm/hr/notices');

    const severityKey = String(notice.severity ?? 'info').toLowerCase();
    const statusKey = String(notice.status ?? 'draft').toLowerCase();

    const recipients = Array.isArray(notice.recipientIds)
        ? notice.recipientIds
        : [];
    const attachments = Array.isArray(notice.attachments)
        ? notice.attachments
        : [];
    const ackCount = notice.acknowledgementCount ?? 0;

    return (
        <EntityListShell
            title={notice.title}
            subtitle={`Notice ${notice.noticeNumber || notice._id.slice(-8)}`}
            primaryAction={
                <Button asChild>
                    <Link
                        href={`/dashboard/hrm/hr/notices/${notice._id}/edit`}
                    >
                        <Edit className="mr-1.5 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            {/* Header card: number / title / severity / status */}
            <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="font-mono text-[12px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                            {notice.noticeNumber || notice._id.slice(-8)}
                        </div>
                        <h2 className="mt-1 text-[20px] font-medium text-[var(--st-text)]">
                            {notice.title}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                            <span>
                                Category: {titleCase(notice.category as string)}
                            </span>
                            <span aria-hidden>·</span>
                            <span>
                                Audience: {titleCase(notice.issuedTo as string)}
                            </span>
                            {notice.referenceNumber ? (
                                <>
                                    <span aria-hidden>·</span>
                                    <span>
                                        Ref:{' '}
                                        <span className="font-mono text-[var(--st-text)]">
                                            {notice.referenceNumber}
                                        </span>
                                    </span>
                                </>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <StatusPill
                            label={titleCase(notice.severity as string)}
                            tone={SEVERITY_TONE[severityKey] ?? 'neutral'}
                        />
                        <StatusPill
                            label={titleCase(notice.status)}
                            tone={STATUS_TONE[statusKey] ?? 'neutral'}
                        />
                        {notice.requireAcknowledgement ? (
                            <Badge variant="info">
                                Acknowledgement required
                            </Badge>
                        ) : null}
                    </div>
                </div>
            </Card>

            {/* Body */}
            <Card className="p-6">
                <div className="mb-3 text-[14px] font-medium text-[var(--st-text)]">
                    Notice body
                </div>
                <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--st-text)]">
                    {notice.body || (
                        <span className="text-[var(--st-text-secondary)]">
                            No body provided.
                        </span>
                    )}
                </div>
            </Card>

            {/* Recipients */}
            <Card className="p-6">
                <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    <span className="text-[14px] font-medium text-[var(--st-text)]">
                        Recipients
                    </span>
                    <span className="ml-auto text-[12px] text-[var(--st-text-secondary)]">
                        {titleCase(notice.issuedTo as string)} ·{' '}
                        {recipients.length} explicit recipient
                        {recipients.length === 1 ? '' : 's'}
                    </span>
                </div>
                {recipients.length === 0 ? (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-4 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        {notice.issuedTo === 'all'
                            ? 'Notice is published to all employees.'
                            : 'No explicit recipient list — resolved by audience.'}
                    </div>
                ) : (
                    <ul className="flex flex-wrap gap-2">
                        {recipients.map((r, i) => (
                            <li key={`${r}-${i}`}>
                                <Badge variant="secondary">{r}</Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {/* Effective dates + acknowledgement */}
            <Card className="p-6">
                <div className="mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    <span className="text-[14px] font-medium text-[var(--st-text)]">
                        Effective dates
                    </span>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Effective from</div>
                        <div className="text-[var(--st-text)]">
                            {fmtDate(notice.effectiveFrom)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Effective until</div>
                        <div className="text-[var(--st-text)]">
                            {fmtDate(notice.effectiveUntil)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Issued at</div>
                        <div className="text-[var(--st-text)]">
                            {fmtDate(notice.issuedAt ?? notice.createdAt)}
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[13px]">
                    <CheckCircle2 className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    <span className="text-[var(--st-text-secondary)]">
                        Acknowledgements:
                    </span>
                    <span className="font-medium text-[var(--st-text)]">
                        {ackCount} recipient{ackCount === 1 ? '' : 's'}
                    </span>
                </div>
            </Card>

            {/* Attachments */}
            <Card className="p-6">
                <div className="mb-3 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    <span className="text-[14px] font-medium text-[var(--st-text)]">
                        Attachments
                    </span>
                    <span className="ml-auto text-[12px] text-[var(--st-text-secondary)]">
                        {attachments.length} file
                        {attachments.length === 1 ? '' : 's'}
                    </span>
                </div>
                {attachments.length === 0 ? (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-4 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No attachments.
                    </div>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {attachments.map((url, i) => (
                            <li
                                key={`${url}-${i}`}
                                className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2"
                            >
                                <Paperclip className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" />
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    className="min-w-0 flex-1 truncate text-[13px] text-[var(--st-text)] hover:underline"
                                >
                                    {fileNameFromUrl(url)}
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {notice.notes ? (
                <Card className="p-6">
                    <div className="mb-2 text-[14px] font-medium text-[var(--st-text)]">
                        Internal notes
                    </div>
                    <div className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                        {notice.notes}
                    </div>
                </Card>
            ) : null}
        </EntityListShell>
    );
}
