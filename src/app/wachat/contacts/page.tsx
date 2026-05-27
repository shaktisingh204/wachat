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

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

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
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 active:scale-[0.97]"
        >
          <TagIcon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
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
          className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97]"
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
  const selectedTags = useMemo(() => tagsParam?.split(',').filter(Boolean) || [], [tagsParam]);

  const [totalContacts, setTotalContacts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const { toast } = useZoruToast();
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleMessageContact = (contact: WithId<Contact>) => {
    router.push(`/wachat/chat?contactId=${contact._id.toString()}&phoneId=${contact.phoneNumberId}`);
  };

  const handleExportCsv = () => {
    toast({ title: 'Exporting...', description: 'CSV export will be available shortly.' });
  };

  const stats = useMemo(() => {
    const withTags = contacts.filter((c) => (c.tagIds || []).length > 0).length;
    const recent = contacts.filter((c) => {
      if (!c.lastMessageTimestamp) return false;
      return Date.now() - new Date(c.lastMessageTimestamp).getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { withTags, recent };
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

  const stagger = reduceMotion ? 0 : 0.03;

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

      {/* Metric strip */}
      <section aria-labelledby="contacts-metrics" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <h2 id="contacts-metrics" className="sr-only">Contact stats</h2>
        <MetricTile label="Total contacts" value={compact(totalContacts)} icon={Users} delay={0} />
        <MetricTile
          label="With tags (this page)"
          value={compact(stats.withTags)}
          icon={TagIcon}
          delta={{
            value: `${contacts.length > 0 ? Math.round((stats.withTags / contacts.length) * 100) : 0}%`,
            positive: true,
          }}
          delay={0.05}
        />
        <MetricTile
          label="Active this week"
          value={compact(stats.recent)}
          icon={MessageSquare}
          delay={0.1}
        />
      </section>

      {/* Filter row */}
      <Section padded={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400">
            <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
            <Input
              placeholder="Search by name or WhatsApp ID..."
              defaultValue={searchQuery}
              onChange={(e) => updateSearchParam('query', e.target.value)}
              className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
            />
          </div>
          <TagsFilter
            tags={activeProject?.tags || []}
            selectedTags={selectedTags}
            onSelectionChange={(tags) => updateSearchParam('tags', tags.join(','))}
          />
          <WaButton variant="outline" size="sm" onClick={handleExportCsv} leftIcon={Download}>
            Export CSV
          </WaButton>
        </div>

        {isLoading && contacts.length === 0 ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
                  <div className="h-2.5 w-44 animate-pulse rounded-full bg-zinc-100" />
                </div>
                <div className="h-7 w-20 animate-pulse rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
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
              {contacts.map((c, i) => (
                <m.li
                  key={c._id.toString()}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: i * stagger, ease: EASE_OUT }}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700">
                    {(c.name || '?').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13.5px] font-medium text-zinc-900">{c.name || 'Unknown'}</p>
                      {(c as any).isOptedOut ? (
                        <StatusPill tone="failed">Opted-out</StatusPill>
                      ) : (
                        <StatusPill tone="live">Opted-in</StatusPill>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-zinc-500">
                      <span className="font-mono tabular-nums">{c.waId}</span>
                      {(c as any).email && <span className="truncate">{(c as any).email}</span>}
                      {c.lastMessageTimestamp && <span>Last activity {fmtDate(c.lastMessageTimestamp)}</span>}
                    </div>
                    {(c.tagIds || []).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(c.tagIds || []).map((tagId) => {
                          const tag = activeProject?.tags?.find((t) => t._id === tagId.toString());
                          return tag ? (
                            <span
                              key={tagId.toString()}
                              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-600"
                            >
                              {tag.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <WaButton variant="outline" size="sm" onClick={() => handleMessageContact(c)} leftIcon={MessageSquare}>
                      Message
                    </WaButton>
                    <DeleteContactButton contact={c} onDeleted={fetchData} />
                  </div>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        {totalPages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between border-t border-zinc-100 px-5 py-3"
          >
            <p className="text-[12px] tabular-nums text-zinc-500">
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
    </WaPage>
  );
}
