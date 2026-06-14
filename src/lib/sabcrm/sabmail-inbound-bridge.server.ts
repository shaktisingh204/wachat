import 'server-only';

/**
 * SabCRM ⇆ SabMail inbound bridge.
 *
 * Closes the inbound half of SabCRM's 2-way email: when a message is RECEIVED
 * in SabMail (the in-house mail platform), route a copy of it onto the matching
 * SabCRM record(s) so replies land on the record Timeline next to the sends
 * from the Email tab — exactly like the platform inbound-email webhook already
 * does via `routeInboundSabcrmEmail`.
 *
 * This is wired ADDITIVELY into the SabMail inbound webhook
 * (`src/app/api/webhooks/sabmail-inbound/route.ts`) as a best-effort,
 * fire-and-forget call placed AFTER `bindInboundMessage(...)`. It must never
 * affect SabMail's own handling and must degrade gracefully: if the workspace
 * can't be mapped to a CRM user, it no-ops.
 *
 * ── Tenant mapping (workspaceId → CRM user/project) ────────────────────────
 * A SabMail `workspaceId` IS the `_id` (string) of a `kind:'mail'` project
 * (see `src/lib/sabmail/workspace.ts` + `db/collections.ts` — every SabMail
 * collection is scoped by this key). That project carries the OWNING SabNode
 * user in `projects.userId`. So:
 *
 *   workspaceId → projects.findOne({_id: ObjectId(workspaceId), kind:'mail'})
 *               → .userId  (the CRM user)
 *
 * The CRM records, however, live under the user's CRM project(s) — NOT the
 * mail project. We therefore resolve the user here and let
 * `routeInboundSabcrmEmail` choose the project, preferring a `kind:'crm'`
 * standalone project when one exists and otherwise deferring to the same
 * default-project pick the platform inbound path uses (the user's first
 * project). Passing the project explicitly keeps both inbound paths
 * consistent.
 *
 * Best-effort + never throws (returns a `RouteInboundSabcrmEmailResult` with a
 * `reason` on every miss), so the webhook stays healthy.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  routeInboundSabcrmEmail,
  type RouteInboundSabcrmEmailResult,
} from '@/lib/sabcrm/email-inbound';
import {
  mapSabmailInboundToCrmEmail,
  type SabmailInboundRaw,
} from '@/lib/sabcrm/sabmail-inbound-map';

const none = (reason: string): RouteInboundSabcrmEmailResult => ({
  routed: false,
  matchedRecords: 0,
  activitiesLogged: 0,
  sequencesUnenrolled: 0,
  reason,
});

/**
 * Resolve the owning SabNode user id for a SabMail `workspaceId`.
 *
 * `workspaceId` is the `kind:'mail'` project `_id` string; the project's
 * `userId` is the owner. Returns `null` when the workspace can't be mapped
 * (so the bridge no-ops, per the spec).
 */
async function resolveWorkspaceUser(workspaceId: string): Promise<string | null> {
  if (!workspaceId || !ObjectId.isValid(workspaceId)) return null;
  try {
    const { db } = await connectToDatabase();
    const project = await db
      .collection('projects')
      .findOne(
        { _id: new ObjectId(workspaceId), kind: 'mail' },
        { projection: { userId: 1 } },
      );
    if (project?.userId) return String(project.userId);
  } catch {
    /* unresolved → no-op */
  }
  return null;
}

/**
 * Prefer the user's first standalone CRM project (`kind:'crm'`) when one
 * exists. Returns `null` to let `routeInboundSabcrmEmail` apply its own
 * default-project pick (the user's first project, same as the platform
 * inbound webhook) — a strict, graceful fallback.
 */
async function resolveCrmProject(userId: string): Promise<string | null> {
  try {
    const { db } = await connectToDatabase();
    const project = await db
      .collection('projects')
      .findOne(
        { userId: new ObjectId(userId), kind: 'crm' },
        { projection: { _id: 1 }, sort: { createdAt: 1 } },
      );
    return project ? String(project._id) : null;
  } catch {
    return null;
  }
}

/**
 * Route a SabMail-received message onto the matching SabCRM record(s).
 *
 * Best-effort, never throws, idempotent-friendly (carries `messageId` through
 * so `routeInboundSabcrmEmail`'s sequence-unenroll dedupe can key off it).
 * No-ops (returns a `reason`) when SabMail isn't mapped to a CRM user.
 */
export async function routeSabmailInboundToCrm(
  raw: SabmailInboundRaw,
): Promise<RouteInboundSabcrmEmailResult> {
  try {
    const workspaceId = (raw.workspaceId ?? '').trim();
    if (!workspaceId) return none('no-workspace');

    const from = (raw.from ?? '').trim();
    if (!from || !from.includes('@')) return none('invalid-from');

    const userId = await resolveWorkspaceUser(workspaceId);
    if (!userId) return none('no-tenant');

    const projectId = (await resolveCrmProject(userId)) ?? undefined;

    const email = mapSabmailInboundToCrmEmail(raw);
    return await routeInboundSabcrmEmail(email, { userId, projectId });
  } catch (e) {
    return none(e instanceof Error ? e.message : 'bridge-failed');
  }
}
