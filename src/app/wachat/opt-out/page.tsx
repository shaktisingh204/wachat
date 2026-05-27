'use client';

import {
  Input,
  Label,
  Textarea,
  useZoruToast,
  ZoruFileUploadCard,
  ZoruFileUploadItem,
  Switch,
  cn,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import {
  Download,
  Loader2,
  Plus,
  ShieldOff,
  Trash2,
  Upload,
  Bot,
  CalendarPlus,
  TrendingDown,
  Search as SearchIcon,
  ListChecks,
  Tag as TagIcon,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { useProject } from '@/context/project-context';
import {
  addToOptOut,
  getOptOutList,
  removeFromOptOut,
} from '@/app/actions/wachat-features.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';
import { fmtDate } from '@/lib/utils';

const WA_GREEN = '#25D366';
const REASON_COLORS = ['#25D366', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9', '#10B981'];

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
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const reduceMotion = useReducedMotion();

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getOptOutList(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
      if (!/\d/.test(p)) {
        fail++;
        continue;
      }
      try {
        const res = await addToOptOut(String(activeProject?._id ?? ''), p);
        if (res.success) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    toast({ title: 'Bulk add complete', description: `${ok} added, ${fail} failed.` });
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
          } catch {
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
                errorMessage: failCount > 0 ? `${failCount} rows failed` : undefined,
              }
            : ui
        )
      );

      toast({ title: 'CSV upload complete', description: `${successCount} added, ${failCount} failed.` });
      load();
    } catch {
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

  const keywordStats = useMemo(() => {
    const map = new Map<string, number>();
    list.forEach((item) => {
      const key = (item.reason || 'No reason').trim() || 'No reason';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [list]);

  const stats = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;
    const optedOutToday = list.filter((i) => i.optedOutAt && now - new Date(i.optedOutAt).getTime() < day).length;
    const optedOutThisWeek = list.filter((i) => i.optedOutAt && now - new Date(i.optedOutAt).getTime() < week).length;
    const withReason = list.filter((i) => !!i.reason).length;
    const reasonPct = list.length > 0 ? Math.round((withReason / list.length) * 100) : 0;
    return {
      total: list.length,
      today: optedOutToday,
      week: optedOutThisWeek,
      reasons: keywordStats.length,
      withReason,
      reasonPct,
    };
  }, [list, keywordStats.length]);

  const chartData = useMemo(
    () => keywordStats.slice(0, 8).map(([k, n]) => ({ name: k.length > 18 ? k.slice(0, 18) + '...' : k, value: n })),
    [keywordStats],
  );

  const filteredList = useMemo(() => {
    let rows = list.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        (r.phone || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q),
      );
    }
    if (reasonFilter !== 'all') {
      rows = rows.filter((r) => (r.reason || 'No reason') === reasonFilter);
    }
    return rows;
  }, [list, search, reasonFilter]);

  const stagger = reduceMotion ? 0 : 0.02;

  return (
    <WaPage>
      <PageHeader
        title="Opt-out / DND"
        description="Manage numbers that have opted out of receiving messages."
        kicker="Wachat · contacts"
        backHref="/wachat"
        actions={
          <WaButton variant="outline" onClick={handleExport} disabled={list.length === 0} leftIcon={Download}>
            Export CSV
          </WaButton>
        }
      />

      {/* 6-tile KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Total opted-out" value={stats.total.toLocaleString()} icon={ShieldOff} delay={0} />
        <MetricTile label="Opted-out today" value={stats.today.toLocaleString()} icon={CalendarPlus} delay={0.04} />
        <MetricTile label="Opted-out 7d" value={stats.week.toLocaleString()} icon={TrendingDown} delay={0.08} />
        <MetricTile label="Unique reasons" value={stats.reasons.toLocaleString()} icon={ListChecks} delay={0.12} />
        <MetricTile label="With reason" value={`${stats.reasonPct}%`} icon={TagIcon} delay={0.16} />
        <MetricTile label="Auto-opt-out" value={autoSentiment ? 'On' : 'Off'} icon={Bot} delay={0.2} />
      </section>

      {/* Per-reason chart */}
      {chartData.length > 0 && (
        <Section title="Per-reason breakdown" description="Top reasons people opt out of your messages." className="mb-4">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} interval={0} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #eaeaea', fontSize: 11 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* Add form */}
          <Section title="Add to opt-out list">
            <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="opt-phone">Phone number</Label>
                <Input
                  id="opt-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  required
                  className="w-52 rounded-lg"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="opt-reason">Reason</Label>
                <Input
                  id="opt-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. User requested"
                  className="rounded-lg"
                />
              </div>
              <WaButton type="submit" leftIcon={Plus}>Add</WaButton>
            </form>
          </Section>

          {/* Bulk paste */}
          <Section title="Bulk add" description="Paste multiple phone numbers separated by newlines or commas.">
            <Textarea
              rows={4}
              placeholder={'+919876543210\n+919876543211\n+919876543212'}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <div className="mt-3">
              <WaButton variant="outline" size="sm" onClick={handleBulkPaste} disabled={!bulkText.trim()} leftIcon={Upload}>
                Bulk add
              </WaButton>
            </div>
          </Section>

          {/* CSV upload */}
          <Section title="Upload CSV" description="Upload a CSV file containing opt-outs. Expected columns: phone, reason (optional).">
            <ZoruFileUploadCard
              accept=".csv"
              hint="CSV up to 5MB"
              maxSize={5 * 1024 * 1024}
              onFilesSelected={handleFilesSelected}
              items={uploadItems}
              onRemove={(id) => setUploadItems((p) => p.filter((i) => i.id !== id))}
            />
          </Section>

          {/* List */}
          <Section
            title="Opt-out numbers"
            description={`${filteredList.length.toLocaleString()} of ${list.length.toLocaleString()}`}
            padded={false}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
              <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 focus-within:border-zinc-400">
                <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search phone or reason..."
                  className="h-7 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0"
                />
              </div>
              {keywordStats.length > 0 && (
                <select
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                  className="h-8 rounded-full border border-zinc-200 bg-white px-2.5 text-[11.5px] font-semibold text-zinc-700"
                >
                  <option value="all">All reasons</option>
                  {keywordStats.map(([k]) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Column header */}
            <div className="hidden items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 md:flex">
              <span className="flex-1">Phone</span>
              <span className="flex-1">Reason</span>
              <span className="w-[140px]">Opted out at</span>
              <span className="w-[44px]" />
            </div>

            {isPending && list.length === 0 ? (
              <div className="divide-y divide-zinc-100">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
                  </div>
                ))}
              </div>
            ) : !isPending && filteredList.length === 0 ? (
              <div className="px-5 py-12">
                <EmptyState
                  icon={ShieldOff}
                  title={list.length === 0 ? 'No opt-out numbers recorded' : 'No matching numbers'}
                  description={list.length === 0 ? 'Numbers added here will be skipped from outbound campaigns.' : 'Try a different search or reason filter.'}
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                <AnimatePresence initial={false}>
                  {filteredList.map((item, i) => {
                    const reasonIdx = keywordStats.findIndex(([k]) => k === (item.reason || 'No reason'));
                    const reasonColor = reasonIdx >= 0 ? REASON_COLORS[reasonIdx % REASON_COLORS.length] : '#a1a1aa';
                    return (
                      <m.li
                        key={item._id}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: i * stagger, ease: EASE_OUT }}
                        className={cn(
                          'grid grid-cols-[1fr_1fr_140px_44px] items-center gap-3 px-4 py-2 text-[12.5px] hover:bg-zinc-50/70',
                        )}
                      >
                        <span className="truncate font-mono tabular-nums text-zinc-900">{item.phone}</span>
                        <span className="flex items-center gap-1.5 truncate text-zinc-600">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: reasonColor }} />
                          {item.reason || <span className="text-zinc-400">No reason</span>}
                        </span>
                        <span className="truncate text-[11px] tabular-nums text-zinc-500">
                          {item.optedOutAt ? fmtDate(item.optedOutAt) : '-'}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${item.phone}`}
                          onClick={() => handleRemove(item._id)}
                          disabled={isPending}
                          className="grid h-7 w-7 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97]"
                        >
                          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />}
                        </button>
                      </m.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </Section>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Section
            title={
              <span className="inline-flex items-center gap-2">
                <Bot className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden style={{ color: 'var(--mt-accent)' }} />
                AI settings
              </span>
            }
            description="Auto-add contacts to opt-out list based on sentiment of inbound messages (e.g. &ldquo;stop messaging me&rdquo;, &ldquo;unsubscribe&rdquo;)."
          >
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-sentiment-switch" className="cursor-pointer">
                Enable sentiment auto-opt-out
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
          </Section>

          {keywordStats.length > 0 && (
            <Section title="Per-reason breakdown">
              <ul className="space-y-2">
                {keywordStats.slice(0, 8).map(([k, n], i) => {
                  const pct = list.length > 0 ? Math.round((n / list.length) * 100) : 0;
                  const color = REASON_COLORS[i % REASON_COLORS.length];
                  return (
                    <li key={k}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1.5 truncate font-semibold text-zinc-700">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate">{k}</span>
                        </span>
                        <span className="tabular-nums text-zinc-500">{n} · {pct}%</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100">
                        <m.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, ease: EASE_OUT }}
                          className="h-full"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </WaPage>
  );
}
