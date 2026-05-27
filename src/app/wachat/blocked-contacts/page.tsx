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
  Ban,
  ShieldOff,
  Plus,
  Loader2,
  Search as SearchIcon,
  CalendarPlus,
  CalendarMinus,
  Filter,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getBlockedContacts,
  blockContact,
  unblockContact,
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

export default function BlockedContactsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const reduceMotion = useReducedMotion();

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getBlockedContacts(activeProjectId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setContacts(res.contacts ?? []);
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBlock = () => {
    if (!activeProjectId || !phone.trim()) return;
    startTransition(async () => {
      const res = await blockContact(activeProjectId, phone.trim(), reason.trim());
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        toast({ title: 'Blocked', description: `${phone} has been blocked.` });
        setPhone('');
        setReason('');
        setOpen(false);
        fetchData();
      }
    });
  };

  const handleUnblock = (id: string) => {
    startTransition(async () => {
      const res = await unblockContact(id);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        toast({ title: 'Unblocked', description: 'Contact unblocked.' });
        fetchData();
      }
    });
  };

  const stats = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const addedThisWeek = contacts.filter((c) => c.blockedAt && now - new Date(c.blockedAt).getTime() < week).length;
    const unblockedThisWeek = contacts.filter((c) => c.unblockedAt && now - new Date(c.unblockedAt).getTime() < week).length;
    const scopes = new Set(contacts.map((c) => c.blockedFrom || 'project').filter(Boolean));
    return { total: contacts.length, addedThisWeek, unblockedThisWeek, scopes };
  }, [contacts]);

  const filtered = useMemo(() => {
    let rows = contacts.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) =>
        (c.phone || '').toLowerCase().includes(q) ||
        (c.reason || '').toLowerCase().includes(q),
      );
    }
    if (scopeFilter !== 'all') {
      rows = rows.filter((c) => (c.blockedFrom || 'project') === scopeFilter);
    }
    return rows;
  }, [contacts, search, scopeFilter]);

  const isLoadingInitial = isPending && contacts.length === 0;
  const stagger = reduceMotion ? 0 : 0.025;
  const scopeList = Array.from(stats.scopes);

  return (
    <WaPage>
      <PageHeader
        title="Blocked contacts"
        description="Manage contacts blocked from sending messages to this project."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
              <WaButton leftIcon={Plus}>Block contact</WaButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
              <ZoruDialogHeader>
                <ZoruDialogTitle>Block a contact</ZoruDialogTitle>
                <ZoruDialogDescription>
                  Block a phone number from sending messages to this project.
                </ZoruDialogDescription>
              </ZoruDialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="block-phone" required>Phone number</Label>
                  <Input
                    id="block-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="rounded-lg"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="block-reason">Reason (optional)</Label>
                  <Input
                    id="block-reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this contact being blocked?"
                    className="rounded-lg"
                  />
                </div>
              </div>
              <ZoruDialogFooter>
                <WaButton variant="outline" onClick={() => setOpen(false)}>Cancel</WaButton>
                <WaButton onClick={handleBlock} disabled={isPending || !phone.trim()} leftIcon={isPending ? Loader2 : Ban}>
                  Block
                </WaButton>
              </ZoruDialogFooter>
            </ZoruDialogContent>
          </Dialog>
        }
      />

      {/* KPI strip */}
      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile label="Total blocked" value={stats.total.toLocaleString()} icon={Ban} delay={0} />
        <MetricTile label="Blocked this week" value={stats.addedThisWeek.toLocaleString()} icon={CalendarPlus} delay={0.05} />
        <MetricTile label="Unblocked this week" value={stats.unblockedThisWeek.toLocaleString()} icon={CalendarMinus} delay={0.1} />
      </section>

      <Section
        title="Blocked numbers"
        action={<StatusPill tone="failed">{stats.total} blocked</StatusPill>}
        padded={false}
      >
        {/* Filter bar */}
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
          {scopeList.length > 0 && (
            <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  scopeFilter === 'all' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900',
                )}
              >
                <Filter className="mr-1 inline h-3 w-3" strokeWidth={2.25} />
                All scopes
              </button>
              {scopeList.map((s) => (
                <button
                  key={String(s)}
                  type="button"
                  onClick={() => setScopeFilter(String(s))}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors',
                    scopeFilter === s ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900',
                  )}
                >
                  {String(s)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Column header */}
        <div className="hidden items-center gap-3 border-b border-zinc-100 bg-zinc-50/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 md:flex">
          <span className="w-7" />
          <span className="flex-1">Phone</span>
          <span className="w-[180px]">Reason</span>
          <span className="w-[130px]">Blocked from</span>
          <span className="w-[140px]">Blocked by</span>
          <span className="w-[120px]">Blocked at</span>
          <span className="w-[90px] text-right">Action</span>
        </div>

        {isLoadingInitial ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-32 animate-pulse rounded-full bg-zinc-100" />
                  <div className="h-2 w-44 animate-pulse rounded-full bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={Ban}
              title={contacts.length === 0 ? 'No blocked contacts' : 'No matching contacts'}
              description={
                contacts.length === 0
                  ? 'Use the Block contact button above to block a phone number from contacting your project.'
                  : 'Try a different search or scope.'
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {filtered.map((c, i) => (
                <m.li
                  key={c._id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: i * stagger, ease: EASE_OUT }}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50/70"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600">
                    <Ban className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <p className="flex-1 truncate font-mono text-[12.5px] tabular-nums text-zinc-900">{c.phone}</p>
                  <p className="hidden w-[180px] truncate text-[11.5px] text-zinc-500 md:block">
                    {c.reason || <span className="text-zinc-300">-</span>}
                  </p>
                  <p className="hidden w-[130px] truncate text-[11px] capitalize text-zinc-600 md:block">
                    {c.blockedFrom || 'project'}
                  </p>
                  <p className="hidden w-[140px] truncate text-[11px] text-zinc-500 md:block">
                    {c.blockedBy || c.userEmail || <span className="text-zinc-300">-</span>}
                  </p>
                  <p className="hidden w-[120px] truncate text-[11px] tabular-nums text-zinc-500 md:block">
                    {c.blockedAt ? fmtDate(c.blockedAt) : <span className="text-zinc-300">-</span>}
                  </p>
                  <div className="w-[90px] text-right">
                    <ZoruAlertDialog>
                      <ZoruAlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 active:scale-[0.97]"
                          disabled={isPending}
                        >
                          <ShieldOff className="h-3 w-3" strokeWidth={2.25} />
                          Unblock
                        </button>
                      </ZoruAlertDialogTrigger>
                      <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                          <ZoruAlertDialogTitle>Unblock this contact?</ZoruAlertDialogTitle>
                          <ZoruAlertDialogDescription>
                            {c.phone} will be allowed to send messages again.
                          </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                          <ZoruAlertDialogAction onClick={() => handleUnblock(c._id)}>
                            Unblock
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
