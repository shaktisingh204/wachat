'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import {
  BookUser,
  Ban,
  Download,
  MessageSquare,
  Plus,
  Search,
  Smartphone,
  Tag as TagIcon,
  Upload,
  Users,
  X,
} from 'lucide-react';

/**
 * SabWa - Contacts (Page 14)
 *
 * Unified contact book for a SabWa session. A table with avatar / name /
 * phone / last-interaction / tags / source columns, plus a right-side
 * drawer showing profile + tags + custom fields + notes + mutual groups +
 * last 5 messages + scheduled messages for the selected contact.
 *
 * Pure 20ui. The drawer's section strip is a 20ui SegmentedControl (no tab
 * UI). No server actions, prop shapes, or data flow changed.
 *
 * Source of truth: SABWA_PLAN.md section 6 - Page 14.
 */

import * as React from 'react';
import Link from 'next/link';

import {
  listContacts,
  getContact,
  updateContact,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import { formatJid, useResolveJid } from '@/lib/sabwa/format-jid';
import type { SabwaContact } from '@/lib/sabwa/types';

// Local view model -----------------------------------------------------------

type ContactSource = 'synced' | 'manual' | 'imported';

interface ContactRow extends Omit<SabwaContact, '_id' | 'projectId' | 'sessionId'> {
  id: string;
  source: ContactSource;
  lastMessages?: { id: string; body: string; ts: string; fromMe: boolean }[];
  mutualGroups?: { jid: string; subject: string }[];
  scheduledForContact?: { id: string; scheduledFor: string; body: string }[];
}

const SOURCES: { value: ContactSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'synced', label: 'Synced' },
  { value: 'manual', label: 'Manual' },
  { value: 'imported', label: 'Imported' },
];

type DrawerSection = 'overview' | 'messages' | 'groups' | 'scheduled';

const DRAWER_SECTIONS: { value: DrawerSection; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'messages', label: 'Messages' },
  { value: 'groups', label: 'Groups' },
  { value: 'scheduled', label: 'Scheduled' },
];

function initialsFromName(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function formatRelative(ts?: Date | string): string {
  if (!ts) return '-';
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return '-';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86_400 * 7) return `${Math.floor(diff / 86_400)}d ago`;
  return d.toLocaleDateString();
}

function toContactRow(c: SabwaContact): ContactRow {
  return {
    id: String(c._id),
    jid: c.jid,
    phoneE164: c.phoneE164,
    name: c.name,
    pushName: c.pushName,
    profilePicUrl: c.profilePicUrl,
    isBusiness: c.isBusiness,
    isBlocked: c.isBlocked,
    isMyContact: c.isMyContact,
    tags: c.tags ?? [],
    customFields: c.customFields ?? {},
    notes: c.notes,
    lastInteractionAt: c.lastInteractionAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    source: c.isMyContact ? 'synced' : 'manual',
  };
}

// Page -----------------------------------------------------------------------

export default function Page() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? null;
  const resolve = useResolveJid(sessionId);
  const { toast } = useToast();
  const [search, setSearch] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState<string>('all');
  const [sourceFilter, setSourceFilter] = React.useState<ContactSource | 'all'>(
    'all',
  );
  const [contacts, setContacts] = React.useState<ContactRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeContact, setActiveContact] = React.useState<ContactRow | null>(
    null,
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');
  const [importFile, setImportFile] = React.useState<File | null>(null);

  // Initial + filtered load.
  React.useEffect(() => {
    if (!sessionId) {
      setContacts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listContacts({
      sessionId,
      search: search || undefined,
      tag: tagFilter !== 'all' ? tagFilter : undefined,
      source: sourceFilter !== 'all' ? sourceFilter : undefined,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setContacts(res.contacts.map(toContactRow));
        else setContacts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, search, tagFilter, sourceFilter]);

  // All unique tags across the loaded set, for the tag-filter dropdown.
  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) for (const t of c.tags) set.add(t);
    return Array.from(set).sort();
  }, [contacts]);

  const allSelected = selected.size > 0 && selected.size === contacts.length;
  const someSelected = selected.size > 0 && selected.size < contacts.length;

  const toggleRow = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) =>
      prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id)),
    );
  }, [contacts]);

  const openContact = React.useCallback(async (row: ContactRow) => {
    setActiveContact(row);
    setDrawerOpen(true);
    if (!sessionId) return;
    // Hydrate full contact details from server.
    const res = await getContact({
      sessionId,
      jid: row.jid,
    });
    if (res.ok && res.contact) {
      setActiveContact((prev) =>
        prev && prev.jid === row.jid ? { ...prev, ...toContactRow(res.contact!) } : prev,
      );
    }
  }, [sessionId]);

  const exportSelectedCsv = React.useCallback(() => {
    const rows = contacts.filter((c) => selected.has(c.id));
    if (rows.length === 0) return;
    const header = ['Name', 'Phone', 'JID', 'Source', 'Tags', 'Last interaction'];
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [
          JSON.stringify(r.name ?? r.pushName ?? ''),
          JSON.stringify(r.phoneE164 ?? ''),
          JSON.stringify(r.jid),
          r.source,
          JSON.stringify(r.tags.join('|')),
          r.lastInteractionAt ? new Date(r.lastInteractionAt).toISOString() : '',
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sabwa-contacts-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} contacts to CSV`);
  }, [contacts, selected, toast]);

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10 space-y-6">
        <Breadcrumb
          items={[
            { label: 'SabNode', href: '/dashboard' },
            { label: 'SabWa', href: '/sabwa' },
            { label: 'Contacts' },
          ]}
        />
        <EmptyState
          icon={Smartphone}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'SabNode', href: '/dashboard' },
          { label: 'SabWa', href: '/sabwa' },
          { label: 'Contacts' },
        ]}
      />

      {/* Header */}
      <PageHeader bordered={false}>
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
            aria-hidden="true"
          >
            <BookUser className="h-5 w-5" />
          </span>
          <PageHeaderHeading>
            <PageTitle>Contacts</PageTitle>
            <PageDescription>
              Unified contact book. Search, tag, segment, and segment-export your
              audience.
            </PageDescription>
          </PageHeaderHeading>
        </div>
        <PageActions>
          <Button variant="outline" iconLeft={Upload} onClick={() => setImportOpen(true)}>
            Import CSV
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={() => setAddOpen(true)}>
            Add contact
          </Button>
        </PageActions>
      </PageHeader>

      {/* Filter bar */}
      <Card padding="none">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or push name"
                iconLeft={Search}
                aria-label="Search contacts"
              />
            </div>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filter by tag">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sourceFilter}
              onValueChange={(v) => setSourceFilter(v as ContactSource | 'all')}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filter by source">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2 text-sm">
              <span className="text-[var(--st-text-secondary)]">
                {selected.size} selected
              </span>
              <Separator orientation="vertical" className="h-5" />
              <Button size="sm" variant="ghost" iconLeft={TagIcon}>
                Tag
              </Button>
              <Button size="sm" variant="ghost" iconLeft={Download} onClick={exportSelectedCsv}>
                Export CSV
              </Button>
              <Button size="sm" variant="ghost" iconLeft={Users}>
                Add to broadcast
              </Button>
              <Button size="sm" variant="ghost" iconLeft={Ban} className="text-[var(--st-danger)]">
                Block
              </Button>
              <IconButton
                label="Clear selection"
                icon={X}
                size="sm"
                className="ml-auto"
                onClick={() => setSelected(new Set())}
              />
            </div>
          )}
        </CardHeader>
        <CardBody className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th width={40}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    aria-label="Select all contacts"
                  />
                </Th>
                <Th>Contact</Th>
                <Th>Phone</Th>
                <Th>Last interaction</Th>
                <Th>Tags</Th>
                <Th>Source</Th>
              </Tr>
            </THead>
            <TBody>
              {loading && contacts.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <Tr key={`contacts-skeleton-${i}`}>
                    <Td colSpan={6} className="py-2">
                      <Skeleton height={56} radius="var(--st-radius-lg)" />
                    </Td>
                  </Tr>
                ))}
              {!loading && contacts.length === 0 && (
                <Tr>
                  <Td colSpan={6} className="py-8">
                    <EmptyState
                      icon={Users}
                      title="No contacts yet"
                      description="Import a CSV in seconds, or add one manually. Once your WhatsApp session syncs, address-book contacts will appear here automatically."
                      action={
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button variant="primary" iconLeft={Plus} onClick={() => setAddOpen(true)}>
                            Add contact
                          </Button>
                          <Button variant="outline" iconLeft={Upload} onClick={() => setImportOpen(true)}>
                            Import CSV
                          </Button>
                        </div>
                      }
                    />
                  </Td>
                </Tr>
              )}
              {contacts.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <Tr
                    key={c.id}
                    selected={checked}
                    className="cursor-pointer"
                    onClick={() => openContact(c)}
                  >
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleRow(c.id)}
                        aria-label={`Select ${c.name ?? c.jid}`}
                      />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {c.profilePicUrl ? (
                            <AvatarImage src={c.profilePicUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {initialsFromName(c.name ?? c.pushName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-[var(--st-text)]">
                              {c.name ?? c.pushName ?? resolve(c.jid)}
                            </span>
                            {c.isBusiness && (
                              <Badge variant="info" className="text-[10px]">
                                Business
                              </Badge>
                            )}
                          </div>
                          <div className="truncate text-xs text-[var(--st-text-secondary)]">
                            {formatJid(c.jid)}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td className="font-mono text-xs">
                      {c.phoneE164 ?? '-'}
                    </Td>
                    <Td className="text-sm text-[var(--st-text-secondary)]">
                      {formatRelative(c.lastInteractionAt)}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0 && (
                          <span className="text-xs text-[var(--st-text-secondary)]">-</span>
                        )}
                        {c.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                        {c.tags.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{c.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {c.source}
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      {/* Detail drawer */}
      <ContactDrawer
        sessionId={sessionId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        contact={activeContact}
        onContactPatched={(patched) => {
          setActiveContact(patched);
          setContacts((prev) =>
            prev.map((c) => (c.id === patched.id ? patched : c)),
          );
        }}
      />

      {/* Add contact dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
            <DialogDescription>
              Add a phone number that&apos;s not in your synced WhatsApp contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name" id="contact-name">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Lina from Aurora"
              />
            </Field>
            <Field label="Phone (E.164)" id="contact-phone">
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+919876543210"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setAddOpen(false);
                setNewName('');
                setNewPhone('');
                toast.success('Contact queued');
                // TODO (Phase 2): call createContact action.
              }}
              disabled={!newPhone}
            >
              Add contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import contacts from CSV</DialogTitle>
            <DialogDescription>
              CSV columns: <code>name,phone,tags</code>. Phones must be E.164.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <SabFileToFileButton
              accept="all"
              onPickFile={(file) => {
                setImportFile(file);
                toast.success(`Selected ${file.name}`);
              }}
              onError={() => toast.error('Could not load that file')}
            >
              Choose CSV from SabFiles
            </SabFileToFileButton>
            {importFile ? (
              <span className="truncate text-sm text-[var(--st-text-secondary)]">
                {importFile.name}
              </span>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setImportOpen(false);
                setImportFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!importFile}
              onClick={() => {
                setImportOpen(false);
                setImportFile(null);
                toast.success('Import started');
              }}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Contact drawer -------------------------------------------------------------

interface ContactDrawerProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactRow | null;
  onContactPatched: (next: ContactRow) => void;
}

function ContactDrawer({
  sessionId,
  open,
  onOpenChange,
  contact,
  onContactPatched,
}: ContactDrawerProps) {
  const [tagInput, setTagInput] = React.useState('');
  const [notesDraft, setNotesDraft] = React.useState('');
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [section, setSection] = React.useState<DrawerSection>('overview');

  React.useEffect(() => {
    setNotesDraft(contact?.notes ?? '');
    setTagInput('');
    setSection('overview');
  }, [contact?.id, contact?.notes]);

  if (!contact) return null;

  const addTag = async () => {
    const t = tagInput.trim();
    if (!t || contact.tags.includes(t)) return;
    const nextTags = [...contact.tags, t];
    const next: ContactRow = { ...contact, tags: nextTags };
    onContactPatched(next);
    setTagInput('');
    await updateContact({
      sessionId,
      jid: contact.jid,
      patch: { tags: nextTags },
    });
  };

  const removeTag = async (t: string) => {
    const nextTags = contact.tags.filter((x) => x !== t);
    const next: ContactRow = { ...contact, tags: nextTags };
    onContactPatched(next);
    await updateContact({
      sessionId,
      jid: contact.jid,
      patch: { tags: nextTags },
    });
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const next: ContactRow = { ...contact, notes: notesDraft };
    onContactPatched(next);
    await updateContact({
      sessionId,
      jid: contact.jid,
      patch: { notes: notesDraft },
    });
    setSavingNotes(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Contact</SheetTitle>
          <SheetDescription>
            Profile, tags, notes, history.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-3">
          <Avatar className="h-14 w-14">
            {contact.profilePicUrl ? (
              <AvatarImage src={contact.profilePicUrl} alt="" />
            ) : null}
            <AvatarFallback>
              {initialsFromName(contact.name ?? contact.pushName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-semibold text-[var(--st-text)]">
                {contact.name ?? contact.pushName ?? formatJid(contact.jid)}
              </p>
              {contact.isBusiness && (
                <Badge variant="info" className="text-[10px]">
                  Business
                </Badge>
              )}
              {contact.isBlocked && (
                <Badge variant="danger" className="text-[10px]">
                  Blocked
                </Badge>
              )}
            </div>
            <p className="truncate font-mono text-xs text-[var(--st-text-secondary)]">
              {contact.phoneE164 ?? formatJid(contact.jid)}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" iconLeft={MessageSquare}>
            Open chat
          </Button>
          <Button size="sm" variant="outline" iconLeft={Users}>
            Add to broadcast
          </Button>
          <Button size="sm" variant="outline" iconLeft={TagIcon}>
            Add to label
          </Button>
          <Button size="sm" variant="outline" iconLeft={Ban} className="text-[var(--st-danger)]">
            {contact.isBlocked ? 'Unblock' : 'Block'}
          </Button>
        </div>

        <Separator className="my-4" />

        {/* Section switcher - 20ui SegmentedControl replaces the old Tabs UI */}
        <SegmentedControl
          items={DRAWER_SECTIONS}
          value={section}
          onChange={(v) => setSection(v as DrawerSection)}
          fullWidth
          aria-label="Contact section"
        />

        {section === 'overview' && (
          <div className="space-y-4 pt-4">
            {/* Tags */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-[var(--st-text)]">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.length === 0 && (
                  <span className="text-xs text-[var(--st-text-secondary)]">No tags yet.</span>
                )}
                {contact.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <IconButton
                      label={`Remove tag ${t}`}
                      icon={X}
                      size="sm"
                      onClick={() => removeTag(t)}
                      className="ml-0.5 opacity-70 hover:opacity-100"
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addTag();
                    }
                  }}
                  placeholder="Add a tag and press enter"
                  inputSize="sm"
                  aria-label="Add a tag"
                />
                <Button size="sm" variant="outline" onClick={() => void addTag()}>
                  Add
                </Button>
              </div>
            </section>

            {/* Custom fields */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-[var(--st-text)]">Custom fields</h3>
              <CustomFieldsEditor
                value={contact.customFields ?? {}}
                onChange={(next) => {
                  const patched: ContactRow = {
                    ...contact,
                    customFields: next,
                  };
                  onContactPatched(patched);
                  void updateContact({
                    sessionId,
                    jid: contact.jid,
                    patch: { customFields: next },
                  });
                }}
              />
            </section>

            {/* Notes */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-[var(--st-text)]">Notes</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={savingNotes || notesDraft === (contact.notes ?? '')}
                  onClick={() => void saveNotes()}
                >
                  {savingNotes ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <Textarea
                rows={4}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Free-form notes about this contact"
                aria-label="Contact notes"
              />
            </section>
          </div>
        )}

        {section === 'messages' && (
          <div className="pt-4">
            <ul className="space-y-2 text-sm">
              {(contact.lastMessages ?? []).length === 0 && (
                <li className="text-[var(--st-text-secondary)]">
                  No recent messages with this contact.
                </li>
              )}
              {(contact.lastMessages ?? []).slice(0, 5).map((m) => (
                <li
                  key={m.id}
                  className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2"
                >
                  <div className="flex justify-between gap-2 text-[11px] text-[var(--st-text-secondary)]">
                    <span>{m.fromMe ? 'You' : contact.name ?? 'Contact'}</span>
                    <span>{formatRelative(m.ts)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[var(--st-text)]">{m.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {section === 'groups' && (
          <div className="pt-4">
            <ul className="space-y-1.5 text-sm">
              {(contact.mutualGroups ?? []).length === 0 && (
                <li className="text-[var(--st-text-secondary)]">
                  No mutual groups detected yet.
                </li>
              )}
              {(contact.mutualGroups ?? []).map((g) => (
                <li
                  key={g.jid}
                  className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1.5"
                >
                  <span className="truncate text-[var(--st-text)]">{g.subject}</span>
                  <Badge variant="outline" className="text-[10px]">
                    Group
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {section === 'scheduled' && (
          <div className="pt-4">
            <ul className="space-y-1.5 text-sm">
              {(contact.scheduledForContact ?? []).length === 0 && (
                <li className="text-[var(--st-text-secondary)]">
                  Nothing scheduled to this contact.
                </li>
              )}
              {(contact.scheduledForContact ?? []).map((s) => (
                <li
                  key={s.id}
                  className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2"
                >
                  <div className="flex justify-between text-[11px] text-[var(--st-text-secondary)]">
                    <span>Scheduled</span>
                    <span>{formatRelative(s.scheduledFor)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[var(--st-text)]">{s.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Custom-fields editor -------------------------------------------------------

interface CustomFieldsEditorProps {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

function CustomFieldsEditor({ value, onChange }: CustomFieldsEditorProps) {
  const [keyDraft, setKeyDraft] = React.useState('');
  const [valDraft, setValDraft] = React.useState('');

  const entries = Object.entries(value);

  const addPair = () => {
    const k = keyDraft.trim();
    if (!k) return;
    onChange({ ...value, [k]: valDraft });
    setKeyDraft('');
    setValDraft('');
  };

  const removePair = (k: string) => {
    const next = { ...value };
    delete next[k];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-xs text-[var(--st-text-secondary)]">No custom fields yet.</p>
      )}
      <ul className="space-y-1.5">
        {entries.map(([k, v]) => (
          <li key={k} className="flex items-center gap-2 text-sm">
            <span className="min-w-[100px] truncate font-medium text-[var(--st-text)]">{k}</span>
            <span className="flex-1 truncate text-[var(--st-text-secondary)]">{v}</span>
            <IconButton
              label={`Remove field ${k}`}
              icon={X}
              size="sm"
              variant="ghost"
              onClick={() => removePair(k)}
            />
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="Key"
          inputSize="sm"
          aria-label="Custom field key"
        />
        <Input
          value={valDraft}
          onChange={(e) => setValDraft(e.target.value)}
          placeholder="Value"
          inputSize="sm"
          aria-label="Custom field value"
        />
        <Button size="sm" variant="outline" iconLeft={Plus} onClick={addPair} disabled={!keyDraft} aria-label="Add custom field" />
      </div>
    </div>
  );
}
