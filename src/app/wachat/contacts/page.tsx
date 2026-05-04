'use client';

/**
 * Wachat Contacts — rebuilt on ZoruUI primitives (phase 2).
 *
 * Same data, same handlers, same server actions. Only the visual
 * primitives are swapped to ZoruUI. The shared AddContactDialog +
 * ImportContactsDialog handle the create/import flows and remain
 * unchanged (their internals will be migrated separately).
 */

import * as React from 'react';
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

import {
  AlertCircle,
  Search,
  Users,
  Loader2,
  MessageSquare,
  Trash2,
  Tag as TagIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Plus,
} from 'lucide-react';

import { getContactsPageData, deleteContact } from '@/app/actions/contact.actions';
import type { Contact, Tag } from '@/lib/definitions';
import { AddContactDialog } from '@/app/wachat/_components/add-contact-dialog';
import { ImportContactsDialog } from '@/app/wachat/_components/import-contacts-dialog';
import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruEmptyState,
  ZoruInput,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruSkeleton,
  cn,
} from '@/components/zoruui';

const CONTACTS_PER_PAGE = 20;

/* ── helpers ────────────────────────────────────────────────────── */

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

/* ── Tag filter (Zoru popover of tags) ──────────────────────────── */

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
    <ZoruPopover open={open} onOpenChange={setOpen}>
      <ZoruPopoverTrigger asChild>
        <ZoruButton variant="outline" size="sm">
          <TagIcon /> {label}
          <ChevronDown className="opacity-60" />
        </ZoruButton>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent className="w-[240px] p-0" align="end">
        <ZoruCommand>
          <ZoruCommandInput placeholder="Search tags…" />
          <ZoruCommandList>
            <ZoruCommandEmpty>No tags found.</ZoruCommandEmpty>
            <ZoruCommandGroup>
              {tags.length === 0 ? (
                <div className="px-2 py-6 text-center text-[12px] text-zoru-ink-muted">
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
                            ? 'border-zoru-ink bg-zoru-ink text-zoru-on-primary'
                            : 'border-zoru-line',
                        )}
                      >
                        {isSelected ? (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        ) : null}
                      </span>
                      <span className="flex-1 truncate text-[13px] text-zoru-ink">
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
    </ZoruPopover>
  );
}

/* ── Delete confirmation ──────────────────────────────────────── */

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
        <ZoruButton
          variant="ghost"
          size="icon-sm"
          aria-label="Delete contact"
          className="text-zoru-danger hover:bg-zoru-danger/10"
        >
          <Trash2 />
        </ZoruButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Delete contact?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            Are you sure you want to delete {contact.name}? This action cannot
            be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
            destructive
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="mr-2 animate-spin" /> : null}
            Delete
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function ContactsPage() {
  const { activeProject, activeProjectId } = useProject();
  const [contacts, setContacts] = useState<WithId<Contact>[]>([]);
  const [isLoading, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get('page')) || 1;
  const searchQuery = searchParams.get('query') || '';

  const tagsParam = searchParams.get('tags');
  const selectedTags = useMemo(
    () => tagsParam?.split(',').filter(Boolean) || [],
    [tagsParam],
  );

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
          description:
            'Failed to load contacts. Please ensure a project is selected.',
          variant: 'destructive',
        });
      }
    });
  }, [activeProjectId, currentPage, searchQuery, selectedTags, toast]);

  const handleContactAdded = useCallback(() => {
    setTimeout(() => {
      fetchData();
      setRefreshKey((prev) => prev + 1);
      router.refresh();
    }, 300);
  }, [fetchData, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateSearchParam = useDebouncedCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value.trim() !== '') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      if (key !== 'page') {
        params.set('page', '1');
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    300,
  );

  const handleMessageContact = (contact: WithId<Contact>) => {
    router.push(
      `/wachat/chat?contactId=${contact._id.toString()}&phoneId=${contact.phoneNumberId}`,
    );
  };

  const isLoadingInitial = isLoading && contacts.length === 0;

  /* Derived stats */
  const stats = useMemo(() => {
    const withTags = contacts.filter(
      (c) => (c.tagIds || []).length > 0,
    ).length;
    const recent = contacts.filter((c) => {
      if (!c.lastMessageTimestamp) return false;
      const d = new Date(c.lastMessageTimestamp).getTime();
      return Date.now() - d < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { withTags, recent };
  }, [contacts]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
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
            <ZoruBreadcrumbPage>Contacts</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* Header */}
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Contacts
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            {activeProject
              ? `Manage the contact list for ${activeProject.name}${totalContacts > 0 ? ` · ${totalContacts.toLocaleString()} total contacts` : ''}`
              : 'Manage your customer contact list.'}
          </p>
        </div>
        {activeProject ? (
          <div className="flex items-center gap-2">
            <ImportContactsDialog
              project={activeProject}
              onImported={fetchData}
            />
            <AddContactDialog
              key={refreshKey}
              project={activeProject}
              onAdded={handleContactAdded}
            />
          </div>
        ) : null}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Total contacts" value={compact(totalContacts)} />
        <Stat
          label="With tags (this page)"
          value={compact(stats.withTags)}
          hint={`${contacts.length > 0 ? Math.round((stats.withTags / contacts.length) * 100) : 0}% segmented`}
        />
        <Stat
          label="Active this week"
          value={compact(stats.recent)}
          hint="messaged in last 7 days"
        />
      </div>

      {/* No project state */}
      {!activeProjectId ? (
        <ZoruEmptyState
          icon={<AlertCircle />}
          title="No project selected"
          description="Please select a project from the main dashboard to manage contacts."
          action={
            <ZoruButton size="sm" onClick={() => router.push('/wachat')}>
              Choose a project
            </ZoruButton>
          }
        />
      ) : (
        <ZoruCard className="p-6">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px] flex-1">
              <ZoruInput
                placeholder="Search by name or WhatsApp ID…"
                leadingSlot={<Search />}
                defaultValue={searchQuery}
                onChange={(e) =>
                  updateSearchParam('query', e.target.value)
                }
              />
            </div>
            <TagsFilter
              tags={activeProject?.tags || []}
              selectedTags={selectedTags}
              onSelectionChange={(tags) =>
                updateSearchParam('tags', tags.join(','))
              }
            />
            <span className="ml-auto text-[11.5px] tabular-nums text-zoru-ink-muted">
              {contacts.length} shown · {totalContacts.toLocaleString()} total
            </span>
          </div>

          {/* Table / empty / skeleton */}
          <div className="mt-5 overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line">
            {isLoadingInitial ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ZoruSkeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : contacts.length === 0 ? (
              <ZoruEmptyState
                icon={<Users />}
                title={
                  searchQuery || selectedTags.length > 0
                    ? 'No matching contacts'
                    : 'No contacts yet'
                }
                description={
                  searchQuery || selectedTags.length > 0
                    ? 'Try adjusting your search or tag filters.'
                    : 'Import a CSV or add contacts one at a time to build your audience.'
                }
                className="border-0"
              />
            ) : (
              <table className="w-full text-[13px]">
                <thead className="border-b border-zoru-line bg-zoru-surface text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">WhatsApp ID</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Opt-in</th>
                    <th className="px-4 py-3 text-left">Tags</th>
                    <th className="px-4 py-3 text-left">Last activity</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zoru-line">
                  {contacts.map((contact) => (
                    <tr
                      key={contact._id.toString()}
                      className="transition-colors hover:bg-zoru-surface"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2 text-[11px] text-zoru-ink">
                            {(contact.name || '?').slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-zoru-ink">
                            {contact.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink-muted tabular-nums">
                        {contact.waId}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-zoru-ink-muted">
                        {(contact as any).email || '—'}
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        {(contact as any).isOptedOut ? (
                          <ZoruBadge variant="danger">
                            <span className="h-1.5 w-1.5 rounded-full bg-zoru-danger" />
                            Opted-out
                          </ZoruBadge>
                        ) : (
                          <ZoruBadge variant="success">
                            <span className="h-1.5 w-1.5 rounded-full bg-zoru-success" />
                            Opted-in
                          </ZoruBadge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(contact.tagIds || []).map((tagId) => {
                            const tag = activeProject?.tags?.find(
                              (t) => t._id === tagId.toString(),
                            );
                            return tag ? (
                              <ZoruBadge
                                key={tagId.toString()}
                                variant="secondary"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-zoru-ink-muted" />
                                {tag.name}
                              </ZoruBadge>
                            ) : null;
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-zoru-ink-muted">
                        {contact.lastMessageTimestamp
                          ? new Date(
                              contact.lastMessageTimestamp,
                            ).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ZoruButton
                            variant="outline"
                            size="sm"
                            onClick={() => handleMessageContact(contact)}
                          >
                            <MessageSquare /> Message
                          </ZoruButton>
                          <DeleteContactButton
                            contact={contact}
                            onDeleted={fetchData}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-zoru-line pt-4">
              <span className="text-[11.5px] tabular-nums text-zoru-ink-muted">
                Page {currentPage} of {totalPages} ·{' '}
                {compact(totalContacts)} contacts
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateSearchParam('page', String(currentPage - 1))
                  }
                  disabled={currentPage <= 1 || isLoading}
                >
                  <ChevronLeft /> Previous
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateSearchParam('page', String(currentPage + 1))
                  }
                  disabled={currentPage >= totalPages || isLoading}
                >
                  Next <ChevronRight />
                </ZoruButton>
              </div>
            </div>
          ) : null}
        </ZoruCard>
      )}

      <div className="h-6" />
    </div>
  );
}

/* ── stat tile ──────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ZoruCard className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-2 text-[22px] tracking-[-0.01em] text-zoru-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[11px] text-zoru-ink-muted leading-tight">
          {hint}
        </div>
      ) : null}
    </ZoruCard>
  );
}
