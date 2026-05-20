import { promises as fs } from 'node:fs';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { jobStart, pushError, toErrorMessage } from '../utils';

/**
 * Database backup retention sweep.
 *
 * Deletes `database_backups` rows (and the on-disk archive) older than
 * `retentionDays` from `settings.database_backup_settings`.
 *
 * Does NOT create new backups — those are admin-triggered from the
 * `/dashboard/crm/settings/database-backup` page. We could extend this
 * to create scheduled backups by reading a `scheduleCron` setting; for
 * now the sweep is the only periodic action.
 */
export default async function databaseBackupRetentionJob(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('database-backup-retention');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;

  try {
    const { db } = await connectToDatabase();
    const settings = await db
      .collection('settings')
      .findOne({ key: 'database_backup_settings' });
    const retentionDays = Number(
      (settings?.value as { retentionDays?: number } | undefined)?.retentionDays ?? 30,
    );
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const stale = await db
      .collection('database_backups')
      .find({ createdAt: { $lt: cutoff } })
      .toArray();

    for (const row of stale) {
      processed += 1;
      const ref = String(row._id);
      try {
        if (row.path) {
          try {
            await fs.unlink(String(row.path));
          } catch (e: unknown) {
            pushError(errors, `unlink failed: ${toErrorMessage(e)}`, ref);
          }
        }
        await db
          .collection('database_backups')
          .deleteOne({ _id: new ObjectId(ref) });
      } catch (e: unknown) {
        pushError(errors, e, ref);
      }
    }

    log('done', { processed, errors: errors.length, retentionDays });
    return {
      processed,
      errors,
      durationMs: Date.now() - startedAt.getTime(),
      details: { retentionDays, cutoff: cutoff.toISOString() },
    };
  } catch (e: unknown) {
    pushError(errors, e, 'job');
    return {
      processed,
      errors,
      durationMs: Date.now() - startedAt.getTime(),
    };
  }
}
