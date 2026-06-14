/**
 * SabNode MCP — SabCall tool registry.
 *
 * Exposes the workspace's SabCall (cloud PBX) as agent tools: place outbound
 * calls through the engine, browse the call log, and manage contacts. Every
 * tool requires a `projectId` (the SabCall workspace) and scopes data by the
 * `userId` field = that project id — matching the Next.js direct-Mongo path and
 * the engine. Auth/tenancy framing live in the route + dispatcher; a tool only
 * runs once the calling key holds the declared `calls:*` scope.
 */

import 'server-only';

import { z, type ZodType } from 'zod';

import { connectToDatabase } from '@/lib/mongodb';
import { sabcallEngine } from '@/lib/sabcall/engine-client';
import type { OAuthScope } from '../types';
import { toolJson, toolError, type McpToolResult } from './protocol';

export interface McpTool<S extends ZodType = ZodType> {
  name: string;
  title: string;
  description: string;
  scope: OAuthScope;
  schema: S;
  run: (userId: string, args: z.infer<S>) => Promise<McpToolResult>;
}

function defineTool<S extends ZodType>(tool: McpTool<S>): McpTool {
  return tool as unknown as McpTool;
}

function withStringId<T extends { _id: unknown }>(doc: T): T & { _id: string } {
  return { ...doc, _id: String(doc._id) } as T & { _id: string };
}

const projectId = z
  .string()
  .min(1)
  .describe('The SabCall project (workspace) id this call/data belongs to.');

export const SABCALL_TOOLS: McpTool[] = [
  defineTool({
    name: 'place_call',
    title: 'Place a call',
    description:
      'Originate an outbound call from the project to a destination number or SIP endpoint via the SabCall engine. Returns the channel id.',
    scope: 'calls:write',
    schema: z.object({
      projectId,
      to: z.string().min(1).describe('Destination E.164 number or ARI endpoint.'),
      callerId: z.string().optional().describe('Caller ID to present, if any.'),
    }),
    run: async (_userId, args) => {
      try {
        const res = await sabcallEngine.originate({
          tenant: args.projectId,
          to: args.to,
          callerId: args.callerId,
        });
        return toolJson({ channelId: res.channelId });
      } catch (e) {
        return toolError(e instanceof Error ? e.message : 'Failed to place call.');
      }
    },
  }),
  defineTool({
    name: 'list_calls',
    title: 'List recent calls',
    description: 'List recent call detail records (CDRs) for the project, newest first.',
    scope: 'calls:read',
    schema: z.object({
      projectId,
      status: z.string().optional().describe('Filter by status (e.g. completed, missed).'),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    run: async (_userId, args) => {
      const { db } = await connectToDatabase();
      const filter: Record<string, unknown> = { userId: args.projectId };
      if (args.status && args.status !== 'all') filter.status = args.status;
      const rows = await db
        .collection('sabcall_calls')
        .find(filter)
        .sort({ startedAt: -1 })
        .limit(args.limit ?? 50)
        .toArray();
      return toolJson({ calls: rows.map((r) => withStringId(r as { _id: unknown })) });
    },
  }),
  defineTool({
    name: 'list_contacts',
    title: 'List contacts',
    description: "List the project's contacts, optionally filtered by a search term.",
    scope: 'calls:read',
    schema: z.object({
      projectId,
      q: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    run: async (_userId, args) => {
      const { db } = await connectToDatabase();
      const filter: Record<string, unknown> = { userId: args.projectId };
      if (args.q) {
        filter.$or = [
          { name: { $regex: args.q, $options: 'i' } },
          { phone: { $regex: args.q, $options: 'i' } },
        ];
      }
      const rows = await db
        .collection('sabcall_contacts')
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(args.limit ?? 50)
        .toArray();
      return toolJson({ contacts: rows.map((r) => withStringId(r as { _id: unknown })) });
    },
  }),
  defineTool({
    name: 'create_contact',
    title: 'Create a contact',
    description: 'Create a contact in the project.',
    scope: 'calls:write',
    schema: z.object({
      projectId,
      name: z.string().min(1),
      phone: z.string().min(1).describe('E.164 phone number.'),
      email: z.string().optional(),
      company: z.string().optional(),
      vip: z.boolean().optional(),
    }),
    run: async (_userId, args) => {
      const { db } = await connectToDatabase();
      const now = new Date();
      const doc = {
        userId: args.projectId,
        name: args.name,
        phone: args.phone,
        email: args.email ?? null,
        company: args.company ?? null,
        vip: !!args.vip,
        tags: [] as string[],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      const res = await db.collection('sabcall_contacts').insertOne(doc as never);
      return toolJson({ id: String(res.insertedId) });
    },
  }),
];

export const SABCALL_TOOL_MAP: Map<string, McpTool> = new Map(
  SABCALL_TOOLS.map((t) => [t.name, t]),
);
