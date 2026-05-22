'use client';

import { useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Database, HardDrive, Clock, Trash2, Download, Play } from 'lucide-react';
import {
  createBackup,
  deleteBackup,
  listBackups,
  saveBackupSettings,
  type BackupRow,
  type BackupSettings,
} from '@/app/actions/database-backup.actions';

type Kpis = { total: number; lastAt: string | null; totalSizeBytes: number };

function formatBytes(b: number): string {
  if (!b) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return `${(b / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export function DatabaseBackupClient({
  initialRows,
  initialKpis,
  initialSettings,
  loadError,
}: {
  initialRows: BackupRow[];
  initialKpis: Kpis;
  initialSettings: BackupSettings;
  loadError: string | null;
}) {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState(initialRows);
  const [kpis, setKpis] = useState<Kpis>(initialKpis);
  const [settings, setSettings] = useState<BackupSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();

  const refresh = async () => {
    try {
      const next = await listBackups();
      setRows(next.rows);
      setKpis(next.kpis);
    } catch (e: unknown) {
      toast({
        title: 'Reload failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createBackup();
      if (res.error) {
        toast({
          title: 'Backup failed',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Backup created' });
      }
      void refresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteBackup(id);
      if (res.error) {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Backup deleted' });
      }
      void refresh();
    });
  };

  const handleSaveSettings = () => {
    startTransition(async () => {
      const res = await saveBackupSettings(settings);
      if (res.error) {
        toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Backup settings saved' });
    });
  };

  if (loadError) {
    return (
      <ZoruCard className="p-8 text-center">
        <p className="text-sm text-zoru-danger">{loadError}</p>
      </ZoruCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Database backups</ZoruPageTitle>
          <ZoruPageDescription>
            Manual on-demand backups via mongodump. Configure storage path and retention below.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="flex flex-wrap gap-3">
        <ZoruButton onClick={handleCreate} disabled={isPending}>
          <Play className="h-4 w-4" strokeWidth={1.75} />
          {isPending ? 'Working…' : 'Create backup now'}
        </ZoruButton>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ZoruCard className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-zoru-ink-muted">Total backups</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
              <Database className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>
          <p className="mt-3 text-[26px] leading-none text-zoru-ink">{kpis.total}</p>
        </ZoruCard>
        <ZoruCard className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-zoru-ink-muted">Last backup</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
              <Clock className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>
          <p className="mt-3 text-sm leading-none text-zoru-ink">
            {kpis.lastAt ? new Date(kpis.lastAt).toLocaleString() : 'Never'}
          </p>
        </ZoruCard>
        <ZoruCard className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-zoru-ink-muted">Total size</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
              <HardDrive className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>
          <p className="mt-3 text-[26px] leading-none text-zoru-ink">
            {formatBytes(kpis.totalSizeBytes)}
          </p>
        </ZoruCard>
      </div>

      <ZoruCard>
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Filename</ZoruTableHead>
              <ZoruTableHead>Size</ZoruTableHead>
              <ZoruTableHead>Created</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {rows.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={5} className="py-12 text-center text-sm text-zoru-ink-muted">
                  No backups yet. Click "Create backup now" to start.
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              rows.map((row) => (
                <ZoruTableRow key={row._id}>
                  <ZoruTableCell className="font-mono text-[12.5px]">{row.filename}</ZoruTableCell>
                  <ZoruTableCell>{formatBytes(row.sizeBytes)}</ZoruTableCell>
                  <ZoruTableCell className="text-zoru-ink-muted">
                    {new Date(row.createdAt).toLocaleString()}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge
                      variant={
                        row.status === 'failed'
                          ? 'destructive'
                          : row.status === 'in-progress'
                          ? 'ghost'
                          : 'default'
                      }
                    >
                      {row.status}
                    </ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex items-center justify-end gap-2">
                      <ZoruButton
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a
                          href={`/api/admin/database-backup/download?id=${row._id}`}
                          download={row.filename}
                        >
                          <Download className="h-4 w-4" strokeWidth={1.75} />
                          Download
                        </a>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(row._id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        Delete
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))
            )}
          </ZoruTableBody>
        </ZoruTable>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h2 className="text-base text-zoru-ink">Settings</h2>
        <p className="text-[12.5px] text-zoru-ink-muted">
          Where backups are written and how long they're kept.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <ZoruLabel htmlFor="storage">Storage</ZoruLabel>
            <ZoruSelect
              value={settings.storage}
              onValueChange={(v) => setSettings((s) => ({ ...s, storage: v as BackupSettings['storage'] }))}
            >
              <ZoruSelectTrigger id="storage">
                <ZoruSelectValue placeholder="Storage" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="local">Local disk</ZoruSelectItem>
                <ZoruSelectItem value="s3">S3 / R2</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="grid gap-2">
            <ZoruLabel htmlFor="bk-path">Path / bucket</ZoruLabel>
            <ZoruInput
              id="bk-path"
              value={settings.path}
              onChange={(e) => setSettings((s) => ({ ...s, path: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <ZoruLabel htmlFor="retention">Retention (days)</ZoruLabel>
            <ZoruInput
              id="retention"
              type="number"
              min={1}
              value={settings.retentionDays}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  retentionDays: Number(e.target.value) || 1,
                }))
              }
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <ZoruButton onClick={handleSaveSettings} disabled={isPending}>
            Save settings
          </ZoruButton>
        </div>
      </ZoruCard>
    </div>
  );
}
