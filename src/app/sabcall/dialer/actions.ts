'use server';

/**
 * SabCall power dialer — project-scoped campaign CRUD (direct Mongo) plus a
 * launch action that originates a call per number through the voice engine.
 *
 * Tenanted by the active SabCall project id (stored in the `userId` field),
 * consistent with the trunks/contacts CRUD and exactly what `sabcall-engine`
 * reads. Direct Mongo (not the Rust crate) is the primary path because the
 * crate's `user_oid` scope keys off the JWT subject (the session user), which
 * would not isolate per project.
 */

import { makeSabcallResource } from '@/lib/sabcall/resource-crud';
import { getSabcallWorkspaceId } from '@/lib/sabcall/workspace';
import { sabcallEngine, sabcallEngineEnabled } from '@/lib/sabcall/engine-client';
import { getErrorMessage } from '@/lib/utils';

const resource = makeSabcallResource('sabcall_dialer_campaigns', {
  searchFields: ['name'],
  revalidate: '/sabcall/dialer',
});

export interface DialerCampaignDoc {
  _id: string;
  userId?: string;
  name: string;
  numbers: string[];
  callerId?: string;
  mode: string;
  amd: boolean;
  voicemailDrop?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DialerCampaignListParams = {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
};

export type DialerCampaignCreateInput = {
  name: string;
  numbers: string[];
  callerId?: string;
  mode: string;
  amd: boolean;
  voicemailDrop?: string;
  status?: string;
};

export type DialerCampaignUpdateInput = Partial<DialerCampaignCreateInput>;

export interface LaunchResult {
  success: true;
  queued: number;
  failed: number;
  total: number;
}

export async function listCampaigns(
  params?: DialerCampaignListParams,
): Promise<{ items: DialerCampaignDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: DialerCampaignDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createCampaign(
  input: DialerCampaignCreateInput,
): Promise<{ id: string; entity: DialerCampaignDoc }> {
  return (await resource.create(input)) as unknown as { id: string; entity: DialerCampaignDoc };
}

export async function updateCampaign(
  id: string,
  patch: DialerCampaignUpdateInput,
): Promise<DialerCampaignDoc | null> {
  return (await resource.update(id, patch)) as unknown as DialerCampaignDoc | null;
}

export async function deleteCampaign(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}

/**
 * Launch a power-dialer campaign: originate one call per number through the
 * voice engine, capped at 500 numbers per run. Counts queued vs. failed.
 */
export async function launchCampaign(
  id: string,
): Promise<LaunchResult | { success: false; error: string }> {
  try {
    const workspaceId = await getSabcallWorkspaceId();
    if (!workspaceId) return { success: false, error: 'No SabCall project selected.' };

    if (!sabcallEngineEnabled()) {
      return { success: false, error: 'The call engine is not enabled.' };
    }

    const list = await listCampaigns({ limit: 200 });
    const campaign = list.items.find((c) => c._id === id);
    if (!campaign) return { success: false, error: 'Campaign not found.' };

    const numbers = (Array.isArray(campaign.numbers) ? campaign.numbers : [])
      .map((n) => (typeof n === 'string' ? n.trim() : ''))
      .filter(Boolean)
      .slice(0, 500);

    let queued = 0;
    let failed = 0;
    for (const to of numbers) {
      try {
        await sabcallEngine.originate({
          tenant: workspaceId,
          to,
          callerId: campaign.callerId,
          amd: campaign.amd,
          voicemailDrop: campaign.voicemailDrop,
        });
        queued += 1;
      } catch {
        failed += 1;
      }
    }

    return { success: true, queued, failed, total: numbers.length };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}
