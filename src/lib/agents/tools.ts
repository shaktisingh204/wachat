/**
 * Built-in tools available to all agents.
 *
 * Each tool is a thin Mongo-backed wrapper. They do NOT call external
 * services here — sending WhatsApp, for example, is recorded by inserting
 * into `outgoing_messages` (the existing webhook-processor pattern). The
 * actual delivery happens in the broadcast worker.
 *
 * Tools are registered into the agent tool registry at module init.
 */

import 'server-only';

import { ObjectId } from 'mongodb';
import { z } from 'genkit';

import { connectToDatabase } from '@/lib/mongodb';
import { registerTool } from './registry';
import type { AnyTool, Tool } from './types';

/* ------------------------------------------------------------------ */
/* search_contacts                                                     */
/* ------------------------------------------------------------------ */

const SearchContactsInput = z.object({
  query: z
    .string()
    .min(1)
    .describe('Free-text query matched against name, phone (waId), or email.'),
  limit: z.number().int().min(1).max(50).default(10),
  tag: z.string().optional().describe('Optional tag filter.'),
});

export const searchContactsTool: Tool<typeof SearchContactsInput, unknown> = {
  name: 'search_contacts',
  description:
    'Search the CRM contacts collection by name, phone, or email. Returns up to `limit` matching contacts.',
  parameters: SearchContactsInput,
  async run(args, ctx) {
    const { db } = await connectToDatabase();
    const re = new RegExp(escapeRegex(args.query), 'i');
    const filter: Record<string, unknown> = {
      $or: [{ name: re }, { waId: re }, { phone: re }, { email: re }],
    };
    if (ctx.tenantId) filter.userId = toObjectIdSafe(ctx.tenantId);
    if (args.tag) filter.tags = args.tag;

    const rows = await db
      .collection('contacts')
      .find(filter, {
        projection: { name: 1, waId: 1, phone: 1, email: 1, tags: 1, lastMessage: 1 },
      })
      .limit(args.limit)
      .toArray();
    return { count: rows.length, contacts: rows };
  },
};

/* ------------------------------------------------------------------ */
/* send_whatsapp                                                       */
/* ------------------------------------------------------------------ */

const SendWhatsappInput = z.object({
  waId: z.string().min(5).describe('Recipient WhatsApp phone number (E.164 digits, no plus).'),
  text: z.string().min(1).max(4096),
  /** Optional projectId — required for the broadcast worker to actually send. */
  projectId: z.string().optional(),
});

export const sendWhatsappTool: Tool<typeof SendWhatsappInput, unknown> = {
  name: 'send_whatsapp',
  description:
    'Queue a WhatsApp text message to a contact. The message is recorded in `outgoing_messages` and dispatched by the broadcast worker.',
  parameters: SendWhatsappInput,
  async run(args, ctx) {
    const { db } = await connectToDatabase();
    const doc = {
      waId: args.waId,
      text: args.text,
      type: 'text' as const,
      status: 'QUEUED' as const,
      source: 'agent' as const,
      agentId: ctx.agentId,
      runId: ctx.runId,
      userId: toObjectIdSafe(ctx.tenantId),
      projectId: toObjectIdSafe(args.projectId),
      createdAt: new Date(),
    };
    const res = await db.collection('outgoing_messages').insertOne(doc);
    return { ok: true, messageId: res.insertedId.toString() };
  },
};

/* ------------------------------------------------------------------ */
/* create_crm_deal                                                     */
/* ------------------------------------------------------------------ */

const CreateCrmDealInput = z.object({
  title: z.string().min(1).max(200),
  contactId: z.string().describe('Contact _id to associate the deal with.'),
  amount: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('USD'),
  stage: z.string().default('lead'),
  notes: z.string().optional(),
});

export const createCrmDealTool: Tool<typeof CreateCrmDealInput, unknown> = {
  name: 'create_crm_deal',
  description: 'Create a CRM deal record linked to an existing contact.',
  parameters: CreateCrmDealInput,
  async run(args, ctx) {
    const { db } = await connectToDatabase();
    const doc = {
      title: args.title,
      contactId: toObjectIdSafe(args.contactId),
      amount: args.amount,
      currency: args.currency.toUpperCase(),
      stage: args.stage,
      notes: args.notes,
      userId: toObjectIdSafe(ctx.tenantId),
      createdBy: toObjectIdSafe(ctx.userId),
      source: 'agent',
      agentId: ctx.agentId,
      runId: ctx.runId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const res = await db.collection('crm_deals').insertOne(doc);
    return { ok: true, dealId: res.insertedId.toString() };
  },
};

/* ------------------------------------------------------------------ */
/* query_analytics                                                     */
/* ------------------------------------------------------------------ */

const QueryAnalyticsInput = z.object({
  metric: z
    .enum([
      'messages_sent',
      'messages_received',
      'broadcasts_sent',
      'deals_created',
      'contacts_added',
    ])
    .describe('Pre-defined metric key.'),
  windowDays: z.number().int().min(1).max(365).default(7),
});

export const queryAnalyticsTool: Tool<typeof QueryAnalyticsInput, unknown> = {
  name: 'query_analytics',
  description:
    'Aggregate a pre-defined metric over the last N days for the current tenant.',
  parameters: QueryAnalyticsInput,
  async run(args, ctx) {
    const { db } = await connectToDatabase();
    const since = new Date(Date.now() - args.windowDays * 24 * 60 * 60 * 1000);
    const tenant = toObjectIdSafe(ctx.tenantId);

    const tenantFilter = tenant ? { userId: tenant } : {};

    let collection: string;
    let filter: Record<string, unknown>;
    switch (args.metric) {
      case 'messages_sent':
        collection = 'outgoing_messages';
        filter = { ...tenantFilter, createdAt: { $gte: since } };
        break;
      case 'messages_received':
        collection = 'messages';
        filter = { ...tenantFilter, direction: 'in', createdAt: { $gte: since } };
        break;
      case 'broadcasts_sent':
        collection = 'broadcasts';
        filter = { ...tenantFilter, status: 'COMPLETED', updatedAt: { $gte: since } };
        break;
      case 'deals_created':
        collection = 'crm_deals';
        filter = { ...tenantFilter, createdAt: { $gte: since } };
        break;
      case 'contacts_added':
        collection = 'contacts';
        filter = { ...tenantFilter, createdAt: { $gte: since } };
        break;
    }
    const count = await db.collection(collection).countDocuments(filter);
    return {
      metric: args.metric,
      windowDays: args.windowDays,
      since: since.toISOString(),
      count,
    };
  },
};

/* ------------------------------------------------------------------ */
/* update_variable                                                     */
/* ------------------------------------------------------------------ */

const UpdateVariableInput = z.object({
  key: z.string().min(1).max(120),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  scope: z.enum(['run', 'tenant']).default('tenant'),
});

export const updateVariableTool: Tool<typeof UpdateVariableInput, unknown> = {
  name: 'update_variable',
  description:
    'Set a key-value variable. Use scope=run for ephemeral run-only values, scope=tenant to persist for the workspace in `agent_variables`.',
  parameters: UpdateVariableInput,
  async run(args, ctx) {
    if (args.scope === 'run') {
      ctx.shortTerm.set(args.key, args.value);
      return { ok: true, scope: 'run', key: args.key };
    }
    const { db } = await connectToDatabase();
    await db.collection('agent_variables').updateOne(
      { tenantId: ctx.tenantId, key: args.key },
      {
        $set: {
          tenantId: ctx.tenantId,
          key: args.key,
          value: args.value,
          updatedAt: new Date(),
          updatedBy: ctx.agentId,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return { ok: true, scope: 'tenant', key: args.key };
  },
};

/* ------------------------------------------------------------------ */
/* helpers + registration                                              */
/* ------------------------------------------------------------------ */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObjectIdSafe(id: string | undefined): ObjectId | undefined {
  if (!id) return undefined;
  try {
    return new ObjectId(id);
  } catch {
    return undefined;
  }
}

/** All built-in tools, exported as a flat array for convenience. */
export const builtInTools: AnyTool[] = [
  searchContactsTool as unknown as AnyTool,
  sendWhatsappTool as unknown as AnyTool,
  createCrmDealTool as unknown as AnyTool,
  queryAnalyticsTool as unknown as AnyTool,
  updateVariableTool as unknown as AnyTool,
];

// Auto-register on import.
for (const t of builtInTools) registerTool(t);
