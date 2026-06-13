'use client';

/**
 * SabMail optimistic-write glue (Superhuman "modify() + persist()" model).
 *
 * The inbox UI calls {@link applySabmailMutation} for star / read / archive /
 * delete. It (1) patches the read-through offline cache instantly so a refresh
 * doesn't flicker, (2) enqueues a durable mutation, and (3) flushes the queue
 * through {@link runSabmailMutation}, which performs the real IMAP write via the
 * inbox server actions. The component keeps its own instant UI state; this
 * returns `{ previous, ok }` so it can roll that state back when a write
 * terminally fails. Queued writes survive reloads (Dexie/localStorage) and are
 * retried on the next flush.
 */

import {
  archiveSabmailMessage,
  setSabmailFlag,
  trashSabmailMessage,
} from '@/app/sabmail/inbox/actions';
import {
  enqueueMutation,
  flushMutations,
  patchCachedRow,
  removeCachedRow,
  type MutationRunResult,
  type SabmailMutation,
} from '@/lib/sabmail/offline-cache';

/** Map a queued mutation to its server action and normalize the outcome. */
export async function runSabmailMutation(
  m: SabmailMutation,
): Promise<MutationRunResult> {
  try {
    let res: { ok: boolean; error?: string };
    switch (m.type) {
      case 'markSeen':
        res = await setSabmailFlag(m.accountId, m.folder, m.uid, 'seen', true);
        break;
      case 'markUnseen':
        res = await setSabmailFlag(m.accountId, m.folder, m.uid, 'seen', false);
        break;
      case 'flag':
        res = await setSabmailFlag(m.accountId, m.folder, m.uid, 'flagged', true);
        break;
      case 'unflag':
        res = await setSabmailFlag(m.accountId, m.folder, m.uid, 'flagged', false);
        break;
      case 'archive':
        res = await archiveSabmailMessage(m.accountId, m.folder, m.uid);
        break;
      case 'delete':
        res = await trashSabmailMessage(m.accountId, m.folder, m.uid);
        break;
      default:
        return { ok: false, retry: false }; // unknown type — drop it
    }
    if (res.ok) return { ok: true };
    // Credential / not-found errors won't fix themselves → terminal. Network /
    // transient IMAP errors are retryable.
    const terminal = /credential|not found|no smtp|unauthor|invalid/i.test(
      res.error ?? '',
    );
    return { ok: false, retry: !terminal };
  } catch {
    return { ok: false, retry: true };
  }
}

/** Drain all queued SabMail mutations through the runner. */
export function flushSabmailMutations() {
  return flushMutations(runSabmailMutation);
}

export interface OptimisticOutcome {
  /** Prior row snapshot, for rolling the UI back on terminal failure. */
  previous: Record<string, unknown> | null;
  /** False when this write terminally failed (caller should roll back). */
  ok: boolean;
}

type OptimisticType =
  | 'markSeen'
  | 'markUnseen'
  | 'flag'
  | 'unflag'
  | 'archive'
  | 'delete';

const CACHE_PATCH: Record<OptimisticType, Record<string, unknown> | 'remove'> = {
  markSeen: { seen: true },
  markUnseen: { seen: false },
  flag: { flagged: true },
  unflag: { flagged: false },
  archive: 'remove',
  delete: 'remove',
};

/**
 * Apply an inbox mutation optimistically (cache patch + durable enqueue +
 * flush). The component owns its instant UI update; this keeps the cache
 * consistent and persists the write with retry. Returns `{ previous, ok }`.
 */
export async function applySabmailMutation(input: {
  type: OptimisticType;
  accountId: string;
  folder: string;
  uid: number;
  payload?: Record<string, unknown>;
}): Promise<OptimisticOutcome> {
  const patch = CACHE_PATCH[input.type];
  const previous =
    patch === 'remove'
      ? await removeCachedRow(input.accountId, input.folder, input.uid)
      : await patchCachedRow(input.accountId, input.folder, input.uid, patch);

  await enqueueMutation({
    type: input.type,
    accountId: input.accountId,
    folder: input.folder,
    uid: input.uid,
    payload: input.payload,
  });

  const { failed } = await flushSabmailMutations();
  const thisFailed = failed.some(
    (f) =>
      f.accountId === input.accountId &&
      f.uid === input.uid &&
      f.type === input.type,
  );
  return { previous, ok: !thisFailed };
}
