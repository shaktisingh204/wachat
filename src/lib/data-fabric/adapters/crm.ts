/**
 * Read-only CRM adapter for the cross-module Data Fabric.
 *
 * CRM stores leads in the `crm_leads` collection (see
 * `src/lib/definitions.ts → CrmLead`). Each lead has a `userId` (the
 * tenant), an `email`, an optional `phone`, and a stable `_id` we project
 * as the `crm_lead_id` identity. Everything else (status, stage, owner,
 * value) becomes traits.
 */
import type { Collection, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { IdentityInput } from '../types';
import type { AdapterRow } from './wachat';

interface CrmLeadDoc extends Document {
  _id: ObjectId;
  userId?: ObjectId | string;
  contactName?: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: string;
  source?: string;
  pipelineId?: string;
  stage?: string;
  value?: number;
  currency?: string;
  assignedTo?: ObjectId | string;
}

const SOURCE = 'crm';

async function getCollection(): Promise<Collection<CrmLeadDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<CrmLeadDoc>('crm_leads');
}

function asString(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (v instanceof ObjectId) return v.toHexString();
  return String(v);
}

export function mapCrmLead(doc: CrmLeadDoc): AdapterRow | null {
  const tenantId = asString(doc.userId);
  if (!tenantId) return null;

  const identities: IdentityInput[] = [];
  identities.push({
    type: 'crm_lead_id',
    value: doc._id.toHexString(),
    source: SOURCE,
  });
  if (doc.email && doc.email.trim()) {
    identities.push({ type: 'email', value: doc.email, source: SOURCE });
  }
  if (doc.phone && doc.phone.trim()) {
    identities.push({ type: 'phone', value: doc.phone, source: SOURCE });
  }

  const traits: Record<string, unknown> = {};
  if (doc.status) traits.crm_status = doc.status;
  if (doc.source) traits.crm_source = doc.source;
  if (doc.pipelineId) traits.crm_pipeline_id = doc.pipelineId;
  if (doc.stage) traits.crm_stage = doc.stage;
  if (typeof doc.value === 'number') traits.crm_value = doc.value;
  if (doc.currency) traits.crm_currency = doc.currency;
  if (doc.company) traits.company = doc.company;
  if (doc.assignedTo) traits.crm_assigned_to = asString(doc.assignedTo);

  return {
    externalId: doc._id.toHexString(),
    tenantId,
    displayName: doc.contactName,
    identities,
    traits,
  };
}

export async function* iterateCrmLeads(
  tenantId: string,
  opts: { limit?: number } = {},
): AsyncIterableIterator<AdapterRow> {
  const col = await getCollection();
  const filter: Record<string, unknown> = ObjectId.isValid(tenantId)
    ? { $or: [{ userId: new ObjectId(tenantId) }, { userId: tenantId }] }
    : { userId: tenantId };

  const cursor = col.find(filter);
  if (opts.limit && opts.limit > 0) cursor.limit(opts.limit);

  let yielded = 0;
  for await (const doc of cursor) {
    const row = mapCrmLead(doc);
    if (row) {
      yielded++;
      yield row;
      if (opts.limit && yielded >= opts.limit) break;
    }
  }
}

export async function listCrmLeads(
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<AdapterRow[]> {
  const out: AdapterRow[] = [];
  for await (const row of iterateCrmLeads(tenantId, opts)) out.push(row);
  return out;
}

export const CRM_ADAPTER_SOURCE = SOURCE;
