/**
 * SabBigin pipeline view — single Kanban board.
 *
 * SabBigin tier limits the tenant to **one** pipeline (enforced via the
 * `sabbigin_config.pipelineLimit` field on the Rust side). The page picks the
 * pinned pipeline if `sabbigin_config.pipelineId` is set, otherwise falls
 * back to the first owned pipeline.
 *
 * Reuses the full Sales-CRM `DealKanban` island — same drag-to-stage
 * behaviour and the same `updateCrmDealStage` server action.
 */

import { ObjectId, type WithId } from 'mongodb';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';
import type { CrmDeal } from '@/lib/definitions';

import { DealKanban } from '@/app/dashboard/crm/sales-crm/deals/_components/deal-kanban';
import type { DealListRow } from '@/app/dashboard/crm/sales-crm/deals/_components/types';
import { getSabbiginConfig } from '@/app/actions/sabbigin.actions';

import { SabbiginNav } from '../_components/sabbigin-shell';

export const dynamic = 'force-dynamic';

function toRow(doc: WithId<CrmDeal>): DealListRow {
    return {
        _id: String(doc._id),
        name: doc.name ?? 'Untitled deal',
        description: doc.description,
        accountId: doc.accountId ? String(doc.accountId) : null,
        contactId: doc.contactIds?.[0] ? String(doc.contactIds[0]) : null,
        amount: typeof doc.value === 'number' ? doc.value : undefined,
        currency: doc.currency,
        stage: doc.stage,
        pipelineId: doc.pipelineId ?? null,
        ownerId: doc.ownerId ? String(doc.ownerId) : null,
        probability: typeof doc.probability === 'number' ? doc.probability : null,
        expectedClose: doc.closeDate ? new Date(doc.closeDate).toISOString() : null,
        priority: doc.priority,
        leadSource: doc.leadSource,
        campaign: doc.campaign,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
        tags: doc.labels,
    };
}

export default async function SabbiginPipelinePage() {
    const session = await getSession();

    let deals: DealListRow[] = [];
    let stages: string[] = getDealStagesForIndustry();
    let activePipelineName: string | null = null;

    if (session?.user?._id) {
        try {
            const { db } = await connectToDatabase();
            const userObjectId = new ObjectId(String(session.user._id));
            const config = await getSabbiginConfig();

            // Pick the pipeline SabBigin should surface.
            let pipelineDoc: any = null;
            if (config?.pipelineId && ObjectId.isValid(String(config.pipelineId))) {
                pipelineDoc = await db
                    .collection('crm_pipelines')
                    .findOne({ userId: userObjectId, _id: new ObjectId(String(config.pipelineId)) });
            }
            if (!pipelineDoc) {
                pipelineDoc = await db
                    .collection('crm_pipelines')
                    .findOne({ userId: userObjectId }, { sort: { createdAt: 1 } });
            }
            if (pipelineDoc) {
                activePipelineName = String(pipelineDoc.name ?? 'Pipeline');
                if (Array.isArray(pipelineDoc.stages) && pipelineDoc.stages.length > 0) {
                    stages = pipelineDoc.stages
                        .map((s: any) => (typeof s === 'string' ? s : s?.name))
                        .filter(Boolean);
                }
            }

            const filter: Record<string, unknown> = { userId: userObjectId };
            if (pipelineDoc?._id) {
                filter.pipelineId = String(pipelineDoc._id);
            }

            const docs = await db
                .collection<CrmDeal>('crm_deals')
                .find(filter as Record<string, unknown>)
                .sort({ createdAt: -1 })
                .limit(200)
                .toArray();

            deals = docs.map(toRow);
        } catch (e) {
            console.error('[sabbigin pipeline] failed:', e);
        }
    }

    return (
        <EntityListShell
            title={activePipelineName ?? 'Pipeline'}
            subtitle="Your single SabBigin pipeline. Drag deals between stages to update."
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/pipeline" />
                <DealKanban deals={deals} stages={stages} currency="INR" />
            </div>
        </EntityListShell>
    );
}
