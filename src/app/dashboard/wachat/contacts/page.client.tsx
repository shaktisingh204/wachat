'use client';

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
  Badge,
  Button,
  Card,
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
} from 'lucide-react';

import { getContactsPageData, deleteContact } from '@/app/actions/contact.actions';
import type { Contact, Tag } from '@/lib/definitions';
import { AddContactDialog } from '@/app/wachat/_components/add-contact-dialog';
import { ImportContactsDialog } from '@/app/wachat/_components/import-contacts-dialog';
import { useProject } from '@/context/project-context';

import { FeatureShell } from '@/components/dashboard/feature-shell';
import { FeatureTable } from '@/components/dashboard/feature-table';

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
        <Button variant="outline" size="sm">
          <TagIcon className="mr-2 h-4 w-4" /> {label}
          <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
        </Button>
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
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
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
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete contact"
          className="text-zoru-danger hover:bg-zoru-danger/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
    router.push(`/dashboard/wachat/chat?contactId=${contact._id.toString()}&phoneId=${contact.phoneNumberId}`);
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

  const columns = [
    {
      header: 'Name',
      cell: (c: WithId<Contact>) => (
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2 text-[11px] text-zoru-ink">
            {(c.name || '?').slice(0, 2).toUpperCase()}
          </span>
          <span className="text-zoru-ink">{c.name}</span>
        </div>
      ),
    },
    {
      header: 'WhatsApp ID',
      cell: (c: WithId<Contact>) => <span className="font-mono text-[12px] text-zoru-ink-muted tabular-nums">{c.waId}</span>,
    },
    {
      header: 'Email',
      cell: (c: WithId<Contact>) => <span className="text-[12px] text-zoru-ink-muted">{(c as any).email || '—'}</span>,
    },
    {
      header: 'Opt-in',
      cell: (c: WithId<Contact>) => (
        (c as any).isOptedOut ? (
          <Badge variant="danger"><span className="mr-1 h-1.5 w-1.5 rounded-full bg-zoru-danger" /> Opted-out</Badge>
        ) : (
          <Badge variant="success"><span className="mr-1 h-1.5 w-1.5 rounded-full bg-zoru-success" /> Opted-in</Badge>
        )
      ),
    },
    {
      header: 'Tags',
      cell: (c: WithId<Contact>) => (
        <div className="flex flex-wrap gap-1">
          {(c.tagIds || []).map((tagId) => {
            const tag = activeProject?.tags?.find((t) => t._id === tagId.toString());
            return tag ? (
              <Badge key={tagId.toString()} variant="secondary">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-zoru-ink-muted" /> {tag.name}
              </Badge>
            ) : null;
          })}
        </div>
      ),
    },
    {
      header: 'Last activity',
      cell: (c: WithId<Contact>) => <span className="text-[12px] text-zoru-ink-muted">{c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp).toLocaleString() : '—'}</span>,
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (c: WithId<Contact>) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" onClick={() => handleMessageContact(c)}>
            <MessageSquare className="mr-1 h-4 w-4" /> Message
          </Button>
          <DeleteContactButton contact={c} onDeleted={fetchData} />
        </div>
      ),
    },
  ];

  if (!activeProjectId) {
    return (
      <FeatureShell
        title="Contacts"
        description="Manage your customer contact list."
        breadcrumbs={[
          { label: 'SabNode', href: '/dashboard' },
          { label: 'WaChat', href: '/dashboard/wachat' },
          { label: 'Contacts' },
        ]}
      >
        <EmptyState
          icon={<AlertCircle />}
          title="No project selected"
          description="Please select a project from the main dashboard to manage contacts."
        />
      </FeatureShell>
    );
  }

  return (
    <FeatureShell
      title="Contacts"
      description={`Manage the contact list for ${activeProject?.name} · ${totalContacts.toLocaleString()} total contacts`}
      breadcrumbs={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/dashboard/wachat' },
        { label: 'Contacts' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          {activeProject && <ImportContactsDialog project={activeProject} onImported={fetchData} />}
          {activeProject && <AddContactDialog key={refreshKey} project={activeProject} onAdded={handleContactAdded} />}
        </div>
      }
      stats={[
        { label: 'Total contacts', value: compact(totalContacts) },
        { label: 'With tags (this page)', value: compact(stats.withTags), hint: `${contacts.length > 0 ? Math.round((stats.withTags / contacts.length) * 100) : 0}% segmented` },
        { label: 'Active this week', value: compact(stats.recent), hint: 'messaged in last 7 days' },
      ]}
    >
      <Card className="p-6 flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[260px] flex-1">
            <Input
              placeholder="Search by name or WhatsApp ID…"
              leadingSlot={<Search className="h-4 w-4" />}
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

        <FeatureTable
          columns={columns}
          data={contacts}
          isLoading={isLoading && contacts.length === 0}
          emptyIcon={<Users />}
          emptyTitle={searchQuery || selectedTags.length > 0 ? 'No matching contacts' : 'No contacts yet'}
          emptyDescription={searchQuery || selectedTags.length > 0 ? 'Try adjusting your search or tag filters.' : 'Import a CSV or add contacts one at a time to build your audience.'}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalContacts}
          onPageChange={(page) => updateSearchParam('page', String(page))}
          onExportCsv={handleExportCsv}
        />
      </Card>
    </FeatureShell>
  );
}
