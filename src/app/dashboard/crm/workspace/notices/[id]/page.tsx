/**
 * Notice detail — `/dashboard/crm/workspace/notices/[id]`.
 *
 * Server component matching the canonical detail-page pattern from
 * `src/app/dashboard/crm/bookings/[id]/page.tsx`:
 *   - Header: eyebrow · title · status · action menu.
 *   - Main column: Overview (body) · Comments · Attachments · Related
 *     sections rendered as anchor-linked cards (no ZoruTabs per the
 *     no-tab-ui directive in zoruui).
 *   - Right rail: key facts · counts · quick actions.
 *   - Footer: <EntityAuditTimeline /> via shell `audit` slot.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pin } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruEmptyState,
} from '@/components/zoruui';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

import { getNoticeById } from '@/app/actions/worksuite/knowledge.actions';
import type { WsNotice } from '@/lib/worksuite/knowledge-types';

import { NoticesDetailActions } from '../_components/notices-detail-actions';
import { fmtDate } from '../_components/notices-shared';

export const dynamic = 'force-dynamic';

const NOTICE_ACTIVE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function fmtDateTime(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function deriveStatus(notice: WsNotice): {
    label: string;
    tone: EntityStatusTone;
} {
    const created = notice.createdAt ? new Date(notice.createdAt) : null;
    const ageMs =
        created && !Number.isNaN(created.getTime())
            ? Date.now() - created.getTime()
            : 0;
    if (ageMs > NOTICE_ACTIVE_MAX_AGE_MS) {
        return { label: 'Expired', tone: 'neutral' };
    }
    if (notice.pinned) return { label: 'Pinned', tone: 'amber' };
    return { label: 'Active', tone: 'green' };
}

function audienceLabel(audience: WsNotice['notice_to']): string {
    switch (audience) {
        case 'all':
            return 'Everyone';
        case 'department':
            return 'Department';
        case 'employee':
            return 'Specific employees';
        default:
            return String(audience ?? '—');
    }
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

function SectionNav({ active }: { active: 'overview' | 'comments' | 'files' | 'related' }) {
    const items: { id: typeof active; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'comments', label: 'Activity' },
        { id: 'files', label: 'Attachments' },
        { id: 'related', label: 'Related' },
    ];
    return (
        <nav
            aria-label="Notice sections"
            className="flex flex-wrap gap-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-1 text-[12.5px]"
        >
            {items.map((item) => (
                <a
                    key={item.id}
                    href={`#section-${item.id}`}
                    className={
                        item.id === active
                            ? 'rounded-[calc(var(--zoru-radius)-2px)] bg-zoru-bg px-3 py-1.5 font-medium text-zoru-ink shadow-sm'
                            : 'rounded-[calc(var(--zoru-radius)-2px)] px-3 py-1.5 text-zoru-ink-muted hover:text-zoru-ink'
                    }
                >
                    {item.label}
                </a>
            ))}
        </nav>
    );
}

export default async function NoticeDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const notice = await getNoticeById(id);
    if (!notice) notFound();

    const n = notice;
    const status = deriveStatus(n);
    const fileAttached = Boolean(n.file_attached);
    const audience = audienceLabel(n.notice_to);

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={n.heading}
                eyebrow="NOTICE"
                status={status}
                back={{
                    href: '/dashboard/crm/workspace/notices',
                    label: 'Back to notices',
                }}
                actions={<NoticesDetailActions noticeId={String(n._id)} />}
                audit={
                    <EntityAuditTimeline
                        entityKind="notice"
                        entityId={String(n._id)}
                    />
                }
                rightRail={
                    <>
                        <ZoruCard>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Key facts</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <dl className="grid grid-cols-2 gap-y-1.5 text-[12.5px]">
                                    <dt className="text-zoru-ink-muted">Status</dt>
                                    <dd>
                                        <ZoruBadge variant="outline">{status.label}</ZoruBadge>
                                    </dd>
                                    <dt className="text-zoru-ink-muted">Audience</dt>
                                    <dd className="text-zoru-ink">{audience}</dd>
                                    <dt className="text-zoru-ink-muted">Pinned</dt>
                                    <dd className="text-zoru-ink">
                                        {n.pinned ? 'Yes' : 'No'}
                                    </dd>
                                    <dt className="text-zoru-ink-muted">Attachments</dt>
                                    <dd className="text-zoru-ink">
                                        {fileAttached ? 'Yes' : 'No'}
                                    </dd>
                                    <dt className="text-zoru-ink-muted">Published</dt>
                                    <dd className="text-zoru-ink">
                                        {fmtDate(n.createdAt)}
                                    </dd>
                                    <dt className="text-zoru-ink-muted">Updated</dt>
                                    <dd className="text-zoru-ink">
                                        {fmtDate(n.updatedAt ?? n.createdAt)}
                                    </dd>
                                </dl>
                            </ZoruCardContent>
                        </ZoruCard>

                        {n.department_id ? (
                            <ZoruCard>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>Department</ZoruCardTitle>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <EntityPickerChip
                                        entity="department"
                                        id={n.department_id}
                                    />
                                </ZoruCardContent>
                            </ZoruCard>
                        ) : null}

                        {Array.isArray(n.employee_ids) && n.employee_ids.length > 0 ? (
                            <ZoruCard>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>
                                        Recipients ({n.employee_ids.length})
                                    </ZoruCardTitle>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <div className="flex flex-col gap-1.5">
                                        {n.employee_ids.slice(0, 8).map((eid) => (
                                            <EntityPickerChip
                                                key={eid}
                                                entity="user"
                                                id={eid}
                                            />
                                        ))}
                                        {n.employee_ids.length > 8 ? (
                                            <span className="text-[11.5px] text-zoru-ink-muted">
                                                +{n.employee_ids.length - 8} more
                                            </span>
                                        ) : null}
                                    </div>
                                </ZoruCardContent>
                            </ZoruCard>
                        ) : null}

                        <ZoruCard>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Quick actions</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="flex flex-col gap-2 text-[12.5px]">
                                    <ZoruButton asChild variant="outline" size="sm">
                                        <Link
                                            href={`/dashboard/crm/workspace/notices/${String(n._id)}/edit`}
                                        >
                                            Edit notice
                                        </Link>
                                    </ZoruButton>
                                    <ZoruButton asChild variant="ghost" size="sm">
                                        <Link href="/dashboard/crm/workspace/notices">
                                            All notices
                                        </Link>
                                    </ZoruButton>
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>
                    </>
                }
            >
                <SectionNav active="overview" />

                <ZoruCard id="section-overview">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Overview</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <ZoruBadge variant="ghost">
                                Audience: {audience}
                            </ZoruBadge>
                            {n.pinned ? (
                                <ZoruBadge variant="warning">
                                    <Pin className="h-3 w-3" /> Pinned
                                </ZoruBadge>
                            ) : null}
                            <ZoruBadge variant="secondary">
                                Published {fmtDate(n.createdAt)}
                            </ZoruBadge>
                            {fileAttached ? (
                                <ZoruBadge variant="info">Attachments</ZoruBadge>
                            ) : null}
                        </div>
                        <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-zoru-ink">
                            {n.description || (
                                <span className="text-zoru-ink-muted">
                                    No body content.
                                </span>
                            )}
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard id="section-details">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Details</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Headline">{n.heading || '—'}</Field>
                            <Field label="Audience">{audience}</Field>
                            <Field label="Pinned">{n.pinned ? 'Yes' : 'No'}</Field>
                            <Field label="Has attachments">
                                {fileAttached ? 'Yes' : 'No'}
                            </Field>
                            <Field label="Created">
                                {fmtDateTime(n.createdAt)}
                            </Field>
                            <Field label="Last updated">
                                {fmtDateTime(n.updatedAt ?? n.createdAt)}
                            </Field>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard id="section-files">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Attachments</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {fileAttached ? (
                            <ZoruEmptyState
                                title="Attachments listing pending"
                                description="The notice is flagged as having attachments. A dedicated getNoticeFiles() endpoint will land with the §1D.2 file-roster server action."
                            />
                        ) : (
                            <ZoruEmptyState
                                title="No attachments"
                                description="Files attached during notice creation will appear here."
                            />
                        )}
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard id="section-comments">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Acknowledgements</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Per-user reads are tracked via markNoticeViewed; a
                            per-notice roster surfaces here once
                            getNoticeAcknowledgements() lands (TODO 1D.2).
                        </p>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard id="section-related">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Related</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="flex flex-col gap-2 text-[12.5px]">
                            <Link
                                href="/dashboard/crm/workspace/notices"
                                className="text-zoru-primary hover:underline"
                            >
                                All notices →
                            </Link>
                            <Link
                                href="/dashboard/crm/workspace/announcements"
                                className="text-zoru-primary hover:underline"
                            >
                                Announcements →
                            </Link>
                            {n.department_id ? (
                                <Link
                                    href={`/dashboard/crm/hr/departments/${n.department_id}`}
                                    className="text-zoru-primary hover:underline"
                                >
                                    Owning department →
                                </Link>
                            ) : null}
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <p className="text-[11px] text-zoru-ink-muted">
                    Created {fmtDate(n.createdAt)} · Updated{' '}
                    {fmtDate(n.updatedAt ?? n.createdAt)}
                </p>
            </EntityDetailShell>
        </div>
    );
}
