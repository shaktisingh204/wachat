/**
 * Internal KB article detail — `/dashboard/crm/workspace/knowledge-base/[id]`.
 *
 * Server component matching the canonical detail-page pattern from
 * `src/app/dashboard/crm/bookings/[id]/page.tsx`:
 *   - Header: eyebrow · title · status (Published / Draft) · 9-action menu.
 *   - Main column: Overview · Body · Files · Helpfulness · Versions ·
 *     Related, rendered as anchor-linked cards.
 *   - Right rail: key facts · category · author · quick actions.
 *   - Footer: <EntityAuditTimeline /> via shell `audit` slot.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckSquare, FileText, Pin } from 'lucide-react';

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState } from '@/components/sabcrm/20ui';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

import {
    getKnowledgeBaseById,
    getKnowledgeBaseCategories,
    getKnowledgeBaseFiles,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
    WsKnowledgeBase,
    WsKnowledgeBaseFile,
} from '@/lib/worksuite/knowledge-types';

import { KbInternalDetailActions } from '../_components/kb-internal-detail-actions';
import { fmtDate } from '../_components/kb-internal-shared';

export const dynamic = 'force-dynamic';

function fmtDateTime(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtBytes(bytes?: number): string {
    if (!bytes || !Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function deriveStatus(article: WsKnowledgeBase): {
    label: string;
    tone: EntityStatusTone;
} {
    if (article.pinned) return { label: 'Published', tone: 'green' };
    return { label: 'Draft', tone: 'amber' };
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
        { id: 'body', label: 'Body' },
        { id: 'files', label: 'Files' },
        { id: 'helpfulness', label: 'Helpfulness' },
        { id: 'versions', label: 'Versions' },
        { id: 'related', label: 'Related' },
    ];
    return (
        <nav
            aria-label="Article sections"
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

export default async function KnowledgeBaseDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [article, categories, files] = await Promise.all([
        getKnowledgeBaseById(id),
        getKnowledgeBaseCategories(),
        getKnowledgeBaseFiles(id),
    ]);
    if (!article) notFound();

    const a = article;
    const category = categories.find(
        (c) => String(c._id) === String(a.category_id),
    );
    const status = deriveStatus(a);
    const fileList = (files as WsKnowledgeBaseFile[]) ?? [];

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={a.title}
                eyebrow={category ? `KB · ${category.name}` : 'KB · Uncategorized'}
                status={status}
                back={{
                    href: '/dashboard/crm/workspace/knowledge-base',
                    label: 'Back to KB',
                }}
                actions={
                    <KbInternalDetailActions
                        id={String(a._id)}
                        pinned={!!a.pinned}
                    />
                }
                audit={
                    <EntityAuditTimeline
                        entityKind="knowledge_base"
                        entityId={String(a._id)}
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
                                        <Badge variant="outline">
                                            {status.label}
                                        </Badge>
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Type</dt>
                                    <dd className="text-[var(--st-text)] capitalize">
                                        {a.type ?? '—'}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Category</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {category?.name ?? '—'}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">To-do</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {a.to_do === 'yes' ? 'Yes' : 'No'}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Pinned</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {a.pinned ? 'Yes' : 'No'}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">
                                        Attachments
                                    </dt>
                                    <dd className="text-[var(--st-text)]">
                                        {fileList.length}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Created</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {fmtDate(a.createdAt)}
                                    </dd>
                                    <dt className="text-[var(--st-text-secondary)]">Updated</dt>
                                    <dd className="text-[var(--st-text)]">
                                        {fmtDate(a.updatedAt ?? a.createdAt)}
                                    </dd>
                                </dl>
                            </CardBody>
                        </Card>

                        {a.userId ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Author</CardTitle>
                                </CardHeader>
                                <CardBody>
                                    <EntityPickerChip
                                        entity="user"
                                        id={String(a.userId)}
                                    />
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
                                            href={`/dashboard/crm/workspace/knowledge-base/${String(a._id)}/edit`}
                                        >
                                            Edit article
                                        </Link>
                                    </Button>
                                    <Button asChild variant="ghost" size="sm">
                                        <Link href="/dashboard/crm/workspace/knowledge-base">
                                            All articles
                                        </Link>
                                    </Button>
                                    {category ? (
                                        <Button asChild variant="ghost" size="sm">
                                            <Link
                                                href={`/dashboard/crm/workspace/knowledge-base?category=${String(category._id)}`}
                                            >
                                                More in {category.name}
                                            </Link>
                                        </Button>
                                    ) : null}
                                </div>
                            </CardBody>
                        </Card>
                    </>
                }
            >
                <SectionNav />

                <Card id="section-overview">
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge variant="ghost" className="capitalize">
                                {a.type}
                            </Badge>
                            {a.pinned ? (
                                <Badge variant="warning">
                                    <Pin className="h-3 w-3" /> Pinned
                                </Badge>
                            ) : null}
                            {a.to_do === 'yes' ? (
                                <Badge variant="info">
                                    <CheckSquare className="h-3 w-3" /> To-do
                                </Badge>
                            ) : null}
                            {category ? (
                                <Badge variant="secondary">
                                    {category.name}
                                </Badge>
                            ) : null}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Title">{a.title || '—'}</Field>
                            <Field label="Type">
                                <span className="capitalize">{a.type ?? '—'}</span>
                            </Field>
                            <Field label="Category">
                                {category?.name ?? 'Uncategorized'}
                            </Field>
                            <Field label="Status">{status.label}</Field>
                            <Field label="Created">
                                {fmtDateTime(a.createdAt)}
                            </Field>
                            <Field label="Updated">
                                {fmtDateTime(a.updatedAt ?? a.createdAt)}
                            </Field>
                        </div>
                    </CardBody>
                </Card>

                <Card id="section-body">
                    <CardHeader>
                        <CardTitle>Body</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--st-text)]">
                            {a.description || (
                                <span className="text-[var(--st-text-secondary)]">
                                    No content. Use the Edit action to add a body.
                                </span>
                            )}
                        </div>
                    </CardBody>
                </Card>

                <Card id="section-files">
                    <CardHeader>
                        <CardTitle>
                            Attachments ({fileList.length})
                        </CardTitle>
                    </CardHeader>
                    <CardBody>
                        {fileList.length === 0 ? (
                            <EmptyState
                                title="No attachments"
                                description="Files uploaded with this article appear here. Upload via the Edit form using the SabFiles picker."
                            />
                        ) : (
                            <ul className="divide-y divide-[var(--st-border)]">
                                {fileList.map((f) => (
                                    <li
                                        key={String(f._id)}
                                        className="flex items-center justify-between gap-3 py-2.5"
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <FileText className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" />
                                            <div className="min-w-0">
                                                <p className="truncate text-[13px] text-[var(--st-text)]">
                                                    {f.filename || 'Untitled file'}
                                                </p>
                                                <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                                    {fmtBytes(f.size)} ·{' '}
                                                    {fmtDate(f.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        {f.url ? (
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="sm"
                                            >
                                                <a
                                                    href={f.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Download
                                                </a>
                                            </Button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>

                <Card id="section-helpfulness">
                    <CardHeader>
                        <CardTitle>Helpfulness</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                            Use the “Helpful” and “Not helpful” buttons in the
                            header action menu to record feedback. Persisted
                            helpfulness counters land with the §1D.2 schema
                            extension; for now votes surface as a toast
                            acknowledgement.
                        </p>
                    </CardBody>
                </Card>

                <Card id="section-versions">
                    <CardHeader>
                        <CardTitle>Version history</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <EmptyState
                            title="Version history coming soon"
                            description="Article revisions will be captured once the KB content store grows a versions sub-collection. The Activity timeline below already records create/update events."
                        />
                    </CardBody>
                </Card>

                <Card id="section-related">
                    <CardHeader>
                        <CardTitle>Related</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="flex flex-col gap-2 text-[12.5px]">
                            <Link
                                href="/dashboard/crm/workspace/knowledge-base"
                                className="text-[var(--st-text)] hover:underline"
                            >
                                All articles →
                            </Link>
                            {category ? (
                                <Link
                                    href={`/dashboard/crm/workspace/knowledge-base?category=${String(category._id)}`}
                                    className="text-[var(--st-text)] hover:underline"
                                >
                                    More in {category.name} →
                                </Link>
                            ) : null}
                            <Link
                                href="/dashboard/crm/workspace/knowledge-base/categories"
                                className="text-[var(--st-text)] hover:underline"
                            >
                                Manage categories →
                            </Link>
                        </div>
                    </CardBody>
                </Card>

                <p className="text-[11px] text-[var(--st-text-secondary)]">
                    Created {fmtDate(a.createdAt)} · Updated{' '}
                    {fmtDate(a.updatedAt ?? a.createdAt)}
                </p>
            </EntityDetailShell>
        </div>
    );
}
