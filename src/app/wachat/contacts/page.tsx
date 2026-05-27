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
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  Input,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  cn,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useCallback,
  useTransition,
  useMemo,
} from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { WithId } from 'mongodb';
import { useDebouncedCallback } from 'use-debounce';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import {
  AlertCircle,
  Search as SearchIcon,
  Users,
  Loader2,
  MessageSquare,
  Trash2,
  Tag as TagIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  ShieldCheck,
  ShieldOff,
  Ban,
  CalendarPlus,
  ArrowUpDown,
  X,
} from 'lucide-react';

import { getContactsPageData, deleteContact } from '@/app/actions/contact.actions';
import type { Contact, Tag } from '@/lib/definitions';
import { AddContactDialog } from '@/app/wachat/_components/add-contact-dialog';
import { ImportContactsDialog } from '@/app/wachat/_components/import-contacts-dialog';
import { SyncContactsDialog } from '@/app/wachat/_components/sync-contacts-dialog';
import { useProject } from '@/context/project-context';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  StatusPill,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const CONTACTS_PER_PAGE = 20;
const WA_GREEN = '#25D366';

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function monogram(name: string | undefined | null): string {
  const s = (name || '').trim();
  if (!s) return '??';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type SortKey = 'name' | 'lastActivity' | 'tags' | 'createdAt';

function TagsFilter({
  tags,
  selectedTags,
  onSelectionChange,
}: {
  tags: Tag[];
  selectedTags: string[];
  onSelectionChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onSelectionChange(
      selectedTags.includes(id)
        ? selectedTags.filter((t) => t !== id)
        : [...selectedTags, id],
    );
  };

  const label =
    selectedTags.length === 0
      ? 'All tags'
      : selectedTags.length === 1
        ? tags.find((t) => t._id === selectedTags[0])?.name || '1 tag'
        : `${selectedTags.length} tags`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ZoruPopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-[11.5px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 active:scale-[0.97]"
        >
          <TagIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          {label}
          <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.25} aria-hidden />
        </button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent className="w-[240px] p-0" align="end">
        <ZoruCommand>
          <ZoruCommandInput placeholder="Search tags..." />
          <ZoruCommandList>
            <ZoruCommandEmpty>No tags found.</ZoruCommandEmpty>
            <ZoruCommandGroup>
              {tags.length === 0 ? (
                <div className="px-2 py-6 text-center text-[12px] text-zinc-500">
                  No tags defined on this project yet.
                </div>
              ) : (
                tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag._id);
                  return (
                    <ZoruCommandItem
                      key={tag._id}
                      onSelect={() => toggle(tag._id)}
                      className="flex items-center gap-2"
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
                          isSelected
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 truncate text-[13px] text-zinc-900">
                        {tag.name}
                      </span>
                    </ZoruCommandItem>
                  );
                })
              )}
            </ZoruCommandGroup>
          </ZoruCommandList>
        </ZoruCommand>
      </ZoruPopoverContent>
    </Popover>
  );
}

function FacetChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] transition-colors',
        active
          ? 'bg-zinc-900 text-white'
          : 'text-zinc-700 hover:bg-zinc-100',
      )}
    >
      <span className="truncate font-semibold">{label}</span>
      {typeof count === 'number' && (
        <span
          className={cn(
            'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
            active ? 'bg-white/15 text-white' : 'bg-white text-zinc-500',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function DeleteContactButton({
  contact,
  onDeleted,
}: {
  contact: WithId<Contact>;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteContact(contact._id.toString());
      if (result.success) {
        toast({ title: 'Deleted', description: 'Contact has been deleted.' });
        onDeleted();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Delete contact"
          className="grid h-7 w-7 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97]"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Delete contact?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            Are you sure you want to delete {contact.name}? This action cannot be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction destructive onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

export default function ContactsPage() {
  const { activeProject, activeProjectId } = useProject();
  const [contacts, setContacts] = useState<WithId<Contact>[]>([]);
  const [isLoading, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const currentPage = Number(searchParams.get('page')) || 1;
  const searchQuery = searchParams.get('query') || '';
  const tagsParam = searchParams.get('tags');
  const sourceFacet = searchParams.get('source') || 'all';
  const statusFacet = searchParams.get('status') || 'all';
  const activityFacet = searchParams.get('activity') || 'all';
  const sortKey = (searchParams.get('sort') as SortKey) || 'lastActivity';
  const sortDir = (searchParams.get('dir') || 'desc') as 'asc' | 'desc';

  const selectedTags = useMemo(() => tagsParam?.split(',').filter(Boolean) || [], [tagsParam]);

  const [totalContacts, setTotalContacts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const { toast } = useZoruToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      try {
        const data = await getContactsPageData(
          activeProjectId,
          undefined,
          currentPage,
          searchQuery,
          selectedTags,
        );
        setContacts(data.contacts);
        setTotalContacts(data.total);
        setTotalPages(Math.max(1, Math.ceil(data.total / CONTACTS_PER_PAGE)));
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load contacts. Please ensure a project is selected.',
          variant: 'destructive',
        });
      }
    });
  }, [activeProjectId, currentPage, searchQuery, selectedTags, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelected(new Set());
  }, [currentPage, searchQuery, tagsParam]);

  const handleContactAdded = useCallback(() => {
    setTimeout(() => {
      fetchData();
      setRefreshKey((prev) => prev + 1);
      router.refresh();
    }, 300);
  }, [fetchData, router]);

  const updateSearchParam = useDebouncedCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value.trim() !== '') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== 'page') params.set('page', '1');
    router.replace(`${pathname}?${params.toString()}`);
  }, 300);

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.set('page', '1');
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleMessageContact = (contact: WithId<Contact>) => {
    router.push(`/wachat/chat?contactId=${contact._id.toString()}&phoneId=${contact.phoneNumberId}`);
  };

  const handleExportCsv = () => {
    toast({ title: 'Exporting...', description: 'CSV export will be available shortly.' });
  };

  const toggleSort = (key: SortKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sortKey === key) {
      params.set('dir', sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      params.set('sort', key);
      params.set('dir', 'desc');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Page-local derived facet view + sort.
  const view = useMemo(() => {
    let rows = contacts.slice();

    if (statusFacet === 'opted-in') rows = rows.filter((c) => !(c as any).isOptedOut);
    if (statusFacet === 'opted-out') rows = rows.filter((c) => (c as any).isOptedOut);
    if (statusFacet === 'with-tags') rows = rows.filter((c) => (c.tagIds || []).length > 0);

    if (activityFacet === '7d') {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      rows = rows.filter((c) => c.lastMessageTimestamp && new Date(c.lastMessageTimestamp).getTime() > cutoff);
    } else if (activityFacet === '30d') {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      rows = rows.filter((c) => c.lastMessageTimestamp && new Date(c.lastMessageTimestamp).getTime() > cutoff);
    } else if (activityFacet === 'never') {
      rows = rows.filter((c) => !c.lastMessageTimestamp);
    }

    if (sourceFacet === 'has-conversation') rows = rows.filter((c) => !!c.lastMessageTimestamp);
    if (sourceFacet === 'no-conversation') rows = rows.filter((c) => !c.lastMessageTimestamp);

    rows.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return mul * (a.name || '').localeCompare(b.name || '');
        case 'tags':
          return mul * ((a.tagIds || []).length - (b.tagIds || []).length);
        case 'createdAt': {
          const av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return mul * (av - bv);
        }
        case 'lastActivity':
        default: {
          const av = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
          const bv = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
          return mul * (av - bv);
        }
      }
    });
    return rows;
  }, [contacts, statusFacet, activityFacet, sourceFacet, sortKey, sortDir]);

  const stats = useMemo(() => {
    const optedIn = contacts.filter((c) => !(c as any).isOptedOut).length;
    const optedOut = contacts.filter((c) => (c as any).isOptedOut).length;
    const withTags = contacts.filter((c) => (c.tagIds || []).length > 0).length;
    const recent = contacts.filter((c) => {
      if (!c.lastMessageTimestamp) return false;
      return Date.now() - new Date(c.lastMessageTimestamp).getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length;
    const addedThisWeek = contacts.filter((c) => {
      if (!c.createdAt) return false;
      return Date.now() - new Date(c.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length;
    const hasConvo = contacts.filter((c) => !!c.lastMessageTimestamp).length;
    return { optedIn, optedOut, withTags, recent, addedThisWeek, hasConvo };
  }, [contacts]);

  if (!activeProjectId) {
    return (
      <WaPage>
        <PageHeader
          title="Contacts"
          description="Manage your customer contact list."
          kicker="Wachat · contacts"
          backHref="/wachat"
        />
        <EmptyState
          icon={AlertCircle}
          title="No project selected"
          description="Please select a project from the main dashboard to manage contacts."
          action={
            <WaButton href="/wachat" variant="outline">
              Pick a project
            </WaButton>
          }
        />
      </WaPage>
    );
  }

  const stagger = reduceMotion ? 0 : 0.02;
  const allOnPageSelected = view.length > 0 && view.every((c) => selected.has(c._id.toString()));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allOnPageSelected) setSelected(new Set());
    else setSelected(new Set(view.map((c) => c._id.toString())));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <WaPage>
      <PageHeader
        title="Contacts"
        description={`Manage the contact list for ${activeProject?.name ?? 'this project'}. ${totalContacts.toLocaleString()} total.`}
        kicker="Wachat · contacts"
        backHref="/wachat"
        actions={
          <>
            {activeProject && <SyncContactsDialog project={activeProject} onSynced={fetchData} />}
            {activeProject && <ImportContactsDialog project={activeProject} onImported={fetchData} />}
            {activeProject && <AddContactDialog key={refreshKey} project={activeProject} onAdded={handleContactAdded} />}
          </>
        }
      />

      {/* 6-tile KPI strip */}
      <section aria-labelledby="contacts-metrics" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <h2 id="contacts-metrics" className="sr-only">Contact stats</h2>
        <MetricTile label="Total contacts" value={compact(totalContacts)} icon={Users} delay={0} />
        <MetricTile label="Opted in" value={compact(stats.optedIn)} icon={ShieldCheck} delay={0.04} />
        <MetricTile label="Opted out" value={compact(stats.optedOut)} icon={ShieldOff} delay={0.08} />
        <MetricTile label="With tags" value={compact(stats.withTags)} icon={TagIcon} delay={0.12} />
        <MetricTile label="Active 7d" value={compact(stats.recent)} icon={MessageSquare} delay={0.16} />
        <MetricTile label="Added 7d" value={compact(stats.addedThisWeek)} icon={CalendarPlus} delay={0.2} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        {/* Filter rail */}
        <aside className="rounded-xl border border-zinc-200 bg-white p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Status</p>
          <div className="flex flex-col gap-0.5">
            <FacetChip label="All" active={statusFacet === 'all'} count={contacts.length} onClick={() => setParam('status', 'all')} />
            <FacetChip label="Opted in" active={statusFacet === 'opted-in'} count={stats.optedIn} onClick={() => setParam('status', 'opted-in')} />
            <FacetChip label="Opted out" active={statusFacet === 'opted-out'} count={stats.optedOut} onClick={() => setParam('status', 'opted-out')} />
            <FacetChip label="With tags" active={statusFacet === 'with-tags'} count={stats.withTags} onClick={() => setParam('status', 'with-tags')} />
          </div>

          <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Last activity</p>
          <div className="flex flex-col gap-0.5">
            <FacetChip label="Any time" active={activityFacet === 'all'} onClick={() => setParam('activity', 'all')} />
            <FacetChip label="Past 7 days" active={activityFacet === '7d'} count={stats.recent} onClick={() => setParam('activity', '7d')} />
            <FacetChip label="Past 30 days" active={activityFacet === '30d'} onClick={() => setParam('activity', '30d')} />
            <FacetChip label="Never messaged" active={activityFacet === 'never'} onClick={() => setParam('activity', 'never')} />
          </div>

          <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Conversation</p>
          <div className="flex flex-col gap-0.5">
            <FacetChip label="All" active={sourceFacet === 'all'} onClick={() => setParam('source', 'all')} />
            <FacetChip label="Has conversation" active={sourceFacet === 'has-conversation'} count={stats.hasConvo} onClick={() => setParam('source', 'has-conversation')} />
            <FacetChip label="Never replied" active={sourceFacet === 'no-conversation'} onClick={() => setParam('source', 'no-conversation')} />
          </div>

          {(activeProject?.tags?.length ?? 0) > 0 && (
            <>
              <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Tags</p>
              <TagsFilter
                tags={activeProject?.tags || []}
                selectedTags={selectedTags}
                onSelectionChange={(tags) => updateSearchParam('tags', tags.join(','))}
              />
            </>
          )}
        </aside>

        {/* List */}
        <Section padded={false}>
          {/* search row */}
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 transition-colors focus-within:border-zinc-400">
              <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <Input
                placeholder="Search by name, phone, or WhatsApp ID..."
                defaultValue={searchQuery}
                onChange={(e) => updateSearchParam('query', e.target.value)}
                className="h-7 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0"
              />
            </div>
            <WaButton variant="outline" size="sm" onClick={handleExportCsv} leftIcon={Download}>
              Export
            </WaButton>
          </div>

          {/* Bulk action toolbar */}
          <AnimatePresence>
            {someSelected && (
              <m.div
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="flex items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-[12px] font-semibold text-emerald-900 tabular-nums">
                  <span
                    className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10.5px] text-white"
                    style={{ backgroundColor: WA_GREEN }}
                  >
                    {selected.size}
                  </span>
                  selected
                </div>
                <div className="flex items-center gap-1">
                  <WaButton variant="ghost" size="sm" leftIcon={TagIcon}>Tag</WaButton>
                  <WaButton variant="ghost" size="sm" leftIcon={MessageSquare}>Message</WaButton>
                  <WaButton variant="ghost" size="sm" leftIcon={Download}>Export</WaButton>
                  <WaButton variant="ghost" size="sm" leftIcon={Ban}>Block</WaButton>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    aria-label="Clear selection"
                    className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 hover:bg-white hover:text-zinc-900"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </div>
              </m.div>
            )}
          </AnimatePresence>

          {/* Sortable column header */}
          <div className="hidden items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 md:flex">
            <span className="grid w-5 place-items-center">
              <input
                type="checkbox"
                aria-label="Select all on page"
                checked={allOnPageSelected}
                onChange={toggleAll}
                className="h-3.5 w-3.5 rounded border-zinc-300 accent-emerald-500"
              />
            </span>
            <span className="w-7" />
            <button type="button" onClick={() => toggleSort('name')} className="flex flex-1 items-center gap-1 hover:text-zinc-900">
              Contact
              <ArrowUpDown className="h-3 w-3 opacity-60" strokeWidth={2.25} />
            </button>
            <button type="button" onClick={() => toggleSort('tags')} className="hidden w-[120px] items-center gap-1 hover:text-zinc-900 lg:flex">
              Tags
              <ArrowUpDown className="h-3 w-3 opacity-60" strokeWidth={2.25} />
            </button>
            <button type="button" onClick={() => toggleSort('lastActivity')} className="hidden w-[140px] items-center gap-1 hover:text-zinc-900 lg:flex">
              Last activity
              <ArrowUpDown className="h-3 w-3 opacity-60" strokeWidth={2.25} />
            </button>
            <span className="w-[110px]">Status</span>
            <span className="w-[120px] text-right">Actions</span>
          </div>

          {isLoading && contacts.length === 0 ? (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-32 animate-pulse rounded-full bg-zinc-100" />
                    <div className="h-2 w-44 animate-pulse rounded-full bg-zinc-100" />
                  </div>
                  <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-100" />
                </div>
              ))}
            </div>
          ) : view.length === 0 ? (
            <div className="px-5 py-12">
              <EmptyState
                icon={Users}
                title={searchQuery || selectedTags.length > 0 ? 'No matching contacts' : 'No contacts yet'}
                description={
                  searchQuery || selectedTags.length > 0
                    ? 'Try adjusting your search or tag filters.'
                    : 'Import a CSV or add contacts one at a time to build your audience.'
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              <AnimatePresence initial={false}>
                {view.map((c, i) => {
                  const id = c._id.toString();
                  const isSelected = selected.has(id);
                  const tagsForRow = (c.tagIds || []).map((tid) =>
                    activeProject?.tags?.find((t) => t._id === tid.toString()),
                  ).filter(Boolean) as Tag[];
                  const visibleTags = tagsForRow.slice(0, 3);
                  const extraTags = tagsForRow.length - visibleTags.length;
                  return (
                    <m.li
                      key={id}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22, delay: i * stagger, ease: EASE_OUT }}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 transition-colors',
                        isSelected ? 'bg-emerald-50/40' : 'hover:bg-zinc-50/70',
                      )}
                    >
                      <span className="grid w-5 place-items-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.name || c.waId}`}
                          checked={isSelected}
                          onChange={() => toggleOne(id)}
                          className="h-3.5 w-3.5 rounded border-zinc-300 accent-emerald-500"
                        />
                      </span>
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold text-white"
                        style={{ backgroundColor: WA_GREEN }}
                      >
                        {monogram(c.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[12.5px] font-medium text-zinc-900">{c.name || 'Unknown'}</p>
                          {c.unreadCount ? (
                            <span
                              className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold text-white tabular-nums"
                              style={{ backgroundColor: WA_GREEN }}
                            >
                              {c.unreadCount > 99 ? '99+' : c.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-zinc-500">
                          <span className="font-mono tabular-nums">{c.waId}</span>
                          {c.email && <span className="truncate">{c.email}</span>}
                          {c.assignedAgentId && (
                            <span className="rounded bg-zinc-100 px-1 text-[9.5px] uppercase tracking-wider text-zinc-600">
                              Assigned
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="hidden w-[120px] items-center gap-1 lg:flex">
                        {visibleTags.length === 0 ? (
                          <span className="text-[10.5px] text-zinc-400">-</span>
                        ) : (
                          <>
                            {visibleTags.map((t) => (
                              <span
                                key={t._id}
                                className="inline-flex max-w-[60px] items-center gap-1 truncate rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-zinc-700"
                                title={t.name}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: (t as any).color || WA_GREEN }} />
                                <span className="truncate">{t.name}</span>
                              </span>
                            ))}
                            {extraTags > 0 && (
                              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums text-zinc-600">
                                +{extraTags}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="hidden w-[140px] text-[10.5px] tabular-nums text-zinc-500 lg:block">
                        {c.lastMessageTimestamp ? fmtDate(c.lastMessageTimestamp) : <span className="text-zinc-400">No activity</span>}
                      </div>
                      <div className="w-[110px]">
                        {(c as any).isOptedOut ? (
                          <StatusPill tone="failed">Opted-out</StatusPill>
                        ) : c.lastMessageTimestamp ? (
                          <StatusPill tone="live">Active</StatusPill>
                        ) : (
                          <StatusPill tone="draft">Idle</StatusPill>
                        )}
                      </div>
                      <div className="flex w-[120px] shrink-0 items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMessageContact(c)}
                          aria-label="Message"
                          className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 active:scale-[0.97]"
                        >
                          <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                        <DeleteContactButton contact={c} onDeleted={fetchData} />
                      </div>
                    </m.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5"
            >
              <p className="text-[11px] tabular-nums text-zinc-500">
                Page {currentPage} of {totalPages} · {totalContacts.toLocaleString()} contacts
              </p>
              <div className="flex items-center gap-1.5">
                <WaButton
                  variant="outline"
                  size="sm"
                  onClick={() => updateSearchParam('page', String(Math.max(1, currentPage - 1)))}
                  disabled={currentPage <= 1}
                  leftIcon={ChevronLeft}
                >
                  Previous
                </WaButton>
                <WaButton
                  variant="outline"
                  size="sm"
                  onClick={() => updateSearchParam('page', String(Math.min(totalPages, currentPage + 1)))}
                  disabled={currentPage >= totalPages}
                  rightIcon={ChevronRight}
                >
                  Next
                </WaButton>
              </div>
            </nav>
          )}
        </Section>
      </div>
    </WaPage>
  );
}
