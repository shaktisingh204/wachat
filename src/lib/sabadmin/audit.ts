import 'server-only';

import { getSabAdminCollections, ensureSabAdminIndexes } from './db/collections';
import type { SabAdminContext } from './tenant';
import type { SabAdminAuditAction, SabAdminAuditEntry } from './types';

/**
 * Append an immutable governance entry. Best-effort: an audit failure must
 * never block the lifecycle action it records.
 */
export async function writeSabAdminAudit(
  ctx: Pick<SabAdminContext, 'ownerUserId' | 'actorUserId' | 'actorEmail'>,
  action: SabAdminAuditAction,
  summary: string,
  subject?: { userId?: string; upn?: string },
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureSabAdminIndexes();
    const { cols } = await getSabAdminCollections();
    const entry: SabAdminAuditEntry = {
      ownerUserId: ctx.ownerUserId,
      actorUserId: ctx.actorUserId,
      actorEmail: ctx.actorEmail,
      action,
      subjectUserId: subject?.userId,
      subjectUpn: subject?.upn,
      summary,
      meta,
      ts: new Date(),
    };
    await cols.audit.insertOne(entry);
  } catch {
    /* audit is best-effort — never block the action it records */
  }
}

/** Most-recent audit entries for the org's console. */
export async function listSabAdminAudit(
  ownerUserId: string,
  limit = 100,
): Promise<SabAdminAuditEntry[]> {
  const { cols } = await getSabAdminCollections();
  return cols.audit
    .find({ ownerUserId })
    .sort({ ts: -1 })
    .limit(Math.min(Math.max(limit, 1), 500))
    .toArray();
}
