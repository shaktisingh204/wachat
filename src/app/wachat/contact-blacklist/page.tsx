'use client';

import { fmtDate } from '@/lib/utils';

import {
  useZoruToast,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Textarea,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import {
  ShieldBan,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Search as SearchIcon,
  CalendarPlus,
  Hash,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  bulkAddToBlacklist,
} from '@/app/actions/wachat-features.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

export default function ContactBlacklistPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();
  const reduceMotion = useReducedMotion();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getBlacklist(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setNumbers(res.numbers ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    const trimmed = phone.trim();
    if (!trimmed || !projectId) return;
    startMutateTransition(async () => {
      const res = await addToBlacklist(projectId, trimmed);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setPhone('');
      setReason('');
      toast({ title: 'Added', description: `${trimmed} blacklisted.` });
      fetchData();
    });
  };

  const handleBulkAdd = () => {
    if (!projectId) return;
    const phones = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (phones.length === 0) return;
    startMutateTransition(async () => {
      const res = await bulkAddToBlacklist(projectId, phones);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setBulkText('');
      setBulkOpen(false);
      toast({ title: 'Added', description: `${res.count} numbers blacklisted.` });
      fetchData();
    });
  };

  const handleRemove = (id: string, phoneNum: string) => {
    startMutateTransition(async () => {
      const res = await removeFromBlacklist(id);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Removed', description: `${phoneNum} removed from blacklist.` });
      fetchData();
    });
  };

  const stats = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const addedThisWeek = numbers.filter((n) => {
      const t = n.createdAt || n.addedAt;
      return t && now - new Date(t).getTime() < week;
    }).length;
    return {
      total: numbers.length,
      addedThisWeek,
      withReason: numbers.filter((n) => !!n.reason).length,
    };
  }, [numbers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return numbers;
    return numbers.filter((n) =>
      (n.phone || '').toLowerCase().includes(q) ||
      (n.reason || '').toLowerCase().includes(q),
    );
  }, [numbers, search]);

  const isLoadingInitial = isLoading && numbers.length === 0;
  const stagger = reduceMotion ? 0 : 0.025;

  return (
    <WaPage>
      <PageHeader
        title="Contact blacklist"
        description="Block phone numbers from sending messages to your project."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
        actions={
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <ZoruDialogTrigger asChild>
              <WaButton variant="outline" leftIcon={Upload}>Bulk add</WaButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
              <ZoruDialogHeader>
                <ZoruDialogTitle>Bulk add to blacklist</ZoruDialogTitle>
                <ZoruDialogDescription>
                  Paste one phone number per line. All numbers will be blocked from contacting this project.
                </ZoruDialogDescription>
              </ZoruDialogHeader>
              <Textarea
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'+1234567890\n+19876543210\n...'}
                className="min-h-[160px]"
              />
              <ZoruDialogFooter>
                <WaButton variant="outline" onClick={() => setBulkOpen(false)}>Cancel</WaButton>
                <WaButton onClick={handleBulkAdd} disabled={!bulkText.trim() || isMutating}>
                  {isMutating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add all
                </WaButton>
              </ZoruDialogFooter>
            </ZoruDialogContent>
          </Dialog>
        }
      />

      {/* 3-tile KPI strip */}
      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile label="Total blacklisted" value={stats.total.toLocaleString()} icon={ShieldBan} delay={0} />
        <MetricTile label="Added this week" value={stats.addedThisWeek.toLocaleString()} icon={CalendarPlus} delay={0.05} />
        <MetricTile label="With stated reason" value={stats.withReason.toLocaleString()} icon={Hash} delay={0.1} />
      </section>

      {/* Add a number */}
      <Section
        title="Add a number"
        description="Block individual phone numbers from this project."
        className="mb-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <Label htmlFor="bl-phone">Phone number</Label>
            <Input
              id="bl-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="rounded-lg"
            />
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <Label htmlFor="bl-reason">Reason (optional)</Label>
            <Input
              id="bl-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. spam, abuse, customer request"
              className="rounded-lg"
            />
          </div>
          <WaButton onClick={handleAdd} disabled={!phone.trim() || isMutating} leftIcon={Plus}>
            Block number
          </WaButton>
        </div>
      </Section>

      {/* List */}
      <Section
        title="Blocked numbers"
        action={<StatusPill tone="failed">{stats.total} blocked</StatusPill>}
        padded={false}
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 focus-within:border-zinc-400">
            <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone or reason..."
              className="h-7 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="hidden items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 md:flex">
          <span className="w-7" />
          <span className="w-9 text-right">#</span>
          <span className="flex-1">Phone</span>
          <span className="w-[180px]">Reason</span>
          <span className="w-[140px]">Added by</span>
          <span className="w-[120px]">Added at</span>
          <span className="w-[90px] text-right">Action</span>
        </div>

        {isLoadingInitial ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-100" />
                <div className="h-2.5 w-40 animate-pulse rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={ShieldBan}
              title={search ? 'No matching numbers' : 'No numbers blacklisted'}
              description={search ? 'Try a different search.' : 'Add phone numbers above to block them from contacting this project.'}
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {filtered.map((item, i) => (
                <m.li
                  key={item._id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: i * stagger, ease: EASE_OUT }}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50/70"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600">
                    <ShieldBan className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className="w-9 shrink-0 text-right text-[10px] font-semibold tabular-nums text-zinc-400">
                    {String(i + 1).padStart(3, '0')}
                  </span>
                  <p className="flex-1 truncate font-mono text-[12.5px] tabular-nums text-zinc-900">{item.phone}</p>
                  <p className="hidden w-[180px] truncate text-[11.5px] text-zinc-500 md:block">
                    {item.reason || <span className="text-zinc-300">-</span>}
                  </p>
                  <p className="hidden w-[140px] truncate text-[11px] text-zinc-500 md:block">
                    {item.addedBy || item.userId || <span className="text-zinc-300">-</span>}
                  </p>
                  <p className="hidden w-[120px] truncate text-[11px] tabular-nums text-zinc-500 md:block">
                    {item.createdAt || item.addedAt ? fmtDate(item.createdAt || item.addedAt) : <span className="text-zinc-300">-</span>}
                  </p>
                  <div className="w-[90px] text-right">
                    <ZoruAlertDialog>
                      <ZoruAlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 active:scale-[0.97]"
                          disabled={isMutating}
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                          Remove
                        </button>
                      </ZoruAlertDialogTrigger>
                      <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                          <ZoruAlertDialogTitle>Remove from blacklist?</ZoruAlertDialogTitle>
                          <ZoruAlertDialogDescription>
                            {item.phone} will be allowed to message your project again.
                          </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                          <ZoruAlertDialogAction
                            destructive
                            onClick={() => handleRemove(item._id, item.phone)}
                          >
                            Remove
                          </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                      </ZoruAlertDialogContent>
                    </ZoruAlertDialog>
                  </div>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Section>
    </WaPage>
  );
}
