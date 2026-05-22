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

import {
    Badge,
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    EmptyState,
} from '@/components/zoruui';

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
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
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
            className="flex flex-wrap gap-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-1 text-[12.5px]"
        >
            {items.map((item, i) => (
                <a
                    key={item.id}
                    href={`#section-${item.id}`}
                    className={
                        i === 0
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
                            <ZoruCardHeader>
                                <ZoruCardTitle>Key facts</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <dl className="grid grid-cols-2 gap-y-1.5 text-[12.5px]">
                                    <dt className="text-zoru-ink-muted">Status</dt>
                                    <dd>
                                        <Badge variant="outline">
                                            {status.label}
                                        </Badge>
                                    </dd>
                                    <dt className="text-zoru-ink-muted">Type</dt>
                                    <dd className="text-zoru-ink capitalize">
                                        {a.type ?? '—'}
                                    </dd>
                                    <dt className="text-zoru-ink-muted">Category</dt>
                                    <dd className="text-zoru-ink">
                                        {category?.name ?? '—'}
                                    </dd>
                                    <dt className="text-zoru-ink-muted">To-do</dt>
                                    <dd className="text-zoru-ink">
                                        {a.to_do === 'yes' ? 'Yes' : 'No'}
                                    </dd>
                                    <dt className="text-zoru-ink-muted">Pinned</dt>
                                    <dd className="text-zoru-ink">
                                        {a.pinned ? 'Yes' : 'No'}
                                    </dd>
                                    <dt className="text-zoru-ink-muted">
                                        Attachments
                                    </dt>
                                    <dd className="text-zoru-ink">
                                        {fileList.length}
                                    </dd>
                                    <dt className="text-zoru-ink-muted">Created</dt>
                                    <dd className="text-zoru-ink">
                                        {fmtDate(a.createdAt)}
                                    </dd>
                                    <dt className="text-zoru-ink-muted">Updated</dt>
                                    <dd className="text-zoru-ink">
                                        {fmtDate(a.updatedAt ?? a.createdAt)}
                                    </dd>
                                </dl>
                            </ZoruCardContent>
                        </Card>

                        {a.userId ? (
                            <Card>
                                <ZoruCardHeader>
                                    <ZoruCardTitle>Author</ZoruCardTitle>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <EntityPickerChip
                                        entity="user"
                                        id={String(a.userId)}
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
                    </ZoruCardContent>
                </Card>

                <Card id="section-body">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Body</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[14px] leading-relaxed text-zoru-ink">
                            {a.description || (
                                <span className="text-zoru-ink-muted">
                                    No content. Use the Edit action to add a body.
                                </span>
                            )}
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card id="section-files">
                    <ZoruCardHeader>
                        <ZoruCardTitle>
                            Attachments ({fileList.length})
                        </ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {fileList.length === 0 ? (
                            <EmptyState
                                title="No attachments"
                                description="Files uploaded with this article appear here. Upload via the Edit form using the SabFiles picker."
                            />
                        ) : (
                            <ul className="divide-y divide-zoru-line">
                                {fileList.map((f) => (
                                    <li
                                        key={String(f._id)}
                                        className="flex items-center justify-between gap-3 py-2.5"
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <FileText className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                                            <div className="min-w-0">
                                                <p className="truncate text-[13px] text-zoru-ink">
                                                    {f.filename || 'Untitled file'}
                                                </p>
                                                <p className="text-[11.5px] text-zoru-ink-muted">
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
                    </ZoruCardContent>
                </Card>

                <Card id="section-helpfulness">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Helpfulness</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Use the “Helpful” and “Not helpful” buttons in the
                            header action menu to record feedback. Persisted
                            helpfulness counters land with the §1D.2 schema
                            extension; for now votes surface as a toast
                            acknowledgement.
                        </p>
                    </ZoruCardContent>
                </Card>

                <Card id="section-versions">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Version history</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <EmptyState
                            title="Version history coming soon"
                            description="Article revisions will be captured once the KB content store grows a versions sub-collection. The Activity timeline below already records create/update events."
                        />
                    </ZoruCardContent>
                </Card>

                <Card id="section-related">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Related</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="flex flex-col gap-2 text-[12.5px]">
                            <Link
                                href="/dashboard/crm/workspace/knowledge-base"
                                className="text-zoru-primary hover:underline"
                            >
                                All articles →
                            </Link>
                            {category ? (
                                <Link
                                    href={`/dashboard/crm/workspace/knowledge-base?category=${String(category._id)}`}
                                    className="text-zoru-primary hover:underline"
                                >
                                    More in {category.name} →
                                </Link>
                            ) : null}
                            <Link
                                href="/dashboard/crm/workspace/knowledge-base/categories"
                                className="text-zoru-primary hover:underline"
                            >
                                Manage categories →
                            </Link>
                        </div>
                    </ZoruCardContent>
                </Card>

                <p className="text-[11px] text-zoru-ink-muted">
                    Created {fmtDate(a.createdAt)} · Updated{' '}
                    {fmtDate(a.updatedAt ?? a.createdAt)}
                </p>
            </EntityDetailShell>
        </div>
    );
}
