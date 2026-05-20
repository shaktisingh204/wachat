import {
  getBackupSettingsForAdmin,
  listBackups,
} from '@/app/actions/database-backup.actions';
import { DatabaseBackupClient } from './database-backup-client';

export const dynamic = 'force-dynamic';

export default async function DatabaseBackupPage() {
  let initialList: Awaited<ReturnType<typeof listBackups>> | null = null;
  let initialSettings: Awaited<ReturnType<typeof getBackupSettingsForAdmin>> | null = null;
  let loadError: string | null = null;
  try {
    initialList = await listBackups();
    initialSettings = await getBackupSettingsForAdmin();
  } catch (e: unknown) {
    loadError = e instanceof Error ? e.message : 'Failed to load backups.';
  }
  return (
    <DatabaseBackupClient
      initialRows={initialList?.rows ?? []}
      initialKpis={
        initialList?.kpis ?? { total: 0, lastAt: null, totalSizeBytes: 0 }
      }
      initialSettings={
        initialSettings ?? { storage: 'local', path: '/var/backups/sabnode', retentionDays: 30 }
      }
      loadError={loadError}
    />
  );
}
