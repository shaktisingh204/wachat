/**
 * Discussion detail — `/dashboard/crm/workspace/discussions/[id]`.
 *
 * Server component matching the canonical detail-page pattern from
 * `src/app/dashboard/crm/bookings/[id]/page.tsx`:
 *   - Header: eyebrow · title · status · 7-action menu (Edit/Lock/Pin/
 *     Reply/Archive/Activity/Delete).
 *   - Main column: Overview · Thread (replies + composer) · Files ·
 *     Moderation · Related, rendered as anchor-linked cards.
 *   - Right rail: key facts · participants snapshot · quick actions.
 *   - Footer: <EntityAuditTimeline /> via shell `audit` slot.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    EmptyState,
} from '@/components/sabcrm/20ui/compat';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

import {
    getDiscussionById,
    getDiscussionCategories,
    getDiscussionReplies,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
    WsDiscussion,
    WsDiscussionReply,
} from '@/lib/worksuite/knowledge-types';

import { DiscussionsDetailActions } from '../_components/discussions-detail-actions';
import { DiscussionsRepliesPanel } from '../_components/discussions-replies-panel';
import { fmtDate } from '../_components/discussions-shared';

export const dynamic = 'force-dynamic';

const STALE_AFTER_DAYS = 14;

function fmtDateTime(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function deriveStatus(
    discussion: WsDiscussion,
    replies: WsDiscussionReply[],
): { label: string; tone: EntityStatusTone } {
    if (replies.length === 0) {
        return { label: 'Open · no replies', tone: 'amber' };
    }
    const latestReplyMs = replies.reduce((max, r) => {
        const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        return t > max ? t : max;
    }, 0);
    const ageDays = (Date.now() - latestReplyMs) / (24 * 60 * 60 * 1000);
    if (ageDays > STALE_AFTER_DAYS) {
        return { label: 'Stale', tone: 'neutral' };
    }
    return { label: 'Active', tone: 'green' };
}

function lastActivity(
    discussion: WsDiscussion,
    replies: WsDiscussionReply[],
): string {
    const latestReplyMs = replies.reduce((max, r) => {
        const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        return t > max ? t : max;
    }, 0);
    const updatedMs = discussion.updatedAt
        ? new Date(discussion.updatedAt).getTime()
        : 0;
    const ms = Math.max(latestReplyMs, updatedMs);
    return ms ? new Date(ms).toLocaleString() : '—';
}

function uniqueParticipantIds(replies: WsDiscussionReply[]): string[] {
    const seen = new Set<string>();
    for (const r of replies) {
        if (r.user_id) seen.add(String(r.user_id));
    }
    return Array.from(seen);
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

function SectionNav() {
    const items = [
        { id: 'overview', label: 'Overview' },
        { id: 'thread', label: 'Thread' },
        { id: 'files', label: 'Files' },
        { id: 'moderation', label: 'Moderation' },
        { id: 'related', label: 'Related' },
    ];
    return (
        <nav
            aria-label="Discussion sections"
            className="flex flex-wrap gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1 text-[12.5px]"
        >
            {items.map((item, i) => (
                <a
                    key={item.id}
                    href={`#section-${item.id}`}
                    className={
                        i === 0
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

export default async function DiscussionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [d, categories, replies] = await Promise.all([
        getDiscussionById(id),
        getDiscussionCategories(),
        getDiscussionReplies(id),
    ]);
    if (!d) notFound();

    const cat = categories.find((c) => String(c._id) === String(d.category_id));
    const status = deriveStatus(d, replies);
    const participantIds = uniqueParticipantIds(replies);

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={d.title}
                eyebrow="DISCUSSION"
                status={status}
                back={{
                    href: '/dashboard/crm/workspace/discussions',
                    label: 'Back to discussions',
                }}
                actions={
                    <DiscussionsDetailActions discussionId={String(d._id)} />
                }
                audit={
                    <EntityAuditTimeline
                        entityKind="discussion"
                        entityId={String(d._id)}
                    />
                }
                rightRail={
                    <>
                        <Card>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Key facts</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <dl className="grid grid-cols-2 gap-y-1.5 text-[12.5px]">
                                    <dt className="text-[var(--st-text-secondary)]">Status</dt>
                                    <dd>
                                        <Badge variant="outline">
                                            {status.label}
                                        </Badge>
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Category</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {cat?.name ?? 'Uncategorized'}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Replies</dt>
                                    <dd className="text-[var(--st-text)]">{replies.length}</dd>
                                    <dt className="text-[var(--st-text-secondary)]">
                                        Participants
                                    </dt>
                                    <dd className="text-[var(--st-text)]">
                                        {participantIds.length}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Opened</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {fmtDate(d.createdAt)}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">
                                        Last activity
                                    </dt>
                                    <dd className="text-[var(--st-text)]">
                                        {lastActivity(d, replies)}
                                    </dd>
                                </dl>
                            </ZoruCardContent>
                        </Card>

                        <Card>
                            <ZoruCardHeader>
                                <ZoruCardTitle>
                                    Participants ({participantIds.length})
                                </ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                {participantIds.length === 0 ? (
                                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        No replies yet — the participant roster
                                        populates from the thread.
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-1.5">
                                        {participantIds.slice(0, 6).map((uid) => (
                                            <EntityPickerChip
                                                key={uid}
                                                entity="user"
                                                id={uid}
                                            />
                                        ))}
                                        {participantIds.length > 6 ? (
                                            <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                                                +{participantIds.length - 6} more
                                            </span>
                                        ) : null}
                                    </div>
                                )}
                            </ZoruCardContent>
                        </Card>

                        {d.project_id ? (
                            <Card>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>Project</ZoruCardTitle>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <EntityPickerChip
                                        entity="project"
                                        id={d.project_id}
                                    />
                                </ZoruCardContent>
                            </Card>
                        ) : null}

                        <Card>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Quick actions</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="flex flex-col gap-2 text-[12.5px]">
                                    <Button asChild variant="outline" size="sm">
                                        <a href="#section-thread">
                                            <MessageSquare className="h-3.5 w-3.5" />{' '}
                                            Jump to reply box
                                        </a>
                                    </Button>
                                    <Button asChild variant="ghost" size="sm">
                                        <Link
                                            href={`/dashboard/crm/workspace/discussions/${String(d._id)}/edit`}
                                        >
                                            Edit discussion
                                        </Link>
                                    </Button>
                                    <Button asChild variant="ghost" size="sm">
                                        <Link href="/dashboard/crm/workspace/discussions">
                                            All discussions
                                        </Link>
                                    </Button>
                                </div>
                            </ZoruCardContent>
                        </Card>
                    </>
                }
            >
                <SectionNav />

                <Card id="section-overview">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Overview</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge variant="ghost">
                                Category: {cat?.name ?? 'Uncategorized'}
                            </Badge>
                            <Badge variant="secondary">
                                Opened {fmtDate(d.createdAt)}
                            </Badge>
                            <Badge variant="outline">
                                {replies.length}{' '}
                                {replies.length === 1 ? 'reply' : 'replies'}
                            </Badge>
                        </div>
                        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--st-text)]">
                            {d.description || (
                                <span className="text-[var(--st-text-secondary)]">
                                    No description provided.
                                </span>
                            )}
                        </p>
                    </ZoruCardContent>
                </Card>

                <Card id="section-details">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Details</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Title">{d.title || '—'}</Field>
                            <Field label="Category">
                                {cat?.name ?? 'Uncategorized'}
                            </Field>
                            <Field label="Project">
                                {d.project_id ? (
                                    <EntityPickerChip
                                        entity="project"
                                        id={d.project_id}
                                    />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Replies">{replies.length}</Field>
                            <Field label="Participants">
                                {participantIds.length}
                            </Field>
                            <Field label="Last activity">
                                {lastActivity(d, replies)}
                            </Field>
                            <Field label="Created">
                                {fmtDateTime(d.createdAt)}
                            </Field>
                            <Field label="Updated">
                                {fmtDateTime(d.updatedAt ?? d.createdAt)}
                            </Field>
                        </div>
                    </ZoruCardContent>
                </Card>

                <div id="section-thread">
                    <DiscussionsRepliesPanel discussionId={String(d._id)} />
                </div>

                <Card id="section-files">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Files</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <EmptyState
                            title="No files attached"
                            description="A getDiscussionFiles() server action and SabFile picker integration land with the §1D.2 attachments roster."
                        />
                    </ZoruCardContent>
                </Card>

                <Card id="section-moderation">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Moderation</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                            Lock thread, pin reply, and mark solved actions are
                            wired through the header action menu (Lock / Pin /
                            Archive) and route to /edit until dedicated server
                            actions land (TODO 1D.2).
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={`/dashboard/crm/workspace/discussions/${String(d._id)}/edit`}
                                >
                                    Lock thread
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={`/dashboard/crm/workspace/discussions/${String(d._id)}/edit`}
                                >
                                    Pin reply
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={`/dashboard/crm/workspace/discussions/${String(d._id)}/edit`}
                                >
                                    Mark solved
                                </Link>
                            </Button>
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card id="section-related">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Related</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="flex flex-col gap-2 text-[12.5px]">
                            <Link
                                href="/dashboard/crm/workspace/discussions"
                                className="text-[var(--st-text)] hover:underline"
                            >
                                All discussions →
                            </Link>
                            {cat ? (
                                <Link
                                    href={`/dashboard/crm/workspace/discussions?category=${String(cat._id)}`}
                                    className="text-[var(--st-text)] hover:underline"
                                >
                                    More in {cat.name} →
                                </Link>
                            ) : null}
                            {d.project_id ? (
                                <Link
                                    href={`/dashboard/crm/projects/${d.project_id}`}
                                    className="text-[var(--st-text)] hover:underline"
                                >
                                    Open project →
                                </Link>
                            ) : null}
                        </div>
                    </ZoruCardContent>
                </Card>

                <p className="text-[11px] text-[var(--st-text-secondary)]">
                    Opened {fmtDate(d.createdAt)} · Last activity{' '}
                    {lastActivity(d, replies)}
                </p>
            </EntityDetailShell>
        </div>
    );
}
