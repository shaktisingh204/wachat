'use client';

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  Filter,
  Plus,
  Trash2,
  Play,
  Loader2,
  Hash,
  Clock,
  Star,
  StarOff,
} from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

import {
  useZoruToast,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { fmtDate } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import {
  getConversationFilters,
  saveConversationFilter,
  deleteConversationFilter,
} from '@/app/actions/wachat-features.actions';

/**
 * /wachat/conversation-filters - Saved filter presets. Each filter
 * card shows usage count, last-applied timestamp, and a "default"
 * toggle stored client-side. The create form lives inside a Sheet.
 */

const DEFAULT_KEY = 'wachat:default-filter';

export default function ConversationFiltersPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [filters, setFilters] = useState<any[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [form, setForm] = useState({
    name: '',
    status: '',
    tag: '',
    agent: '',
    dateFrom: '',
    dateTo: '',
  });
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [appliedAt, setAppliedAt] = useState<Record<string, string>>({});
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDefaultId(window.localStorage.getItem(DEFAULT_KEY));
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getConversationFilters(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setFilters(res.filters ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => {
    if (!form.name.trim() || !projectId) return;
    const conditions: Record<string, any> = {};
    if (form.status) conditions.status = form.status;
    if (form.tag) conditions.tag = form.tag;
    if (form.agent) conditions.agent = form.agent;
    if (form.dateFrom) conditions.dateFrom = form.dateFrom;
    if (form.dateTo) conditions.dateTo = form.dateTo;
    startMutateTransition(async () => {
      const res = await saveConversationFilter(projectId, form.name.trim(), conditions);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Filter created', description: res.message });
      setForm({ name: '', status: '', tag: '', agent: '', dateFrom: '', dateTo: '' });
      setShowSheet(false);
      fetchData();
    });
  };

  const handleDelete = (filterId: string) => {
    startMutateTransition(async () => {
      const res = await deleteConversationFilter(filterId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Deleted', description: 'Filter removed.' });
      if (defaultId === filterId) {
        setDefaultId(null);
        try { window.localStorage.removeItem(DEFAULT_KEY); } catch { /* ignore */ }
      }
      fetchData();
    });
  };

  const toggleDefault = (filterId: string, filterName: string) => {
    if (defaultId === filterId) {
      setDefaultId(null);
      try { window.localStorage.removeItem(DEFAULT_KEY); } catch { /* ignore */ }
      toast({ title: 'Default cleared' });
    } else {
      setDefaultId(filterId);
      try { window.localStorage.setItem(DEFAULT_KEY, filterId); } catch { /* ignore */ }
      toast({ title: 'Default set', description: `"${filterName}" will load by default.` });
    }
  };

  const applyFilter = (f: any) => {
    setAppliedAt((prev) => ({ ...prev, [f._id]: new Date().toISOString() }));
    toast({ title: 'Applied', description: `Filter "${f.name}" applied.` });
  };

  const totalUsage = useMemo(
    () => filters.reduce((s, f) => s + (Number(f.usageCount) || 0), 0),
    [filters],
  );
  const recentlyApplied = useMemo(() => {
    const candidates: { id: string; ts: string }[] = [];
    for (const f of filters) {
      const last = appliedAt[f._id] || f.lastAppliedAt || f.lastUsedAt;
      if (last) candidates.push({ id: f._id, ts: last });
    }
    candidates.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return candidates[0] || null;
  }, [filters, appliedAt]);

  return (
    <WaPage>
      <PageHeader
        title="Conversation filters"
        description="Save filter presets so the inbox is one click away from the conversations you care about."
        kicker="Wachat · filters"
        backHref="/wachat"
        eyebrowIcon={Filter}
        actions={
          <WaButton leftIcon={Plus} onClick={() => setShowSheet(true)}>
            New filter
          </WaButton>
        }
      />

      {/* KPI strip */}
      <section aria-labelledby="filter-kpis" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <h2 id="filter-kpis" className="sr-only">Filter stats</h2>
        <MetricTile label="Saved filters" value={filters.length.toLocaleString('en-IN')} icon={Filter} delay={0} />
        <MetricTile label="Total applications" value={totalUsage.toLocaleString('en-IN')} icon={Hash} delay={0.04} />
        <MetricTile
          label="Default filter"
          value={defaultId ? (filters.find((f) => f._id === defaultId)?.name || '--') : 'None set'}
          icon={Star}
          delay={0.08}
        />
        <MetricTile
          label="Last applied"
          value={recentlyApplied ? fmtDate(recentlyApplied.ts) : '--'}
          icon={Clock}
          delay={0.12}
        />
      </section>

      {isLoading && filters.length === 0 ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : filters.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {filters.map((f, i) => {
              const c = f.conditions || {};
              const chips = [
                c.status && { label: c.status },
                c.tag && { label: c.tag },
                c.agent && { label: c.agent },
                (c.dateFrom || c.dateTo) && {
                  label: `${c.dateFrom || '…'} → ${c.dateTo || '…'}`,
                },
              ].filter(Boolean) as { label: string }[];
              const usage = Number(f.usageCount) || 0;
              const lastApplied = appliedAt[f._id] || f.lastAppliedAt || f.lastUsedAt;
              const isDefault = defaultId === f._id;
              return (
                <m.li
                  key={f._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.35, delay: i * 0.04, ease: EASE_OUT }}
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px]"
                  style={{ boxShadow: '0 0 0 1px transparent' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px transparent'; }}
                >
                  {isDefault && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
                      style={{ backgroundColor: 'var(--mt-accent)' }}
                    />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-[14px] font-semibold tracking-tight text-zinc-950">{f.name}</h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleDefault(f._id, f.name)}
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-150 active:scale-[0.94] ${
                          isDefault ? 'text-amber-500 hover:bg-amber-50' : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900'
                        }`}
                        aria-label={isDefault ? 'Clear default' : 'Save as default'}
                        title={isDefault ? 'Default filter' : 'Save as default'}
                      >
                        {isDefault ? (
                          <Star className="h-3.5 w-3.5 fill-current" strokeWidth={2} />
                        ) : (
                          <StarOff className="h-3.5 w-3.5" strokeWidth={2.25} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(f._id)}
                        disabled={isMutating}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.94]"
                        aria-label={`Delete ${f.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </div>
                  </div>
                  {chips.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {chips.map((chip, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-700"
                        >
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2.5 text-[11px] italic text-zinc-400">No conditions set</p>
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[11px]">
                    <dt className="inline-flex items-center gap-1 text-zinc-500">
                      <Hash className="h-3 w-3" strokeWidth={2} aria-hidden /> Uses
                    </dt>
                    <dd className="text-right font-semibold tabular-nums text-zinc-900">
                      {usage.toLocaleString('en-IN')}
                    </dd>
                    <dt className="inline-flex items-center gap-1 text-zinc-500">
                      <Clock className="h-3 w-3" strokeWidth={2} aria-hidden /> Last applied
                    </dt>
                    <dd className="text-right tabular-nums text-zinc-700">
                      {lastApplied ? fmtDate(lastApplied) : '--'}
                    </dd>
                  </dl>
                  <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5">
                    <WaButton size="sm" variant="ghost" leftIcon={Play} onClick={() => applyFilter(f)}>
                      Apply
                    </WaButton>
                    {isDefault && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em]"
                        style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
                      >
                        Default
                      </span>
                    )}
                  </div>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <EmptyState
          icon={Filter}
          title="No saved filters yet"
          description="Save common search criteria so you can find a slice of conversations in a single click."
          action={
            <WaButton leftIcon={Plus} onClick={() => setShowSheet(true)}>
              Create your first filter
            </WaButton>
          }
        />
      )}

      {/* Create-filter sheet */}
      <Sheet open={showSheet} onOpenChange={setShowSheet}>
        <ZoruSheetContent side="right" className="w-full sm:max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Create filter</ZoruSheetTitle>
            <ZoruSheetDescription>
              Define criteria for a reusable conversation filter.
            </ZoruSheetDescription>
          </ZoruSheetHeader>

          <div className="mt-5 grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-name">Filter name</Label>
              <Input
                id="filter-name"
                placeholder="My filter"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Any status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="open">Open</ZoruSelectItem>
                  <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                  <ZoruSelectItem value="resolved">Resolved</ZoruSelectItem>
                  <ZoruSelectItem value="closed">Closed</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-tag">Tag</Label>
              <Input
                id="filter-tag"
                placeholder="e.g. priority"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Agent</Label>
              <Select value={form.agent} onValueChange={(v) => setForm({ ...form, agent: v })}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Any agent" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="unassigned">Unassigned</ZoruSelectItem>
                  <ZoruSelectItem value="me">Assigned to me</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-from">From</Label>
                <Input
                  id="filter-from"
                  type="date"
                  value={form.dateFrom}
                  onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-to">To</Label>
                <Input
                  id="filter-to"
                  type="date"
                  value={form.dateTo}
                  onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
                />
              </div>
            </div>
          </div>

          <ZoruSheetFooter className="mt-6">
            <WaButton variant="outline" onClick={() => setShowSheet(false)} disabled={isMutating}>
              Cancel
            </WaButton>
            <WaButton
              onClick={handleCreate}
              leftIcon={isMutating ? Loader2 : Plus}
              disabled={!form.name.trim() || isMutating}
            >
              Save filter
            </WaButton>
          </ZoruSheetFooter>
        </ZoruSheetContent>
      </Sheet>
    </WaPage>
  );
}
