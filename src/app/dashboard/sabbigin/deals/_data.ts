import 'server-only';

/**
 * Server-side data loader for the SabBigin deals module. Reads `crm_deals`
 * scoped to the tenant + active pipeline, batch-resolves contact/account
 * names, and folds in the SabBigin pipeline-config stage governance so the
 * board can flag gated stages.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSabbiginConfig } from '@/app/actions/sabbigin.actions';
import { getSabbiginPipelineConfig } from '@/app/actions/sabbigin-pipeline-config.actions';
import type {
  SabDealRow,
  SabStage,
  SabPipelineSummary,
} from '@/components/sabbigin/lib/types';

export interface DealsModuleData {
  pipelines: SabPipelineSummary[];
  activePipelineId: string | null;
  activePipelineName: string;
  stages: SabStage[];
  deals: SabDealRow[];
  currency: string;
}

export async function loadDealsModule(opts: {
  pipelineParam?: string;
}): Promise<DealsModuleData> {
  const empty: DealsModuleData = {
    pipelines: [],
    activePipelineId: null,
    activePipelineName: 'Pipeline',
    stages: [],
    deals: [],
    currency: 'INR',
  };

  const session = await getSession();
  if (!session?.user?._id) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    const [rawPipelines, config] = await Promise.all([
      getCrmPipelines(),
      getSabbiginConfig(),
    ]);

    const pipelines: SabPipelineSummary[] = rawPipelines.map((p) => ({
      id: String(p.id),
      name: p.name,
      stageCount: p.stages?.length ?? 0,
    }));

    if (pipelines.length === 0) {
      return { ...empty, currency: config?.defaultCurrency || 'INR' };
    }

    const wanted =
      opts.pipelineParam ||
      (config?.pipelineId ? String(config.pipelineId) : null) ||
      pipelines[0].id;
    const active =
      rawPipelines.find((p) => String(p.id) === wanted) ?? rawPipelines[0];
    const activePipelineId = String(active.id);

    const govern = await getSabbiginPipelineConfig(activePipelineId);

    const stages: SabStage[] = (active.stages ?? []).map((s, i) => {
      const rule = govern?.stageRules?.[s.name];
      return {
        id: String(s.id ?? i),
        name: s.name,
        probability: typeof s.chance === 'number' ? s.chance : null,
        requiredFields: rule?.requiredFields ?? [],
        approvalRequired: !!rule?.approvalRequired,
      };
    });

    const docs = await db
      .collection('crm_deals')
      .find({ userId, pipelineId: activePipelineId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(500)
      .toArray();

    // batch-resolve names
    const contactIds = new Set<string>();
    const accountIds = new Set<string>();
    for (const d of docs) {
      if (Array.isArray(d.contactIds) && d.contactIds[0])
        contactIds.add(String(d.contactIds[0]));
      if (d.accountId) accountIds.add(String(d.accountId));
    }
    const [contacts, accounts] = await Promise.all([
      contactIds.size
        ? db
            .collection('crm_contacts')
            .find({
              _id: { $in: [...contactIds].map((id) => new ObjectId(id)) },
            })
            .project({ name: 1 })
            .toArray()
        : Promise.resolve([]),
      accountIds.size
        ? db
            .collection('crm_accounts')
            .find({
              _id: { $in: [...accountIds].map((id) => new ObjectId(id)) },
            })
            .project({ name: 1 })
            .toArray()
        : Promise.resolve([]),
    ]);
    const contactName = new Map(contacts.map((c) => [String(c._id), c.name as string]));
    const accountName = new Map(accounts.map((a) => [String(a._id), a.name as string]));

    const deals: SabDealRow[] = docs.map((d) => {
      const cid = d.contactIds?.[0] ? String(d.contactIds[0]) : null;
      const aid = d.accountId ? String(d.accountId) : null;
      return {
        _id: String(d._id),
        name: d.name ?? 'Untitled deal',
        description: d.description ?? null,
        accountId: aid,
        accountName: aid ? accountName.get(aid) ?? null : null,
        contactId: cid,
        contactName: cid ? contactName.get(cid) ?? null : null,
        amount: typeof d.value === 'number' ? d.value : null,
        currency: d.currency ?? config?.defaultCurrency ?? 'INR',
        stage: d.stage ?? stages[0]?.name ?? 'New',
        pipelineId: activePipelineId,
        ownerId: d.ownerId ? String(d.ownerId) : null,
        probability: typeof d.probability === 'number' ? d.probability : null,
        expectedClose: d.closeDate ? new Date(d.closeDate).toISOString() : null,
        priority: d.priority ?? null,
        tags: Array.isArray(d.labels) ? d.labels : [],
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
      };
    });

    return {
      pipelines,
      activePipelineId,
      activePipelineName: active.name,
      stages,
      deals,
      currency: config?.defaultCurrency || 'INR',
    };
  } catch (e) {
    console.error('[loadDealsModule] failed:', e);
    return empty;
  }
}
