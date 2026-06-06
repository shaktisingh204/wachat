'use client';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  EmptyState,
  Field,
  Input,
  Progress,
  Skeleton,
  Spinner,
  StatCard,
  Switch,
  Textarea,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Download,
  Plus,
  ShieldOff,
  Trash2,
  Upload,
  CloudUpload,
  X,
  Bot,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  addToOptOut,
  getOptOutList,
  removeFromOptOut,
  } from '@/app/actions/wachat-features.actions';
import {
  getOptOutSettings,
  saveOptOutSettings,
  } from '@/app/actions/wachat-opt-out-settings.actions';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Opt-Out / DND — 20ui migration.
 * Single-add form, bulk-paste, list, export CSV, per-keyword stats.
 */

import * as React from 'react';
import { fmtDate } from '@/lib/utils';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

type OptOutItem = {
  _id: string;
  phone: string;
  reason?: string;
  optedOutAt?: string;
};

type UploadItem = {
  id: string;
  file: File;
  /** 0..100 progress. `null` for "unknown / indeterminate". */
  progress: number | null;
  status: 'uploading' | 'done' | 'error';
  errorMessage?: string;
};

export default function OptOutPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [list, setList] = useState<OptOutItem[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [autoSentiment, setAutoSentiment] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getOptOutList(String(activeProject._id));
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      setList((res.optOuts as OptOutItem[]) ?? []);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Project-level AI opt-out settings (backed by the wachat-opt-out-settings
  // Rust crate). Separate from the opt-out LIST above, which lives in
  // wachat-features.
  const loadSettings = useCallback(() => {
    if (!activeProject?._id) return;
    setSettingsLoading(true);
    setSettingsError(null);
    startTransition(async () => {
      const res = await getOptOutSettings(String(activeProject._id));
      if (res.error) {
        setSettingsError(res.error);
        setSettingsLoading(false);
        return;
      }
      setAutoSentiment(Boolean(res.settings?.sentimentAutoOptOut));
      setSettingsLoading(false);
    });
  }, [activeProject?._id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggleSentiment = async (checked: boolean) => {
    if (!activeProject?._id) return;
    // Optimistic flip; revert on failure.
    const previous = autoSentiment;
    setAutoSentiment(checked);
    setSavingSettings(true);
    const res = await saveOptOutSettings(String(activeProject._id), checked);
    setSavingSettings(false);
    if (!res.success) {
      setAutoSentiment(previous);
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: checked ? 'Enabled' : 'Disabled',
      description: 'Sentiment analysis auto opt-out updated.',
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    const res = await addToOptOut(
      String(activeProject?._id ?? ''),
      phone.trim(),
      reason.trim() || undefined,
    );
    if (!res.success) {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Number added to opt-out list.' });
    setPhone('');
    setReason('');
    load();
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      const res = await removeFromOptOut(id);
      if (!res.success) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Removed from opt-out list.' });
      load();
    });
  };

  const handleBulkPaste = async () => {
    const phones = bulkText
      .split(/[\n,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (phones.length === 0) return;
    let ok = 0;
    let fail = 0;
    for (const p of phones) {
      // Basic row-level validation
      if (!/\d/.test(p)) {
        fail++;
        continue;
      }
      try {
        const res = await addToOptOut(String(activeProject?._id ?? ''), p);
        if (res.success) ok++;
        else fail++;
      } catch (err) {
        fail++;
      }
    }
    toast({
      title: 'Bulk add complete',
      description: `${ok} added, ${fail} failed.`,
    });
    setBulkText('');
    load();
  };

  const handleFilesSelected = (files: File[]) => {
    const newItems = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'uploading' as const,
    }));
    setUploadItems((prev) => [...prev, ...newItems]);
    newItems.forEach((item) => processCsvFile(item));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = e.target.files;
    if (incoming && incoming.length > 0) {
      const maxSize = 5 * 1024 * 1024;
      const arr = Array.from(incoming).filter((f) => f.size <= maxSize);
      if (arr.length > 0) handleFilesSelected(arr);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processCsvFile = async (item: UploadItem) => {
    try {
      const text = await item.file.text();
      const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
      let startIndex = 0;
      if (rows.length > 0 && rows[0].toLowerCase().includes('phone')) {
        startIndex = 1;
      }
      const totalToProcess = rows.length - startIndex;
      if (totalToProcess === 0) {
        setUploadItems((prev) =>
          prev.map((ui) =>
            ui.id === item.id ? { ...ui, status: 'done', progress: 100 } : ui
          )
        );
        return;
      }

      let successCount = 0;
      let failCount = 0;
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        const cols = row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const p = cols[0];
        const r = cols[1] || '';

        // Row-level validation
        if (!p || !/\d/.test(p)) {
          failCount++;
        } else {
          try {
            const res = await addToOptOut(
              String(activeProject?._id ?? ''),
              p,
              r || undefined
            );
            if (res.success) successCount++;
            else failCount++;
          } catch (err) {
            failCount++;
          }
        }

        const currentProgress = Math.round(
          ((i - startIndex + 1) / totalToProcess) * 100
        );
        setUploadItems((prev) =>
          prev.map((ui) =>
            ui.id === item.id ? { ...ui, progress: currentProgress } : ui
          )
        );
      }

      setUploadItems((prev) =>
        prev.map((ui) =>
          ui.id === item.id
            ? {
                ...ui,
                status: failCount === totalToProcess ? 'error' : 'done',
                progress: 100,
                errorMessage:
                  failCount > 0 ? `${failCount} rows failed` : undefined,
              }
            : ui
        )
      );

      toast({
        title: 'CSV Upload Complete',
        description: `${successCount} added, ${failCount} failed.`,
      });
      load();
    } catch (err) {
      setUploadItems((prev) =>
        prev.map((ui) =>
          ui.id === item.id
            ? { ...ui, status: 'error', errorMessage: 'Failed to read file' }
            : ui
        )
      );
    }
  };

  const handleExport = () => {
    if (list.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    const header = 'phone,reason,opted_out_at\n';
    const rows = list
      .map(
        (i) =>
          `"${i.phone}","${(i.reason || '').replace(/"/g, '""')}","${i.optedOutAt || ''}"`,
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opt-out-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Per-keyword stats from reasons
  const keywordStats = React.useMemo(() => {
    const map = new Map<string, number>();
    list.forEach((item) => {
      const key = (item.reason || 'No reason').trim() || 'No reason';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [list]);

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Opt-out / DND' },
      ]}
      title="Opt-out / DND management"
      description="Manage numbers that have opted out of receiving messages."
    >
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* Add form */}
          <Card>
            <CardHeader>
              <CardTitle>Add to opt-out list</CardTitle>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
                <Field label="Phone number">
                  <Input
                    id="opt-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                    required
                    className="w-52"
                  />
                </Field>
                <div className="flex flex-1 flex-col">
                  <Field label="Reason">
                    <Input
                      id="opt-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. User requested"
                    />
                  </Field>
                </div>
                <Button type="submit" variant="primary" size="sm" iconLeft={Plus}>
                  Add
                </Button>
              </form>
            </CardBody>
          </Card>

          {/* Bulk paste */}
          <Card>
            <CardHeader>
              <CardTitle>Bulk add</CardTitle>
              <CardDescription>
                Paste multiple phone numbers separated by newlines or commas.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <Textarea
                rows={4}
                placeholder={'+919876543210\n+919876543211\n+919876543212'}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleBulkPaste}
                disabled={!bulkText.trim()}
                iconLeft={Upload}
              >
                Bulk add
              </Button>
            </CardBody>
          </Card>

          {/* CSV Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV</CardTitle>
              <CardDescription>
                Upload a CSV file containing opt-outs. Expected columns: <b>phone, reason</b> (optional).
              </CardDescription>
            </CardHeader>
            <CardBody>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileInputChange}
              />
              <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--st-radius-lg)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-6 text-center">
                <CloudUpload
                  size={22}
                  aria-hidden="true"
                  className="text-[var(--st-text-tertiary)]"
                />
                <p className="text-[12px] text-[var(--st-text-secondary)]">
                  CSV up to 5MB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file
                </Button>
              </div>
              {uploadItems.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {uploadItems.map((item) => (
                    <li key={item.id}>
                      <Card variant="outlined" padding="sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-[12.5px] text-[var(--st-text)]">
                            {item.file.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={X}
                            aria-label={`Remove ${item.file.name}`}
                            onClick={() =>
                              setUploadItems((p) => p.filter((i) => i.id !== item.id))
                            }
                          />
                        </div>
                        {item.status === 'uploading' ? (
                          <Progress
                            value={item.progress ?? 0}
                            indeterminate={item.progress == null}
                            size="sm"
                            label={`Uploading ${item.file.name}`}
                          />
                        ) : null}
                        {item.status === 'error' ? (
                          <span className="text-[11.5px] text-[var(--st-danger)]">
                            {item.errorMessage || 'Upload failed'}
                          </span>
                        ) : null}
                        {item.status === 'done' ? (
                          <span className="text-[11.5px] text-[var(--st-status-ok)]">
                            Done{item.errorMessage ? ` — ${item.errorMessage}` : ''}
                          </span>
                        ) : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardBody>
          </Card>

          {/* Per-keyword stats */}
          {keywordStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Per-reason stats</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {keywordStats.slice(0, 8).map(([k, n]) => (
                    <StatCard key={k} label={k} value={n} />
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Opt-out numbers</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={list.length === 0}
                  iconLeft={Download}
                >
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {isPending && list.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <Skeleton height={32} width="100%" />
                  <Skeleton height={32} width="100%" />
                  <Skeleton height={32} width="100%" />
                </div>
              ) : !isPending && list.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={ShieldOff}
                  title="No opt-out numbers recorded"
                  description="Numbers added here will be skipped from outbound campaigns."
                />
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_1fr_140px_48px] gap-3 pb-2 text-[11.5px] text-[var(--st-text-secondary)]">
                    <span>Phone</span>
                    <span>Reason</span>
                    <span>Opted out</span>
                    <span />
                  </div>
                  {list.map((item) => (
                    <div
                      key={item._id}
                      className="grid grid-cols-[1fr_1fr_140px_48px] items-center gap-3 rounded-[var(--st-radius)] px-1 py-2 text-[13px] text-[var(--st-text)]"
                    >
                      <span>{item.phone}</span>
                      <span className="text-[var(--st-text-secondary)]">
                        {item.reason || '--'}
                      </span>
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {item.optedOutAt
                          ? fmtDate(item.optedOutAt)
                          : '--'}
                      </span>
                      {isPending ? (
                        <span className="flex h-7 w-7 items-center justify-center">
                          <Spinner size="sm" label="Removing" />
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={Trash2}
                          onClick={() => handleRemove(item._id)}
                          disabled={isPending}
                          aria-label={`Remove ${item.phone}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar settings */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot
                  className="h-4 w-4 text-[var(--st-text-secondary)]"
                  aria-hidden="true"
                />{' '}
                AI Settings
              </CardTitle>
              <CardDescription>
                Auto-add contacts to opt-out list based on sentiment analysis of inbound messages (e.g. "stop messaging me", "unsubscribe").
              </CardDescription>
            </CardHeader>
            <CardBody>
              {settingsLoading ? (
                <div className="flex items-center justify-between">
                  <Skeleton height={16} width={200} />
                  <Skeleton height={22} width={40} />
                </div>
              ) : settingsError ? (
                <div className="flex flex-col items-start gap-2">
                  <span className="text-[12.5px] text-[var(--st-danger)]">
                    {settingsError}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSettings}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="auto-sentiment-switch"
                    className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--st-text)]"
                  >
                    Enable Sentiment Auto-Opt-Out
                    {savingSettings ? (
                      <Spinner size="sm" label="Saving setting" />
                    ) : null}
                  </label>
                  <Switch
                    id="auto-sentiment-switch"
                    checked={autoSentiment}
                    disabled={savingSettings}
                    aria-label="Enable Sentiment Auto-Opt-Out"
                    onCheckedChange={handleToggleSentiment}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </WachatPage>
  );
}
