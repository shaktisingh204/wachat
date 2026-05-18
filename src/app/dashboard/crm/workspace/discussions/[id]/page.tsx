import { ZoruBadge, ZoruCard } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Discussion detail — §1D.2 bar.
 */

import {
    getDiscussionById,
    getDiscussionCategories,
} from '@/app/actions/worksuite/knowledge.actions';

import { DiscussionsDetailActions } from '../_components/discussions-detail-actions';
import { DiscussionsRepliesPanel } from '../_components/discussions-replies-panel';
import { fmtDate } from '../_components/discussions-shared';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

export default async function DiscussionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [d, categories] = await Promise.all([
        getDiscussionById(id),
        getDiscussionCategories(),
    ]);
    if (!d) notFound();

    const cat = categories.find((c) => String(c._id) === String(d.category_id));

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={d.title}
                eyebrow="DISCUSSION"
                back={{ href: '/dashboard/crm/workspace/discussions', label: 'Back to discussions' }}
                actions={<DiscussionsDetailActions discussionId={String(d._id)} />}
                audit={<EntityAuditTimeline entityKind="discussion" entityId={String(d._id)} />}
                rightRail={
                    <ZoruCard>
                        <h3 className="mb-2 text-[13.5px] font-semibold text-zoru-ink">
                            Participants
                        </h3>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Roster derived from replies once they arrive. The full participant
                            view will land with bulk-invite (TODO 1D.2).
                        </p>
                    </ZoruCard>
                }
            >
                <ZoruCard>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <ZoruBadge variant="ghost">
                            Category: {cat?.name ?? 'Uncategorized'}
                        </ZoruBadge>
                        <ZoruBadge variant="secondary">
                            Opened {fmtDate(d.createdAt)}
                        </ZoruBadge>
                    </div>
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-zoru-ink">
                        {d.description || 'No description.'}
                    </p>
                </ZoruCard>

                <div id="replies">
                    <DiscussionsRepliesPanel discussionId={String(d._id)} />
                </div>
            </EntityDetailShell>
        </div>
    );
}
