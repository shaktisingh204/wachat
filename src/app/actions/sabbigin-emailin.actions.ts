'use server';

/**
 * SabBigin Email-In — pipeline email aliases on top of **SabMail**.
 *
 * A tenant creates a SabMail alias (e.g. `sales@theirdomain.com`) and maps it
 * to a SabBigin pipeline. Inbound mail to that alias is captured by SabMail;
 * the SabBigin mapping (stored in `crm_email_aliases`) records which pipeline a
 * captured message should open a deal in. (The inbound→deal worker consumes
 * this mapping via the shared email-inbound path.)
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  listMailDomains,
  listMailAccounts,
  listMailAliases,
  createMailAlias,
  deleteMailAlias,
} from '@/app/actions/mailbox.actions';

const COLL = 'crm_email_aliases';

export interface EmailInMapping {
  aliasId: string;
  sourceAddress: string;
  pipelineId: string;
  stageId?: string | null;
  createDeal: boolean;
}

export interface SabbiginEmailInData {
  domains: { id: string; domain: string; verified: boolean }[];
  accounts: { id: string; address: string }[];
  aliases: {
    id: string;
    sourceAddress: string;
    pipelineId?: string | null;
    createDeal?: boolean;
  }[];
  hasDomain: boolean;
}

export async function getSabbiginEmailIn(): Promise<SabbiginEmailInData> {
  const empty: SabbiginEmailInData = {
    domains: [],
    accounts: [],
    aliases: [],
    hasDomain: false,
  };
  const session = await getSession();
  if (!session?.user?._id) return empty;

  try {
    const [domains, accounts, aliases] = await Promise.all([
      listMailDomains().catch(() => []),
      listMailAccounts({ status: 'active', limit: 50 }).catch(() => []),
      listMailAliases().catch(() => []),
    ]);

    const { db } = await connectToDatabase();
    const mappings = await db
      .collection(COLL)
      .find({ userId: new ObjectId(session.user._id) })
      .toArray();
    const mapBySource = new Map(
      mappings.map((m) => [String(m.sourceAddress), m]),
    );

    return {
      domains: domains.map((d) => ({
        id: String(d._id),
        domain: d.domain,
        verified: d.mxStatus === 'verified',
      })),
      accounts: accounts.map((a) => ({
        id: String(a._id),
        address: a.emailAddress ?? a.localPart,
      })),
      aliases: aliases.map((al) => {
        const m = mapBySource.get(String(al.sourceAddress));
        return {
          id: String(al._id),
          sourceAddress: al.sourceAddress,
          pipelineId: m ? String(m.pipelineId) : null,
          createDeal: m ? !!m.createDeal : false,
        };
      }),
      hasDomain: domains.length > 0,
    };
  } catch (e) {
    console.error('[getSabbiginEmailIn] failed:', e);
    return empty;
  }
}

export async function createSabbiginEmailInAlias(input: {
  domainId: string;
  localPart: string;
  targetAccountId?: string;
  pipelineId: string;
  stageId?: string;
  createDeal?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  const local = input.localPart.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!local) return { success: false, error: 'Alias name required' };
  if (!input.domainId) return { success: false, error: 'Pick a domain' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    // resolve the domain string to build the full source address
    const domains = await listMailDomains();
    const domain = domains.find((d) => String(d._id) === input.domainId);
    const sourceAddress = `${local}@${domain?.domain ?? ''}`;

    const created = await createMailAlias({
      domainId: input.domainId,
      sourceAddress,
      targetAccountIds: input.targetAccountId ? [input.targetAccountId] : [],
    });
    if (!created.ok) return { success: false, error: created.error };

    // SabBigin pipeline mapping (token is the routing key for the inbound worker)
    const token = `${local}-${created.id}`.slice(0, 64);
    await db.collection(COLL).updateOne(
      { userId, sourceAddress },
      {
        $set: {
          userId,
          aliasId: created.id,
          sourceAddress,
          token,
          pipelineId: input.pipelineId,
          stageId: input.stageId ?? null,
          createDeal: input.createDeal ?? true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    revalidatePath('/dashboard/sabbigin/settings/email-in');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to create alias' };
  }
}

export async function deleteSabbiginEmailInAlias(
  aliasId: string,
  sourceAddress: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  try {
    await deleteMailAlias(aliasId);
    const { db } = await connectToDatabase();
    await db
      .collection(COLL)
      .deleteOne({ userId: new ObjectId(session.user._id), sourceAddress });
    revalidatePath('/dashboard/sabbigin/settings/email-in');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed' };
  }
}
