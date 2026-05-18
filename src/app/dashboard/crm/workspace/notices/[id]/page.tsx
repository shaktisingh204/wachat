import { ZoruBadge, ZoruCard } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { Pin } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Notice detail — §1D.2 bar.
 */

import { getNoticeById } from '@/app/actions/worksuite/knowledge.actions';

import { NoticesDetailActions } from '../_components/notices-detail-actions';
import { fmtDate } from '../_components/notices-shared';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

export default async function NoticeDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const notice = await getNoticeById(id);
    if (!notice) notFound();

    const n = notice as any;

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={n.heading}
                eyebrow="NOTICE"
                back={{ href: '/dashboard/crm/workspace/notices', label: 'Back to notices' }}
                actions={<NoticesDetailActions noticeId={n._id} />}
                audit={<EntityAuditTimeline entityKind="notice" entityId={n._id} />}
                rightRail={
                    <ZoruCard>
                        <h3 className="mb-3 text-[13.5px] font-semibold text-zoru-ink">
                            Acknowledgement
                        </h3>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Tracking per-user reads. Use the table on the list page to see who
                            has and hasn’t opened this notice.
                        </p>
                        {/* TODO 1D.2: ack-table fetched per-notice — server action exists
                            only as per-user view; needs a `getNoticeAcknowledgements(noticeId)`
                            companion. */}
                    </ZoruCard>
                }
            >
                <ZoruCard>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <ZoruBadge variant="ghost" className="capitalize">
                            Audience: {n.notice_to}
                        </ZoruBadge>
                        {n.pinned ? (
                            <ZoruBadge variant="warning">
                                <Pin className="h-3 w-3" /> Pinned
                            </ZoruBadge>
                        ) : null}
                        <ZoruBadge variant="secondary">
                            Published {fmtDate(n.createdAt)}
                        </ZoruBadge>
                    </div>
                    <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-zoru-ink">
                        {n.description}
                    </div>
                </ZoruCard>
            </EntityDetailShell>
        </div>
    );
}
