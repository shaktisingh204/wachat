'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

/**
 * Database Backup — admin-only manual backups via `mongodump`.
 *
 * Collections:
 *   database_backups          { filename, sizeBytes, path, status, createdAt, error? }
 *   database_backup_settings  (singleton)  { storage, path, retentionDays }
 *
 * The retention sweep is wired into `src/lib/cron/jobs/database-backup.ts`.
 *
 * If `mongodump` isn't available on the host (e.g. Vercel Fluid Compute
 * sandbox), `createBackup` returns a friendly error string instead of
 * throwing — wrap calls in try/catch on the UI side.
 */

type BackupRow = {
  _id: string;
  filename: string;
  sizeBytes: number;
  path: string;
  status: 'success' | 'failed' | 'in-progress';
  createdAt: string;
  error?: string;
};

type BackupSettings = {
  storage: 'local' | 's3';
  path: string;
  retentionDays: number;
};

const SETTINGS_KEY = 'database_backup_settings';

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated.');
  const role = (session.user as { role?: string }).role;
  if (role !== 'admin') throw new Error('Admin privileges required.');
}

async function getBackupSettings(): Promise<BackupSettings> {
  const { db } = await connectToDatabase();
  const doc = await db.collection('settings').findOne({ key: SETTINGS_KEY });
  const v = (doc?.value as Partial<BackupSettings> | undefined) ?? {};
  return {
    storage: v.storage ?? 'local',
    path: v.path ?? '/var/backups/sabnode',
    retentionDays: v.retentionDays ?? 30,
  };
}

export async function getBackupSettingsForAdmin(): Promise<BackupSettings> {
  await requireAdmin();
  return getBackupSettings();
}

export async function saveBackupSettings(
  next: BackupSettings,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    await requireAdmin();
    const { db } = await connectToDatabase();
    await db.collection('settings').updateOne(
      { key: SETTINGS_KEY },
      {
        $set: {
          key: SETTINGS_KEY,
          value: {
            storage: next.storage === 's3' ? 's3' : 'local',
            path: next.path || '/var/backups/sabnode',
            retentionDays: Math.max(1, Math.floor(Number(next.retentionDays) || 30)),
          },
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    revalidatePath('/dashboard/crm/settings/database-backup');
    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

function runMongodump(uri: string, archivePath: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      'mongodump',
      [`--uri=${uri}`, `--archive=${archivePath}`, '--gzip'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (b: Buffer) => {
      stderr += b.toString();
    });
    child.on('error', (err) => {
      resolve({ ok: false, stderr: stderr || err.message });
    });
    child.on('close', (code) => {
      resolve({ ok: code === 0, stderr });
    });
  });
}

export async function createBackup(): Promise<{ ok?: boolean; error?: string; id?: string }> {
  try {
    await requireAdmin();
    const settings = await getBackupSettings();
    const uri = process.env.MONGODB_URI;
    if (!uri) return { error: 'MONGODB_URI is not configured.' };

    const date = new Date();
    const stamp = date.toISOString().replace(/[:.]/g, '-');
    const filename = `sabnode-${stamp}.gz`;

    // Ensure target directory exists.
    try {
      await fs.mkdir(settings.path, { recursive: true });
    } catch (e: unknown) {
      return { error: `Cannot create backup dir: ${getErrorMessage(e)}` };
    }

    const archivePath = path.join(settings.path, filename);
    const { db } = await connectToDatabase();
    const insert = await db.collection('database_backups').insertOne({
      filename,
      path: archivePath,
      sizeBytes: 0,
      status: 'in-progress',
      createdAt: date,
    });
    const id = insert.insertedId;

    let result: { ok: boolean; stderr: string };
    try {
      result = await runMongodump(uri, archivePath);
    } catch (e: unknown) {
      result = { ok: false, stderr: getErrorMessage(e) };
    }

    if (!result.ok) {
      await db.collection('database_backups').updateOne(
        { _id: id },
        {
          $set: {
            status: 'failed',
            error: result.stderr || 'mongodump failed (binary may be missing).',
            completedAt: new Date(),
          },
        },
      );
      revalidatePath('/dashboard/crm/settings/database-backup');
      return {
        error:
          result.stderr ||
          'mongodump failed — confirm the binary is installed on the host.',
        id: String(id),
      };
    }

    let sizeBytes = 0;
    try {
      const stat = await fs.stat(archivePath);
      sizeBytes = stat.size;
    } catch {
      /* size will stay 0 */
    }
    await db.collection('database_backups').updateOne(
      { _id: id },
      {
        $set: {
          status: 'success',
          sizeBytes,
          completedAt: new Date(),
        },
      },
    );
    revalidatePath('/dashboard/crm/settings/database-backup');
    return { ok: true, id: String(id) };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

export async function listBackups(): Promise<{
  rows: BackupRow[];
  kpis: { total: number; lastAt: string | null; totalSizeBytes: number };
}> {
  await requireAdmin();
  const { db } = await connectToDatabase();
  const rows = (await db
    .collection('database_backups')
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()) as WithId<Record<string, unknown>>[];
  let totalSize = 0;
  let lastAt: string | null = null;
  const mapped = rows.map((r) => {
    const size = Number(r.sizeBytes ?? 0);
    totalSize += size;
    const created = r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt));
    if (!lastAt) lastAt = created.toISOString();
    return {
      _id: String(r._id),
      filename: String(r.filename ?? ''),
      sizeBytes: size,
      path: String(r.path ?? ''),
      status: ((r.status as string) ?? 'success') as BackupRow['status'],
      createdAt: created.toISOString(),
      error: (r.error as string | undefined) || undefined,
    };
  });
  return {
    rows: mapped,
    kpis: { total: mapped.length, lastAt, totalSizeBytes: totalSize },
  };
}

export async function deleteBackup(id: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!ObjectId.isValid(id)) return { error: 'Invalid id.' };
    const { db } = await connectToDatabase();
    const row = await db.collection('database_backups').findOne({ _id: new ObjectId(id) });
    if (!row) return { error: 'Backup not found.' };
    try {
      if (row.path) await fs.unlink(String(row.path));
    } catch (e: unknown) {
      console.warn('[backup] unlink failed (continuing):', getErrorMessage(e));
    }
    await db.collection('database_backups').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/crm/settings/database-backup');
    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}
