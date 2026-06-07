/**
 * Notice detail — `/dashboard/crm/workspace/notices/[id]`.
 *
 * Server component matching the canonical detail-page pattern from
 * `src/app/dashboard/crm/bookings/[id]/page.tsx`:
 *   - Header: eyebrow · title · status · action menu.
 *   - Main column: Overview (body) · Comments · Attachments · Related
 *     sections rendered as anchor-linked cards (no Tabs per the
 *     no-tab-ui directive in ).
 *   - Right rail: key facts · counts · quick actions.
 *   - Footer: <EntityAuditTimeline /> via shell `audit` slot.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pin } from 'lucide-react';

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState } from '@/components/sabcrm/20ui';

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
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
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
            className="flex flex-wrap gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1 text-[12.5px]"
        >
            {items.map((item) => (
                <a
                    key={item.id}
                    href={`#section-${item.id}`}
                    className={
                        item.id === active
                            ? 'rounded-[calc(var(--st-radius)-2px)] bg-[var(--st-bg)] px-3 py-1.5 font-medium text-[var(--st-text)] shadow-sm'
                            : 'rounded-[calc(var(--st-radius)-2px)] px-3 py-1.5 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]'
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
                        <Card>
                            <CardHeader>
                                <CardTitle>Key facts</CardTitle>
                            </CardHeader>
                            <CardBody>
                                <dl className="grid grid-cols-2 gap-y-1.5 text-[12.5px]">
                                    <dt className="text-[var(--st-text-secondary)]">Status</dt>
                                    <dd>
                                        <Badge variant="outline">{status.label}</Badge>
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Audience</dt>
                                    <dd className="text-[var(--st-text)]">{audience}</dd>
                                    <dt className="text-[var(--st-text-secondary)]">Pinned</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {n.pinned ? 'Yes' : 'No'}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Attachments</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {fileAttached ? 'Yes' : 'No'}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Published</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {fmtDate(n.createdAt)}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Updated</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {fmtDate(n.updatedAt ?? n.createdAt)}
                                    </dd>
                                </dl>
                            </CardBody>
                        </Card>

                        {n.department_id ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Department</CardTitle>
                                </CardHeader>
                                <CardBody>
                                    <EntityPickerChip
                                        entity="department"
                                        id={n.department_id}
                                    />
                                </CardBody>
                            </Card>
                        ) : null}

                        {Array.isArray(n.employee_ids) && n.employee_ids.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        Recipients ({n.employee_ids.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardBody>
                                    <div className="flex flex-col gap-1.5">
                                        {n.employee_ids.slice(0, 8).map((eid) => (
                                            <EntityPickerChip
                                                key={eid}
                                                entity="user"
                                                id={eid}
                                            />
                                        ))}
                                        {n.employee_ids.length > 8 ? (
                                            <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                                                +{n.employee_ids.length - 8} more
                                            </span>
                                        ) : null}
                                    </div>
                                </CardBody>
                            </Card>
                        ) : null}

                        <Card>
                            <CardHeader>
                                <CardTitle>Quick actions</CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="flex flex-col gap-2 text-[12.5px]">
                                    <Button asChild variant="outline" size="sm">
                                        <Link
                                            href={`/dashboard/crm/workspace/notices/${String(n._id)}/edit`}
                                        >
                                            Edit notice
                                        </Link>
                                    </Button>
                                    <Button asChild variant="ghost" size="sm">
                                        <Link href="/dashboard/crm/workspace/notices">
                                            All notices
                                        </Link>
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>
                    </>
                }
            >
                <SectionNav active="overview" />

                <Card id="section-overview">
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <Badge variant="ghost">
                                Audience: {audience}
                            </Badge>
                            {n.pinned ? (
                                <Badge variant="warning">
                                    <Pin className="h-3 w-3" /> Pinned
                                </Badge>
                            ) : null}
                            <Badge variant="secondary">
                                Published {fmtDate(n.createdAt)}
                            </Badge>
                            {fileAttached ? (
                                <Badge variant="info">Attachments</Badge>
                            ) : null}
                        </div>
                        <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--st-text)]">
                            {n.description || (
                                <span className="text-[var(--st-text-secondary)]">
                                    No body content.
                                </span>
                            )}
                        </div>
                    </CardBody>
                </Card>

                <Card id="section-details">
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardBody>
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
                    </CardBody>
                </Card>

                <Card id="section-files">
                    <CardHeader>
                        <CardTitle>Attachments</CardTitle>
                    </CardHeader>
                    <CardBody>
                        {fileAttached ? (
                            <EmptyState
                                title="Attachments listing pending"
                                description="The notice is flagged as having attachments. A dedicated getNoticeFiles() endpoint will land with the §1D.2 file-roster server action."
                            />
                        ) : (
                            <EmptyState
                                title="No attachments"
                                description="Files attached during notice creation will appear here."
                            />
                        )}
                    </CardBody>
                </Card>

                <Card id="section-comments">
                    <CardHeader>
                        <CardTitle>Acknowledgements</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                            Per-user reads are tracked via markNoticeViewed; a
                            per-notice roster surfaces here once
                            getNoticeAcknowledgements() lands (TODO 1D.2).
                        </p>
                    </CardBody>
                </Card>

                <Card id="section-related">
                    <CardHeader>
                        <CardTitle>Related</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="flex flex-col gap-2 text-[12.5px]">
                            <Link
                                href="/dashboard/crm/workspace/notices"
                                className="text-[var(--st-text)] hover:underline"
                            >
                                All notices →
                            </Link>
                            <Link
                                href="/dashboard/sabconnect/announcements"
                                className="text-[var(--st-text)] hover:underline"
                            >
                                Announcements →
                            </Link>
                            {n.department_id ? (
                                <Link
                                    href={`/dashboard/crm/hr/departments/${n.department_id}`}
                                    className="text-[var(--st-text)] hover:underline"
                                >
                                    Owning department →
                                </Link>
                            ) : null}
                        </div>
                    </CardBody>
                </Card>

                <p className="text-[11px] text-[var(--st-text-secondary)]">
                    Created {fmtDate(n.createdAt)} · Updated{' '}
                    {fmtDate(n.updatedAt ?? n.createdAt)}
                </p>
            </EntityDetailShell>
        </div>
    );
}
