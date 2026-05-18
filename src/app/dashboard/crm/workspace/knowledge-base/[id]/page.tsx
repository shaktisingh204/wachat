import { ZoruBadge, ZoruCard } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { CheckSquare,
  Pin } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Internal KB article detail — §1D.2 bar.
 */

import {
    getKnowledgeBaseById,
    getKnowledgeBaseCategories,
} from '@/app/actions/worksuite/knowledge.actions';

import { KbInternalDetailActions } from '../_components/kb-internal-detail-actions';
import { fmtDate } from '../_components/kb-internal-shared';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

export default async function KnowledgeBaseDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [article, categories] = await Promise.all([
        getKnowledgeBaseById(id),
        getKnowledgeBaseCategories(),
    ]);
    if (!article) notFound();
    const a = article as any;
    const category = categories.find((c) => String(c._id) === String(a.category_id));

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={a.title}
                eyebrow={category ? `KB · ${category.name}` : 'KB · Uncategorized'}
                status={{
                    label: a.pinned ? 'Published' : 'Draft',
                    tone: a.pinned ? 'green' : 'amber',
                }}
                back={{ href: '/dashboard/crm/workspace/knowledge-base', label: 'Back to KB' }}
                actions={<KbInternalDetailActions id={String(a._id)} pinned={!!a.pinned} />}
                audit={<EntityAuditTimeline entityKind="knowledge_base" entityId={String(a._id)} />}
                rightRail={
                    <ZoruCard>
                        <h3 className="mb-2 text-[13.5px] font-semibold text-zoru-ink">
                            Article details
                        </h3>
                        <dl className="grid grid-cols-2 gap-y-1 text-[12.5px]">
                            <dt className="text-zoru-ink-muted">Type</dt>
                            <dd className="text-zoru-ink capitalize">{a.type}</dd>
                            <dt className="text-zoru-ink-muted">Category</dt>
                            <dd className="text-zoru-ink">{category?.name ?? '—'}</dd>
                            <dt className="text-zoru-ink-muted">To-do</dt>
                            <dd className="text-zoru-ink">{a.to_do}</dd>
                            <dt className="text-zoru-ink-muted">Updated</dt>
                            <dd className="text-zoru-ink">{fmtDate(a.updatedAt ?? a.createdAt)}</dd>
                        </dl>
                    </ZoruCard>
                }
            >
                <ZoruCard>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <ZoruBadge variant="ghost" className="capitalize">
                            {a.type}
                        </ZoruBadge>
                        {a.pinned ? (
                            <ZoruBadge variant="warning">
                                <Pin className="h-3 w-3" /> Pinned
                            </ZoruBadge>
                        ) : null}
                        {a.to_do === 'yes' ? (
                            <ZoruBadge variant="info">
                                <CheckSquare className="h-3 w-3" /> To-do
                            </ZoruBadge>
                        ) : null}
                    </div>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[14px] leading-relaxed text-zoru-ink">
                        {a.description || 'No content.'}
                    </div>
                </ZoruCard>
            </EntityDetailShell>
        </div>
    );
}
