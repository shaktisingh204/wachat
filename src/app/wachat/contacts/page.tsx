'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  EmptyState,
  StatCard,
  Skeleton,
  Pagination,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useCallback,
  useTransition,
  useMemo,
  type ReactNode,
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
  ChevronDown,
  Check,
  Download,
} from 'lucide-react';

import { getContactsPageData, deleteContact } from '@/app/actions/contact.actions';
import type { Contact, Tag } from '@/lib/definitions';
import { AddContactDialog } from '@/app/wachat/_components/add-contact-dialog';
import { ImportContactsDialog } from '@/app/wachat/_components/import-contacts-dialog';
import { SyncContactsDialog } from '@/app/wachat/_components/sync-contacts-dialog';
import { useProject } from '@/context/project-context';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const CONTACTS_PER_PAGE = 20;

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Contacts' },
];

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
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" iconLeft={TagIcon} iconRight={ChevronDown}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search tags…" />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {tags.length === 0 ? (
                <div
                  className="px-2 py-6 text-center text-[12px]"
                  style={{ color: 'var(--st-text-tertiary)' }}
                >
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
                        className="flex h-4 w-4 shrink-0 items-center justify-center"
                        style={{
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--st-accent)' : 'var(--st-border)',
                          background: isSelected ? 'var(--st-accent)' : 'transparent',
                          color: isSelected ? 'var(--st-accent-contrast, #fff)' : 'transparent',
                        }}
                      >
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
                      </span>
                      <span
                        className="flex-1 truncate text-[13px]"
                        style={{ color: 'var(--st-text)' }}
                      >
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
        toast({ title: 'Deleted', description: 'Contact has been deleted.', tone: 'success' });
        onDeleted();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          tone: 'danger',
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Delete contact"
          iconLeft={Trash2}
          style={{ color: 'var(--st-danger)' }}
        />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete contact?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {contact.name}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
  const selectedTags = useMemo(() => tagsParam?.split(',').filter(Boolean) || [], [tagsParam]);

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
          tone: 'danger',
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
    // In real life, trigger rust-backend stream_csv here
  };

  const stats = useMemo(() => {
    const withTags = contacts.filter((c) => (c.tagIds || []).length > 0).length;
    const recent = contacts.filter((c) => {
      if (!c.lastMessageTimestamp) return false;
      return Date.now() - new Date(c.lastMessageTimestamp).getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { withTags, recent };
  }, [contacts]);

  const columns: {
    header: string;
    align?: 'left' | 'center' | 'right';
    cell: (c: WithId<Contact>) => ReactNode;
  }[] = [
    {
      header: 'Name',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px]"
            style={{ background: 'var(--st-bg-secondary)', color: 'var(--st-text)' }}
          >
            {(c.name || '?').slice(0, 2).toUpperCase()}
          </span>
          <span style={{ color: 'var(--st-text)' }}>{c.name}</span>
        </div>
      ),
    },
    {
      header: 'WhatsApp ID',
      cell: (c) => (
        <span
          className="font-mono text-[12px] tabular-nums"
          style={{ color: 'var(--st-text-secondary)' }}
        >
          {c.waId}
        </span>
      ),
    },
    {
      header: 'Email',
      cell: (c) => (
        <span className="text-[12px]" style={{ color: 'var(--st-text-secondary)' }}>
          {(c as any).email || '—'}
        </span>
      ),
    },
    {
      header: 'Opt-in',
      cell: (c) =>
        (c as any).isOptedOut ? (
          <Badge tone="danger" dot>
            Opted-out
          </Badge>
        ) : (
          <Badge tone="success" dot>
            Opted-in
          </Badge>
        ),
    },
    {
      header: 'Tags',
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {(c.tagIds || []).map((tagId) => {
            const tag = activeProject?.tags?.find((t) => t._id === tagId.toString());
            return tag ? (
              <Badge key={tagId.toString()} tone="neutral" dot>
                {tag.name}
              </Badge>
            ) : null;
          })}
        </div>
      ),
    },
    {
      header: 'Last activity',
      cell: (c) => (
        <span className="text-[12px]" style={{ color: 'var(--st-text-secondary)' }}>
          {c.lastMessageTimestamp ? fmtDate(c.lastMessageTimestamp) : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMessageContact(c)}
            iconLeft={MessageSquare}
          >
            Message
          </Button>
          <DeleteContactButton contact={c} onDeleted={fetchData} />
        </div>
      ),
    },
  ];

  const actions = (
    <div className="flex items-center gap-2">
      {activeProject && <SyncContactsDialog project={activeProject} onSynced={fetchData} />}
      {activeProject && <ImportContactsDialog project={activeProject} onImported={fetchData} />}
      {activeProject && <AddContactDialog key={refreshKey} project={activeProject} onAdded={handleContactAdded} />}
    </div>
  );

  if (!activeProjectId) {
    return (
      <WachatPage
        breadcrumb={BREADCRUMB}
        title="Contacts"
        description="Manage your customer contact list."
        width="wide"
      >
        <Card padding="none">
          <EmptyState
            icon={AlertCircle}
            title="No project selected"
            description="Please select a project from the main dashboard to manage contacts."
          />
        </Card>
      </WachatPage>
    );
  }

  const showSkeleton = isLoading && contacts.length === 0;
  const isEmpty = !showSkeleton && contacts.length === 0;
  const emptyTitle =
    searchQuery || selectedTags.length > 0 ? 'No matching contacts' : 'No contacts yet';
  const emptyDescription =
    searchQuery || selectedTags.length > 0
      ? 'Try adjusting your search or tag filters.'
      : 'Import a CSV or add contacts one at a time to build your audience.';

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      title="Contacts"
      description={`Manage the contact list for ${activeProject?.name} · ${totalContacts.toLocaleString()} total contacts`}
      actions={actions}
      width="wide"
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Total contacts" value={compact(totalContacts)} />
          <StatCard
            label="With tags (this page)"
            value={compact(stats.withTags)}
            delta={{
              value: `${contacts.length > 0 ? Math.round((stats.withTags / contacts.length) * 100) : 0}% segmented`,
            }}
          />
          <StatCard
            label="Active this week"
            value={compact(stats.recent)}
            delta={{ value: 'messaged in last 7 days' }}
          />
        </div>

        <Card className="flex flex-col gap-5" padding="lg">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px] flex-1">
              <Input
                placeholder="Search by name or WhatsApp ID…"
                iconLeft={Search}
                aria-label="Search contacts"
                defaultValue={searchQuery}
                onChange={(e) => updateSearchParam('query', e.target.value)}
              />
            </div>
            <TagsFilter
              tags={activeProject?.tags || []}
              selectedTags={selectedTags}
              onSelectionChange={(tags) => updateSearchParam('tags', tags.join(','))}
            />
          </div>

          <div
            className="overflow-hidden"
            style={{
              border: '1px solid var(--st-border)',
              borderRadius: 'var(--st-radius-lg)',
              background: 'var(--st-bg)',
            }}
          >
            <div
              className="flex items-center justify-end p-2"
              style={{ borderBottom: '1px solid var(--st-border)', background: 'var(--st-bg-secondary)' }}
            >
              <Button variant="ghost" size="sm" onClick={handleExportCsv} iconLeft={Download}>
                Export CSV
              </Button>
            </div>

            {showSkeleton ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} height={40} width="100%" />
                ))}
              </div>
            ) : isEmpty ? (
              <EmptyState icon={Users} title={emptyTitle} description={emptyDescription} />
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <THead>
                    <Tr>
                      {columns.map((col, i) => (
                        <Th key={i} align={col.align}>
                          {col.header}
                        </Th>
                      ))}
                    </Tr>
                  </THead>
                  <TBody>
                    {contacts.map((c, i) => (
                      <Tr key={i}>
                        {columns.map((col, j) => (
                          <Td key={j} align={col.align}>
                            {col.cell(c)}
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}

            {totalPages > 1 && !showSkeleton && !isEmpty ? (
              <div
                className="flex items-center justify-between gap-3 p-4"
                style={{ borderTop: '1px solid var(--st-border)' }}
              >
                <span
                  className="text-[11.5px] tabular-nums"
                  style={{ color: 'var(--st-text-secondary)' }}
                >
                  Page {currentPage} of {totalPages} · {totalContacts.toLocaleString()} items
                </span>
                <Pagination
                  page={currentPage}
                  pageCount={totalPages}
                  onPageChange={(page) => updateSearchParam('page', String(page))}
                  size="compact"
                />
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </WachatPage>
  );
}
