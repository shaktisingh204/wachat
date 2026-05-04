'use client';

/**
 * Wachat Opt-Out / DND — ZoruUI migration.
 * Single-add form, bulk-paste, list, export CSV, per-keyword stats.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  Download,
  Loader2,
  Plus,
  ShieldOff,
  Trash2,
  Upload,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  addToOptOut,
  getOptOutList,
  removeFromOptOut,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

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
      const res = await addToOptOut(String(activeProject?._id ?? ''), p);
      if (res.success) ok++;
      else fail++;
    }
    toast({
      title: 'Bulk add complete',
      description: `${ok} added, ${fail} failed.`,
    });
    setBulkText('');
    load();
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
      <ZoruBreadcrumb>
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
      </ZoruBreadcrumb>

      <div className="mt-5">
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Opt-out / DND management
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Manage numbers that have opted out of receiving messages.
        </p>
      </div>

      {/* Add form */}
      <ZoruCard className="mt-6 p-5">
        <h2 className="mb-4 text-[15px] text-zoru-ink">Add to opt-out list</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="opt-phone">Phone number</ZoruLabel>
            <ZoruInput
              id="opt-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              required
              className="w-52"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <ZoruLabel htmlFor="opt-reason">Reason</ZoruLabel>
            <ZoruInput
              id="opt-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. User requested"
            />
          </div>
          <ZoruButton type="submit" size="sm">
            <Plus /> Add
          </ZoruButton>
        </form>
      </ZoruCard>

      {/* Bulk paste */}
      <ZoruCard className="mt-4 p-5">
        <h2 className="mb-3 text-[15px] text-zoru-ink">Bulk add</h2>
        <p className="mb-2 text-[12px] text-zoru-ink-muted">
          Paste multiple phone numbers separated by newlines or commas.
        </p>
        <ZoruTextarea
          rows={4}
          placeholder={'+919876543210\n+919876543211\n+919876543212'}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
        />
        <ZoruButton
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={handleBulkPaste}
          disabled={!bulkText.trim()}
        >
          <Upload /> Bulk add
        </ZoruButton>
      </ZoruCard>

      {/* Per-keyword stats */}
      {keywordStats.length > 0 && (
        <ZoruCard className="mt-4 p-5">
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
        </ZoruCard>
      )}

      {/* List */}
      <ZoruCard className="mt-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] text-zoru-ink">Opt-out numbers</h2>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={list.length === 0}
          >
            <Download /> Export CSV
          </ZoruButton>
        </div>
        {isPending && list.length === 0 ? (
          <div className="flex flex-col gap-2">
            <ZoruSkeleton className="h-8 w-full" />
            <ZoruSkeleton className="h-8 w-full" />
            <ZoruSkeleton className="h-8 w-full" />
          </div>
        ) : !isPending && list.length === 0 ? (
          <ZoruEmptyState
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
                    ? new Date(item.optedOutAt).toLocaleDateString()
                    : '--'}
                </span>
                <ZoruButton
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
                </ZoruButton>
              </div>
            ))}
          </div>
        )}
      </ZoruCard>

      <div className="h-6" />
    </div>
  );
}
