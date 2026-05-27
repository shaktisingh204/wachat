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
  Input,
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
  Search,
  GitMerge,
  Check,
  Loader2,
  Users,
  ArrowRight,
  MessageSquare,
  StickyNote,
  Tag as TagIcon,
  AlertCircle,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getContactsPageData, updateContactTags } from '@/app/actions/contact.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

const WA_GREEN = '#25D366';

function monogram(name: string | undefined | null): string {
  const s = (name || '').trim();
  if (!s) return '??';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type ConflictChoice = 'primary' | 'secondary';

const FIELD_KEYS: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'waId', label: 'WhatsApp ID' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'assignedAgentId', label: 'Assigned agent' },
  { key: 'lastMessage', label: 'Last message' },
];

export default function ContactMergePage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<[string | null, string | null]>([null, null]);
  const [merging, setMerging] = useState(false);
  const [conflicts, setConflicts] = useState<Record<string, ConflictChoice>>({});
  const reduceMotion = useReducedMotion();

  const load = useCallback(
    (search = '') => {
      if (!activeProject?._id) return;
      startTransition(async () => {
        const res = await getContactsPageData(
          String(activeProject._id),
          undefined,
          1,
          search,
        );
        setContacts(res.contacts ?? []);
      });
    },
    [activeProject?._id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => load(query);

  const selectContact = (id: string) => {
    if (selected[0] === id) {
      setSelected([null, selected[1]]);
      return;
    }
    if (selected[1] === id) {
      setSelected([selected[0], null]);
      return;
    }
    if (!selected[0]) setSelected([id, selected[1]]);
    else if (!selected[1]) setSelected([selected[0], id]);
    else setSelected([id, null]);
  };

  const contactA = contacts.find((c) => c._id === selected[0]);
  const contactB = contacts.find((c) => c._id === selected[1]);

  // Initialize conflict choices when pair changes
  useEffect(() => {
    if (!contactA || !contactB) return;
    const next: Record<string, ConflictChoice> = {};
    for (const f of FIELD_KEYS) {
      const a = (contactA as any)[f.key];
      const b = (contactB as any)[f.key];
      // Default: prefer primary if it has a value; else secondary.
      next[f.key] = a ? 'primary' : b ? 'secondary' : 'primary';
    }
    setConflicts(next);
  }, [contactA, contactB]);

  const handleMerge = async () => {
    if (!contactA || !contactB) return;
    setMerging(true);
    const combinedTags = [...new Set([...(contactA.tagIds || []), ...(contactB.tagIds || [])])];
    const res = await updateContactTags(contactA._id, combinedTags);
    if (res.success) {
      toast({
        title: 'Merged',
        description: `Tags from "${contactB.name || contactB.waId}" merged into "${contactA.name || contactA.waId}".`,
      });
      setSelected([null, null]);
      load(query);
    } else {
      toast({ title: 'Error', description: res.error || 'Merge failed.', variant: 'destructive' });
    }
    setMerging(false);
  };

  const diffFields = useMemo(() => {
    if (!contactA || !contactB) return [] as { key: string; label: string; a: any; b: any; conflict: boolean }[];
    return FIELD_KEYS.map((f) => {
      const a = (contactA as any)[f.key];
      const b = (contactB as any)[f.key];
      return { key: f.key, label: f.label, a, b, conflict: !!a && !!b && a !== b };
    });
  }, [contactA, contactB]);

  const auditSummary = useMemo(() => {
    if (!contactA || !contactB) return null;
    const tagsA = contactA.tagIds?.length || 0;
    const tagsB = contactB.tagIds?.length || 0;
    const combinedTags = new Set([...(contactA.tagIds || []), ...(contactB.tagIds || [])]).size;
    const unreadA = contactA.unreadCount || 0;
    const unreadB = contactB.unreadCount || 0;
    return { tagsA, tagsB, combinedTags, unreadA, unreadB };
  }, [contactA, contactB]);

  const renderContactColumn = (
    c: any,
    label: string,
    tone: 'primary' | 'secondary',
  ) => (
    <div className="flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/50 px-3.5 py-2">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: tone === 'primary' ? WA_GREEN : '#a1a1aa' }}
          />
          <span style={{ color: tone === 'primary' ? WA_GREEN : '#71717a' }}>{label}</span>
        </span>
        <StatusPill tone={tone === 'primary' ? 'live' : 'draft'}>
          {tone === 'primary' ? 'Keep' : 'Merge'}
        </StatusPill>
      </header>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-full text-[12px] font-semibold text-white"
            style={{ backgroundColor: tone === 'primary' ? WA_GREEN : '#71717a' }}
          >
            {monogram(c.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-zinc-950">{c.name || 'Unknown'}</p>
            <p className="truncate font-mono text-[11.5px] tabular-nums text-zinc-500">{c.waId || '-'}</p>
          </div>
        </div>

        <dl className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
          {diffFields.map((f) => {
            const isOurValue = tone === 'primary' ? f.a : f.b;
            const isWinning = conflicts[f.key] === tone;
            return (
              <div
                key={f.key}
                className={cn(
                  'flex items-center justify-between gap-3 py-2 transition-colors',
                  f.conflict && isWinning && 'bg-emerald-50/40 -mx-4 px-4',
                  f.conflict && !isWinning && 'opacity-60',
                )}
              >
                <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">{f.label}</dt>
                <dd className="max-w-[60%] truncate text-right text-[12px] tabular-nums text-zinc-900">
                  {isOurValue || <span className="text-zinc-300">-</span>}
                </dd>
              </div>
            );
          })}
          <div className="flex items-center justify-between py-2">
            <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">Tags</dt>
            <dd className="font-mono tabular-nums text-[12px] text-zinc-900">{c.tagIds?.length || 0}</dd>
          </div>
          {c.createdAt && (
            <div className="flex items-center justify-between py-2">
              <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">Created</dt>
              <dd className="text-[11.5px] tabular-nums text-zinc-600">{fmtDate(c.createdAt)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );

  const isLoadingInitial = isPending && contacts.length === 0;
  const stagger = reduceMotion ? 0 : 0.02;

  return (
    <WaPage>
      <PageHeader
        title="Merge contacts"
        description="Find and merge duplicate contacts to keep your list clean."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
      />

      {/* Search */}
      <Section padded={false} className="mb-4">
        <div className="flex items-center gap-3 p-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-zinc-400">
            <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search contacts by name or phone..."
              className="h-7 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0"
            />
          </div>
          <WaButton onClick={handleSearch} disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
          </WaButton>
        </div>
      </Section>

      {/* Compare & merge surface */}
      {contactA && contactB && (
        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="mb-4"
        >
          <div className="flex flex-col items-stretch gap-3 lg:flex-row">
            {renderContactColumn(contactA, 'Primary (keep)', 'primary')}
            <div className="grid place-items-center lg:px-1">
              <span
                aria-hidden
                className="grid h-10 w-10 place-items-center rounded-full text-white"
                style={{ backgroundColor: WA_GREEN, boxShadow: `0 10px 24px -12px ${WA_GREEN}88` }}
              >
                <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
              </span>
            </div>
            {renderContactColumn(contactB, 'Secondary (merge into primary)', 'secondary')}
          </div>

          {/* Conflict resolver */}
          {diffFields.some((f) => f.conflict) && (
            <Section
              title="Resolve conflicts"
              description="For each conflicting field, choose which value the merged contact will keep."
              className="mt-3"
            >
              <ul className="divide-y divide-zinc-100">
                {diffFields.filter((f) => f.conflict).map((f) => (
                  <li key={f.key} className="flex items-center gap-3 py-2">
                    <div className="w-[140px] shrink-0">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">{f.label}</p>
                      <p className="text-[10px] text-amber-600">conflict</p>
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      {(['primary', 'secondary'] as const).map((side) => {
                        const value = side === 'primary' ? f.a : f.b;
                        const active = conflicts[f.key] === side;
                        return (
                          <button
                            key={side}
                            type="button"
                            onClick={() => setConflicts((prev) => ({ ...prev, [f.key]: side }))}
                            className={cn(
                              'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[12px] transition-colors',
                              active
                                ? 'border-emerald-400 bg-emerald-50/60 text-zinc-900'
                                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
                            )}
                          >
                            <span className="truncate">{value || <span className="text-zinc-300">-</span>}</span>
                            <span
                              className={cn(
                                'grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition-colors',
                                active ? 'border-transparent text-white' : 'border-zinc-300',
                              )}
                              style={active ? { background: WA_GREEN } : undefined}
                            >
                              {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Audit-log preview */}
          {auditSummary && (
            <Section title="Audit log preview" className="mt-3">
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <li className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                  <TagIcon className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.25} />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">Tags</p>
                    <p className="text-[12.5px] font-semibold tabular-nums text-zinc-900">
                      {auditSummary.tagsA} + {auditSummary.tagsB} = {auditSummary.combinedTags}
                    </p>
                  </div>
                </li>
                <li className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                  <MessageSquare className="h-3.5 w-3.5 text-sky-600" strokeWidth={2.25} />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">Unread</p>
                    <p className="text-[12.5px] font-semibold tabular-nums text-zinc-900">
                      {auditSummary.unreadA + auditSummary.unreadB} carried over
                    </p>
                  </div>
                </li>
                <li className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                  <StickyNote className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.25} />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500">Notes</p>
                    <p className="text-[12.5px] font-semibold tabular-nums text-zinc-900">attached to primary</p>
                  </div>
                </li>
              </ul>
            </Section>
          )}

          <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[12px] text-amber-800">
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
              This action is permanent. Secondary contact will be discarded.
            </div>
            <ZoruAlertDialog>
              <ZoruAlertDialogTrigger asChild>
                <WaButton disabled={merging} leftIcon={merging ? Loader2 : GitMerge}>
                  {merging ? 'Merging...' : 'Merge contacts'}
                </WaButton>
              </ZoruAlertDialogTrigger>
              <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                  <ZoruAlertDialogTitle>Merge contacts?</ZoruAlertDialogTitle>
                  <ZoruAlertDialogDescription>
                    Tags from &ldquo;{contactB.name || contactB.waId}&rdquo; will be combined into &ldquo;{contactA.name || contactA.waId}&rdquo;. This cannot be undone.
                  </ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                  <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                  <ZoruAlertDialogAction onClick={handleMerge}>Merge</ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
              </ZoruAlertDialogContent>
            </ZoruAlertDialog>
          </div>
        </m.div>
      )}

      {/* Candidate list */}
      <Section
        title="Candidate contacts"
        description="Pick two contacts to compare and merge."
        padded={false}
      >
        {isLoadingInitial ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="h-4 w-4 animate-pulse rounded-md bg-zinc-100" />
                <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={Users}
              title="No contacts found"
              description={isPending ? 'Loading...' : 'Try a different search to surface duplicates.'}
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {contacts.map((c: any, i) => {
                const isSelected = selected.includes(c._id);
                const role = selected[0] === c._id ? 'A' : selected[1] === c._id ? 'B' : null;
                return (
                  <m.li
                    key={c._id}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: i * stagger, ease: EASE_OUT }}
                  >
                    <button
                      type="button"
                      onClick={() => selectContact(c._id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors duration-150',
                        isSelected ? 'bg-emerald-50/50' : 'hover:bg-zinc-50/70',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[9.5px] font-bold transition-colors',
                          isSelected ? 'border-transparent text-white' : 'border-zinc-300',
                        )}
                        style={isSelected ? { background: WA_GREEN } : undefined}
                      >
                        {role ? role : isSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold text-white"
                        style={{ backgroundColor: WA_GREEN }}
                      >
                        {monogram(c.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-zinc-900">{c.name || 'Unknown'}</p>
                        <p className="truncate font-mono text-[10.5px] tabular-nums text-zinc-500">{c.waId || '-'}</p>
                      </div>
                      <span className="hidden text-[10.5px] text-zinc-500 sm:block">
                        {c.lastMessageTimestamp ? fmtDate(c.lastMessageTimestamp) : 'no activity'}
                      </span>
                      <StatusPill tone="draft">{c.tagIds?.length || 0} tags</StatusPill>
                    </button>
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Section>
    </WaPage>
  );
}
