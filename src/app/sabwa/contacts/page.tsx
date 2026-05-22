'use client';

import {
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  cn,
} from '@/components/zoruui';
import {
  BookUser,
  Ban,
  CheckSquare,
  Download,
  MessageSquare,
  Plus,
  Search,
  Smartphone,
  Square,
  Tag as TagIcon,
  Upload,
  Users,
  X,
  } from 'lucide-react';

/**
 * SabWa — Contacts (Page 14)
 *
 * Unified contact book for a SabWa session. DataTable with avatar / name /
 * phone / last-interaction / tags / source columns, plus a right-side
 * drawer showing profile + tags + custom fields + notes + mutual groups +
 * last 5 messages + scheduled messages for the selected contact.
 *
 * Migrated to ZoruUI primitives. The drawer's tab strip is replaced with
 * a segmented Button group (no tab UI per the ZoruUI design rules).
 * No server actions, prop shapes, or data flow changed.
 *
 * Source of truth: SABWA_PLAN.md § 6 — Page 14.
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

// ─── Local view model ──────────────────────────────────────────────────────

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
  if (!ts) return '—';
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return '—';
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

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Page() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? null;
  const resolve = useResolveJid(sessionId);
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
  }, [contacts, selected]);

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10 space-y-6">
        <ZoruBreadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Contacts</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </ZoruBreadcrumb>
        <ZoruEmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <ZoruButton size="md">Open accounts</ZoruButton>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10 space-y-6">
      {/* Breadcrumb */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Contacts</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
            <BookUser className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[24px] tracking-[-0.015em] text-zoru-ink leading-[1.2]">
              Contacts
            </h1>
            <p className="mt-1 text-[13px] text-zoru-ink-muted max-w-2xl">
              Unified contact book — search, tag, segment, and segment-export
              your audience.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ZoruButton variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </ZoruButton>
          <ZoruButton onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add contact
          </ZoruButton>
        </div>
      </div>

      {/* Filter bar */}
      <ZoruCard>
        <ZoruCardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
              <ZoruInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or push name…"
                className="pl-9"
                aria-label="Search contacts"
              />
            </div>
            <ZoruSelect value={tagFilter} onValueChange={setTagFilter}>
              <ZoruSelectTrigger className="w-[180px]">
                <ZoruSelectValue placeholder="All tags" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All tags</ZoruSelectItem>
                {allTags.map((t) => (
                  <ZoruSelectItem key={t} value={t}>
                    {t}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={sourceFilter}
              onValueChange={(v) => setSourceFilter(v as ContactSource | 'all')}
            >
              <ZoruSelectTrigger className="w-[160px]">
                <ZoruSelectValue placeholder="All sources" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {SOURCES.map((s) => (
                  <ZoruSelectItem key={s.value} value={s.value}>
                    {s.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-2 text-sm">
              <span className="text-zoru-ink-muted">
                {selected.size} selected
              </span>
              <ZoruSeparator orientation="vertical" className="h-5" />
              <ZoruButton size="sm" variant="ghost">
                <TagIcon className="mr-1.5 h-3.5 w-3.5" /> Tag
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" onClick={exportSelectedCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost">
                <Users className="mr-1.5 h-3.5 w-3.5" /> Add to broadcast
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" className="text-zoru-danger">
                <Ban className="mr-1.5 h-3.5 w-3.5" /> Block
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => setSelected(new Set())}
              >
                <X className="h-3.5 w-3.5" />
              </ZoruButton>
            </div>
          )}
        </ZoruCardHeader>
        <ZoruCardContent className="p-0">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-10">
                  <button
                    type="button"
                    aria-label="Select all"
                    onClick={toggleAll}
                    className="inline-flex h-5 w-5 items-center justify-center"
                  >
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-zoru-ink" />
                    ) : (
                      <Square className="h-4 w-4 text-zoru-ink-muted" />
                    )}
                  </button>
                </ZoruTableHead>
                <ZoruTableHead>Contact</ZoruTableHead>
                <ZoruTableHead>Phone</ZoruTableHead>
                <ZoruTableHead>Last interaction</ZoruTableHead>
                <ZoruTableHead>Tags</ZoruTableHead>
                <ZoruTableHead>Source</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loading && contacts.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <ZoruTableRow key={`contacts-skeleton-${i}`}>
                    <ZoruTableCell colSpan={6} className="py-2">
                      <ZoruSkeleton className="h-[56px] w-full rounded-[var(--zoru-radius-lg)]" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              {!loading && contacts.length === 0 && (
                <ZoruTableRow>
                  <ZoruTableCell colSpan={6} className="py-8">
                    <ZoruEmptyState
                      icon={<Users />}
                      title="No contacts yet"
                      description="Import a CSV in seconds, or add one manually. Once your WhatsApp session syncs, address-book contacts will appear here automatically."
                      action={
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <ZoruButton onClick={() => setAddOpen(true)}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Add contact
                          </ZoruButton>
                          <ZoruButton
                            variant="outline"
                            onClick={() => setImportOpen(true)}
                          >
                            <Upload className="mr-1.5 h-4 w-4" />
                            Import CSV
                          </ZoruButton>
                        </div>
                      }
                    />
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
              {contacts.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <ZoruTableRow
                    key={c.id}
                    className={cn(
                      'cursor-pointer',
                      checked && 'bg-zoru-surface',
                    )}
                    onClick={() => openContact(c)}
                  >
                    <ZoruTableCell onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`Select ${c.name ?? c.jid}`}
                        onClick={() => toggleRow(c.id)}
                        className="inline-flex h-5 w-5 items-center justify-center"
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 text-zoru-ink" />
                        ) : (
                          <Square className="h-4 w-4 text-zoru-ink-muted" />
                        )}
                      </button>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex items-center gap-3">
                        <ZoruAvatar className="h-9 w-9">
                          {c.profilePicUrl ? (
                            <ZoruAvatarImage src={c.profilePicUrl} alt="" />
                          ) : null}
                          <ZoruAvatarFallback className="text-xs">
                            {initialsFromName(c.name ?? c.pushName)}
                          </ZoruAvatarFallback>
                        </ZoruAvatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-zoru-ink">
                              {c.name ?? c.pushName ?? resolve(c.jid)}
                            </span>
                            {c.isBusiness && (
                              <ZoruBadge variant="info" className="text-[10px]">
                                Business
                              </ZoruBadge>
                            )}
                          </div>
                          <div className="truncate text-xs text-zoru-ink-muted">
                            {formatJid(c.jid)}
                          </div>
                        </div>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs">
                      {c.phoneE164 ?? '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-sm text-zoru-ink-muted">
                      {formatRelative(c.lastInteractionAt)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0 && (
                          <span className="text-xs text-zoru-ink-muted">—</span>
                        )}
                        {c.tags.slice(0, 3).map((t) => (
                          <ZoruBadge key={t} variant="secondary" className="text-[10px]">
                            {t}
                          </ZoruBadge>
                        ))}
                        {c.tags.length > 3 && (
                          <ZoruBadge variant="outline" className="text-[10px]">
                            +{c.tags.length - 3}
                          </ZoruBadge>
                        )}
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {c.source}
                      </ZoruBadge>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCardContent>
      </ZoruCard>

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
      <ZoruDialog open={addOpen} onOpenChange={setAddOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add contact</ZoruDialogTitle>
            <ZoruDialogDescription>
              Add a phone number that&apos;s not in your synced WhatsApp contacts.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="contact-name">Name</ZoruLabel>
              <ZoruInput
                id="contact-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Lina from Aurora"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="contact-phone">Phone (E.164)</ZoruLabel>
              <ZoruInput
                id="contact-phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+919876543210"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                setAddOpen(false);
                setNewName('');
                setNewPhone('');
                // TODO (Phase 2): call createContact action.
              }}
              disabled={!newPhone}
            >
              Add contact
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Import CSV dialog */}
      <ZoruDialog open={importOpen} onOpenChange={setImportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Import contacts from CSV</ZoruDialogTitle>
            <ZoruDialogDescription>
              CSV columns: <code>name,phone,tags</code>. Phones must be E.164.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruInput type="file" accept=".csv,text/csv" />
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={() => setImportOpen(false)}>Import</ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}

// ─── Contact drawer ────────────────────────────────────────────────────────

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
    <ZoruSheet open={open} onOpenChange={onOpenChange}>
      <ZoruSheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <ZoruSheetHeader>
          <ZoruSheetTitle>Contact</ZoruSheetTitle>
          <ZoruSheetDescription>
            Profile, tags, notes, history.
          </ZoruSheetDescription>
        </ZoruSheetHeader>

        <div className="mt-4 flex items-center gap-3">
          <ZoruAvatar className="h-14 w-14">
            {contact.profilePicUrl ? (
              <ZoruAvatarImage src={contact.profilePicUrl} alt="" />
            ) : null}
            <ZoruAvatarFallback>
              {initialsFromName(contact.name ?? contact.pushName)}
            </ZoruAvatarFallback>
          </ZoruAvatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-semibold text-zoru-ink">
                {contact.name ?? contact.pushName ?? formatJid(contact.jid)}
              </p>
              {contact.isBusiness && (
                <ZoruBadge variant="info" className="text-[10px]">
                  Business
                </ZoruBadge>
              )}
              {contact.isBlocked && (
                <ZoruBadge variant="danger" className="text-[10px]">
                  Blocked
                </ZoruBadge>
              )}
            </div>
            <p className="truncate font-mono text-xs text-zoru-ink-muted">
              {contact.phoneE164 ?? formatJid(contact.jid)}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ZoruButton size="sm" variant="outline">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Open chat
          </ZoruButton>
          <ZoruButton size="sm" variant="outline">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Add to broadcast
          </ZoruButton>
          <ZoruButton size="sm" variant="outline">
            <TagIcon className="mr-1.5 h-3.5 w-3.5" /> Add to label
          </ZoruButton>
          <ZoruButton size="sm" variant="outline" className="text-zoru-danger">
            <Ban className="mr-1.5 h-3.5 w-3.5" />{' '}
            {contact.isBlocked ? 'Unblock' : 'Block'}
          </ZoruButton>
        </div>

        <ZoruSeparator className="my-4" />

        {/* Section switcher — segmented buttons replace the old Tabs UI */}
        <div
          role="group"
          aria-label="Contact section"
          className="flex w-full rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1"
        >
          {DRAWER_SECTIONS.map((s) => (
            <ZoruButton
              key={s.value}
              type="button"
              variant={section === s.value ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 rounded-[calc(var(--zoru-radius)-2px)]"
              onClick={() => setSection(s.value)}
            >
              {s.label}
            </ZoruButton>
          ))}
        </div>

        {section === 'overview' && (
          <div className="space-y-4 pt-4">
            {/* Tags */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-zoru-ink">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.length === 0 && (
                  <span className="text-xs text-zoru-ink-muted">No tags yet.</span>
                )}
                {contact.tags.map((t) => (
                  <ZoruBadge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t}`}
                      onClick={() => removeTag(t)}
                      className="ml-0.5 rounded-sm opacity-70 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </ZoruBadge>
                ))}
              </div>
              <div className="flex gap-2">
                <ZoruInput
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addTag();
                    }
                  }}
                  placeholder="Add a tag and press enter"
                  className="h-8 text-sm"
                />
                <ZoruButton size="sm" variant="outline" onClick={() => void addTag()}>
                  Add
                </ZoruButton>
              </div>
            </section>

            {/* Custom fields */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-zoru-ink">Custom fields</h3>
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
                <h3 className="text-sm font-medium text-zoru-ink">Notes</h3>
                <ZoruButton
                  size="sm"
                  variant="ghost"
                  disabled={savingNotes || notesDraft === (contact.notes ?? '')}
                  onClick={() => void saveNotes()}
                >
                  {savingNotes ? 'Saving…' : 'Save'}
                </ZoruButton>
              </div>
              <ZoruTextarea
                rows={4}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Free-form notes about this contact…"
              />
            </section>
          </div>
        )}

        {section === 'messages' && (
          <div className="pt-4">
            <ul className="space-y-2 text-sm">
              {(contact.lastMessages ?? []).length === 0 && (
                <li className="text-zoru-ink-muted">
                  No recent messages with this contact.
                </li>
              )}
              {(contact.lastMessages ?? []).slice(0, 5).map((m) => (
                <li
                  key={m.id}
                  className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-2"
                >
                  <div className="flex justify-between gap-2 text-[11px] text-zoru-ink-muted">
                    <span>{m.fromMe ? 'You' : contact.name ?? 'Contact'}</span>
                    <span>{formatRelative(m.ts)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-zoru-ink">{m.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {section === 'groups' && (
          <div className="pt-4">
            <ul className="space-y-1.5 text-sm">
              {(contact.mutualGroups ?? []).length === 0 && (
                <li className="text-zoru-ink-muted">
                  No mutual groups detected yet.
                </li>
              )}
              {(contact.mutualGroups ?? []).map((g) => (
                <li
                  key={g.jid}
                  className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-2 py-1.5"
                >
                  <span className="truncate text-zoru-ink">{g.subject}</span>
                  <ZoruBadge variant="outline" className="text-[10px]">
                    Group
                  </ZoruBadge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {section === 'scheduled' && (
          <div className="pt-4">
            <ul className="space-y-1.5 text-sm">
              {(contact.scheduledForContact ?? []).length === 0 && (
                <li className="text-zoru-ink-muted">
                  Nothing scheduled to this contact.
                </li>
              )}
              {(contact.scheduledForContact ?? []).map((s) => (
                <li
                  key={s.id}
                  className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-2"
                >
                  <div className="flex justify-between text-[11px] text-zoru-ink-muted">
                    <span>Scheduled</span>
                    <span>{formatRelative(s.scheduledFor)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-zoru-ink">{s.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ZoruSheetContent>
    </ZoruSheet>
  );
}

// ─── Custom-fields editor ──────────────────────────────────────────────────

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
        <p className="text-xs text-zoru-ink-muted">No custom fields yet.</p>
      )}
      <ul className="space-y-1.5">
        {entries.map(([k, v]) => (
          <li key={k} className="flex items-center gap-2 text-sm">
            <span className="min-w-[100px] truncate font-medium text-zoru-ink">{k}</span>
            <span className="flex-1 truncate text-zoru-ink-muted">{v}</span>
            <ZoruButton
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove field ${k}`}
              onClick={() => removePair(k)}
            >
              <X className="h-3.5 w-3.5" />
            </ZoruButton>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <ZoruInput
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="Key"
          className="h-8 text-sm"
        />
        <ZoruInput
          value={valDraft}
          onChange={(e) => setValDraft(e.target.value)}
          placeholder="Value"
          className="h-8 text-sm"
        />
        <ZoruButton size="sm" variant="outline" onClick={addPair} disabled={!keyDraft}>
          <Plus className="h-3.5 w-3.5" />
        </ZoruButton>
      </div>
    </div>
  );
}
