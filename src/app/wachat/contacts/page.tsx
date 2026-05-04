'use client';

/**
 * Wachat Contacts — rebuilt on Clay primitives.
 *
 * Keeps the shared ImportContactsDialog + AddContactDialog components
 * (they implement the actual upload/create flows) and replaces the
 * page chrome, filter bar, and contact table.
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
  LuCircleAlert,
  LuSearch,
  LuUsers,
  LuLoader,
  LuMessageSquare,
  LuTrash2,
  LuTag,
  LuChevronLeft,
  LuChevronRight,
  LuChevronDown,
  LuCheck,
} from 'react-icons/lu';

import { getContactsPageData, deleteContact } from '@/app/actions/contact.actions';
import type { Contact, Tag } from '@/lib/definitions';
import { AddContactDialog } from '@/components/wabasimplify/add-contact-dialog';
import { ImportContactsDialog } from '@/components/wabasimplify/import-contacts-dialog';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { cn } from '@/lib/utils';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { ClayInput } from '@/components/clay/clay-input';

const CONTACTS_PER_PAGE = 20;

/* ── helpers ────────────────────────────────────────────────────── */

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

/* ── Tag filter (Clay-styled popover of tags) ───────────────────── */

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
      <PopoverTrigger asChild>
        <ClayButton
          variant="pill"
          size="md"
          leading={<LuTag className="h-3.5 w-3.5" strokeWidth={2} />}
          trailing={<LuChevronDown className="h-3 w-3 opacity-60" />}
        >
          {label}
        </ClayButton>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search tags…" />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {tags.length === 0 ? (
                <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">
                  No tags defined on this project yet.
                </div>
              ) : (
                tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag._id);
                  return (
                    <CommandItem
                      key={tag._id}
                      onSelect={() => toggle(tag._id)}
                      className="flex items-center gap-2"
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
                          isSelected
                            ? 'bg-primary border-primary text-white'
                            : 'border-border',
                        )}
                      >
                        {isSelected ? (
                          <LuCheck className="h-3 w-3" strokeWidth={3} />
                        ) : null}
                      </span>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: tag.color }}
                      />
                      <span className="flex-1 truncate text-[13px]">
                        {tag.name}
                      </span>
                    </CommandItem>
                  );
                })
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Delete confirmation button (Clay styled) ───────────────────── */

function DeleteContactButton({
  contact,
  onDeleted,
}: {
  contact: WithId<Contact>;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

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
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Delete contact"
          className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-rose-50 transition-colors"
        >
          <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete contact?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {contact.name}? This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending ? (
              <LuLoader className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
  const { toast } = useToast();
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
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {/* Breadcrumb */}
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/dashboard' },
          { label: activeProject?.name || 'Project', href: '/wachat' },
          { label: 'Contacts' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Contacts
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {activeProject
              ? `Manage the contact list for ${activeProject.name}${totalContacts > 0 ? ` · ${totalContacts.toLocaleString()} total contacts` : ''}`
              : 'Manage your customer contact list.'}
          </p>
        </div>
        {activeProject ? (
          <div className="flex items-center gap-2">
            <ImportContactsDialog project={activeProject} onImported={fetchData} />
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
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-foreground">
            No project selected
          </div>
          <div className="mt-1.5 text-[12.5px] text-muted-foreground">
            Please select a project from the main dashboard to manage contacts.
          </div>
          <ClayButton
            variant="rose"
            size="md"
            onClick={() => router.push('/wachat')}
            className="mt-5"
          >
            Choose a project
          </ClayButton>
        </ClayCard>
      ) : (
        <ClayCard padded={false} className="p-6">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px] flex-1">
              <ClayInput
                sizeVariant="md"
                placeholder="Search by name or WhatsApp ID…"
                leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                defaultValue={searchQuery}
                onChange={(e) => updateSearchParam('query', e.target.value)}
              />
            </div>
            <TagsFilter
              tags={activeProject?.tags || []}
              selectedTags={selectedTags}
              onSelectionChange={(tags) =>
                updateSearchParam('tags', tags.join(','))
              }
            />
            <span className="ml-auto text-[11.5px] tabular-nums text-muted-foreground">
              {contacts.length} shown · {totalContacts.toLocaleString()} total
            </span>
          </div>

          {/* Table / empty / skeleton */}
          <div className="mt-5 overflow-hidden rounded-[12px] border border-border">
            {isLoadingInitial ? (
              <div className="flex h-40 items-center justify-center">
                <LuLoader
                  className="h-5 w-5 animate-spin text-muted-foreground"
                  strokeWidth={1.75}
                />
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <LuUsers className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div className="mt-2 text-[13px] font-semibold text-foreground">
                  {searchQuery || selectedTags.length > 0
                    ? 'No matching contacts'
                    : 'No contacts yet'}
                </div>
                <div className="max-w-[360px] text-[11.5px] text-muted-foreground">
                  {searchQuery || selectedTags.length > 0
                    ? 'Try adjusting your search or tag filters.'
                    : 'Import a CSV or add contacts one at a time to build your audience.'}
                </div>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="bg-secondary border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                <tbody className="divide-y divide-border">
                  {contacts.map((contact) => (
                    <tr
                      key={contact._id.toString()}
                      className="transition-colors hover:bg-secondary"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                            {(contact.name || '?').slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-medium text-foreground">
                            {contact.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground tabular-nums">
                        {contact.waId}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {(contact as any).email || '—'}
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        {(contact as any).isOptedOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-medium text-destructive">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                            Opted-out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Opted-in
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(contact.tagIds || []).map((tagId) => {
                            const tag = activeProject?.tags?.find(
                              (t) => t._id === tagId.toString(),
                            );
                            return tag ? (
                              <span
                                key={tagId.toString()}
                                className="inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[10.5px] font-medium"
                                style={{
                                  background: `${tag.color}18`,
                                  color: tag.color,
                                  borderColor: `${tag.color}38`,
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: tag.color }}
                                />
                                {tag.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {contact.lastMessageTimestamp
                          ? new Date(
                              contact.lastMessageTimestamp,
                            ).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ClayButton
                            variant="pill"
                            size="sm"
                            leading={
                              <LuMessageSquare
                                className="h-3 w-3"
                                strokeWidth={2}
                              />
                            }
                            onClick={() => handleMessageContact(contact)}
                          >
                            Message
                          </ClayButton>
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
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                Page {currentPage} of {totalPages} ·{' '}
                {compact(totalContacts)} contacts
              </span>
              <div className="flex items-center gap-2">
                <ClayButton
                  variant="pill"
                  size="sm"
                  leading={
                    <LuChevronLeft className="h-3 w-3" strokeWidth={2} />
                  }
                  onClick={() =>
                    updateSearchParam('page', String(currentPage - 1))
                  }
                  disabled={currentPage <= 1 || isLoading}
                >
                  Previous
                </ClayButton>
                <ClayButton
                  variant="pill"
                  size="sm"
                  trailing={
                    <LuChevronRight className="h-3 w-3" strokeWidth={2} />
                  }
                  onClick={() =>
                    updateSearchParam('page', String(currentPage + 1))
                  }
                  disabled={currentPage >= totalPages || isLoading}
                >
                  Next
                </ClayButton>
              </div>
            </div>
          ) : null}
        </ClayCard>
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
    <div className="rounded-[14px] border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.01em] text-foreground leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-muted-foreground leading-tight truncate">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
