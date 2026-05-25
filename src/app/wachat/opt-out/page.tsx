'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Textarea,
  useZoruToast,
  ZoruFileUploadCard,
  ZoruFileUploadItem,
  Switch,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  Download,
  Loader2,
  Plus,
  ShieldOff,
  Trash2,
  Upload,
  Bot,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  addToOptOut,
  getOptOutList,
  removeFromOptOut,
  } from '@/app/actions/wachat-features.actions';

/**
 * Wachat Opt-Out / DND — ZoruUI migration.
 * Single-add form, bulk-paste, list, export CSV, per-keyword stats.
 */

import * as React from 'react';
import { fmtDate } from '@/lib/utils';

type OptOutItem = {
  _id: string;
  phone: string;
  reason?: string;
  optedOutAt?: string;
};

export default function OptOutPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [list, setList] = useState<OptOutItem[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [uploadItems, setUploadItems] = useState<ZoruFileUploadItem[]>([]);
  const [autoSentiment, setAutoSentiment] = useState(false);

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

  const processCsvFile = async (item: ZoruFileUploadItem) => {
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
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Opt-out / DND</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="mt-5">
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Opt-out / DND management
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Manage numbers that have opted out of receiving messages.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* Add form */}
          <Card className="p-5">
            <h2 className="mb-4 text-[15px] text-zoru-ink">Add to opt-out list</h2>
            <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="opt-phone">Phone number</Label>
                <Input
                  id="opt-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  required
                  className="w-52"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="opt-reason">Reason</Label>
                <Input
                  id="opt-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. User requested"
                />
              </div>
              <Button type="submit" size="sm">
                <Plus /> Add
              </Button>
            </form>
          </Card>

          {/* Bulk paste */}
          <Card className="p-5">
            <h2 className="mb-3 text-[15px] text-zoru-ink">Bulk add</h2>
            <p className="mb-2 text-[12px] text-zoru-ink-muted">
              Paste multiple phone numbers separated by newlines or commas.
            </p>
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
            >
              <Upload /> Bulk add
            </Button>
          </Card>
          
          {/* CSV Upload */}
          <Card className="p-5">
            <h2 className="mb-3 text-[15px] text-zoru-ink">Upload CSV</h2>
            <p className="mb-4 text-[12px] text-zoru-ink-muted">
              Upload a CSV file containing opt-outs. Expected columns: <b>phone, reason</b> (optional).
            </p>
            <ZoruFileUploadCard
              accept=".csv"
              hint="CSV up to 5MB"
              maxSize={5 * 1024 * 1024}
              onFilesSelected={handleFilesSelected}
              items={uploadItems}
              onRemove={(id) => setUploadItems((p) => p.filter((i) => i.id !== id))}
            />
          </Card>

          {/* Per-keyword stats */}
          {keywordStats.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-[15px] text-zoru-ink">Per-reason stats</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {keywordStats.slice(0, 8).map(([k, n]) => (
                  <div
                    key={k}
                    className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2"
                  >
                    <div className="truncate text-[11.5px] text-zoru-ink-muted">
                      {k}
                    </div>
                    <div className="mt-0.5 text-[18px] text-zoru-ink leading-none">
                      {n}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* List */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] text-zoru-ink">Opt-out numbers</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={list.length === 0}
              >
                <Download /> Export CSV
              </Button>
            </div>
            {isPending && list.length === 0 ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !isPending && list.length === 0 ? (
              <EmptyState
                compact
                icon={<ShieldOff />}
                title="No opt-out numbers recorded"
                description="Numbers added here will be skipped from outbound campaigns."
              />
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_1fr_140px_48px] gap-3 pb-2 text-[11.5px] text-zoru-ink-muted">
                  <span>Phone</span>
                  <span>Reason</span>
                  <span>Opted out</span>
                  <span />
                </div>
                {list.map((item) => (
                  <div
                    key={item._id}
                    className="grid grid-cols-[1fr_1fr_140px_48px] items-center gap-3 rounded-[var(--zoru-radius)] px-1 py-2 text-[13px] text-zoru-ink hover:bg-zoru-surface"
                  >
                    <span>{item.phone}</span>
                    <span className="text-zoru-ink-muted">
                      {item.reason || '--'}
                    </span>
                    <span className="text-[12px] text-zoru-ink-muted">
                      {item.optedOutAt
                        ? fmtDate(item.optedOutAt)
                        : '--'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-zoru-ink-muted hover:text-zoru-danger"
                      onClick={() => handleRemove(item._id)}
                      disabled={isPending}
                      aria-label={`Remove ${item.phone}`}
                    >
                      {isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar settings */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="mb-1 flex items-center gap-2 text-[15px] font-medium text-zoru-ink">
              <Bot className="h-4 w-4 text-zoru-ink-muted" /> AI Settings
            </h2>
            <p className="mb-4 text-[12px] text-zoru-ink-muted leading-relaxed">
              Auto-add contacts to opt-out list based on sentiment analysis of inbound messages (e.g. "stop messaging me", "unsubscribe").
            </p>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-sentiment-switch" className="cursor-pointer">
                Enable Sentiment Auto-Opt-Out
              </Label>
              <Switch
                id="auto-sentiment-switch"
                checked={autoSentiment}
                onCheckedChange={(c) => {
                  setAutoSentiment(c);
                  toast({
                    title: c ? 'Enabled' : 'Disabled',
                    description: 'Sentiment analysis auto opt-out updated.',
                  });
                }}
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="h-6" />
    </div>
  );
}
