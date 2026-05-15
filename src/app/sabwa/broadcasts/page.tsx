'use client';

/**
 * /sabwa/broadcasts — Broadcast lists (ZoruUI).
 *
 * Per SABWA_PLAN.md §6 page 9: WhatsApp's native broadcast lists (1:1 fan-out,
 * no cross-recipient visibility). CRUD broadcast lists, send composer, history.
 *
 * Two-pane layout on md+: left = list of broadcasts, right = selected detail.
 * On mobile we collapse to a list → detail navigation.
 *
 * Migrated from shadcn `/ui/*` to ZoruUI. Visual swap only — server-action
 * surface, prop shapes and data flow are unchanged.
 */

import * as React from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSeparator,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

// ─── Local model ────────────────────────────────────────────────────────────
// Shape mirrors `SabwaBroadcast` from `@/lib/sabwa/types`, but uses string ids
// (server actions return ObjectId-as-string when crossing the wire).

type RecipientStatus = 'queued' | 'sent' | 'failed' | 'skipped';

interface Recipient {
  jid: string;
  displayName?: string;
  status?: RecipientStatus;
}

interface HistoryEntry {
  id: string;
  sentAt: Date;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  body: string;
}

interface Broadcast {
  id: string;
  name: string;
  recipients: Recipient[];
  history: HistoryEntry[];
  lastSentAt?: Date;
}

const SAMPLE_BROADCASTS: Broadcast[] = [
  {
    id: 'b_welcome',
    name: 'Welcome list',
    recipients: [
      { jid: '919876543210@s.whatsapp.net', displayName: 'Asha Khan' },
      { jid: '919812341234@s.whatsapp.net', displayName: 'Ravi Patel' },
      { jid: '919900112233@s.whatsapp.net', displayName: 'Sneha Rao' },
    ],
    history: [
      {
        id: 'h1',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
        totalCount: 3,
        sentCount: 3,
        failedCount: 0,
        body: 'Welcome to SabNode — reply STOP to opt out.',
      },
    ],
    lastSentAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
  },
  {
    id: 'b_offers',
    name: 'Monthly offers',
    recipients: [
      { jid: '919811111111@s.whatsapp.net', displayName: 'Customer 1' },
      { jid: '919822222222@s.whatsapp.net', displayName: 'Customer 2' },
    ],
    history: [],
  },
];

function fmtTimeAgo(d?: Date): string {
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

// ─── List pane ──────────────────────────────────────────────────────────────

interface BroadcastListPaneProps {
  broadcasts: Broadcast[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function BroadcastListPane({
  broadcasts,
  selectedId,
  onSelect,
  onNew,
  onDelete,
}: BroadcastListPaneProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-zoru-line px-3 py-2">
        <h2 className="text-sm font-semibold text-zoru-ink">Broadcast lists</h2>
        <ZoruButton size="sm" onClick={onNew} className="gap-1">
          <Plus className="h-4 w-4" />
          New
        </ZoruButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {broadcasts.length === 0 ? (
          <div className="p-6 text-center text-sm text-zoru-ink-muted">
            No broadcast lists yet. Create one to start fanning out 1:1 messages.
          </div>
        ) : (
          <ul className="divide-y divide-zoru-line">
            {broadcasts.map((b) => {
              const isActive = b.id === selectedId;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(b.id)}
                    className={cn(
                      'group flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-zoru-surface',
                      isActive && 'bg-zoru-surface',
                    )}
                  >
                    <div
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink"
                    >
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-zoru-ink">
                          {b.name}
                        </p>
                        <span className="shrink-0 text-[11px] text-zoru-ink-muted">
                          {fmtTimeAgo(b.lastSentAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-zoru-ink-muted">
                        {b.recipients.length} recipient
                        {b.recipients.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${b.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(b.id);
                      }}
                      className="rounded-[var(--zoru-radius)] p-1 text-zoru-ink-muted opacity-0 transition group-hover:opacity-100 hover:bg-zoru-danger/10 hover:text-zoru-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zoru-ink-muted md:hidden" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Detail pane ────────────────────────────────────────────────────────────

interface BroadcastDetailPaneProps {
  broadcast: Broadcast;
  onBack: () => void;
  onRename: (id: string, name: string) => void;
  onRemoveRecipients: (id: string, jids: string[]) => void;
  onAddRecipient: (id: string, recipient: Recipient) => void;
  onSend: (id: string, body: string, media: SabFilePick | null) => Promise<void>;
}

function BroadcastDetailPane({
  broadcast,
  onBack,
  onRename,
  onRemoveRecipients,
  onAddRecipient,
  onSend,
}: BroadcastDetailPaneProps) {
  const [nameDraft, setNameDraft] = React.useState(broadcast.name);
  const [editingName, setEditingName] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [body, setBody] = React.useState('');
  const [media, setMedia] = React.useState<SabFilePick | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newJid, setNewJid] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    setNameDraft(broadcast.name);
    setEditingName(false);
    setSelected(new Set());
    setBody('');
    setMedia(null);
  }, [broadcast.id, broadcast.name]);

  const allSelected =
    broadcast.recipients.length > 0 &&
    selected.size === broadcast.recipients.length;

  const toggleAll = React.useCallback(() => {
    setSelected((prev) =>
      prev.size === broadcast.recipients.length
        ? new Set()
        : new Set(broadcast.recipients.map((r) => r.jid)),
    );
  }, [broadcast.recipients]);

  const toggleOne = React.useCallback((jid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  }, []);

  const handleSend = async () => {
    if (!body.trim() && !media) return;
    setSending(true);
    try {
      await onSend(broadcast.id, body.trim(), media);
      setBody('');
      setMedia(null);
    } finally {
      setSending(false);
    }
  };

  const handleAddRecipient = () => {
    const trimmed = newJid.trim();
    if (!trimmed) return;
    const jid = trimmed.includes('@')
      ? trimmed
      : `${trimmed.replace(/\D/g, '')}@s.whatsapp.net`;
    onAddRecipient(broadcast.id, {
      jid,
      displayName: newName.trim() || undefined,
    });
    setNewJid('');
    setNewName('');
    setAddOpen(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-zoru-line px-3 py-2 md:px-4">
        <ZoruButton
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onBack}
          aria-label="Back to list"
        >
          <ArrowLeft className="h-4 w-4" />
        </ZoruButton>
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <ZoruInput
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                if (nameDraft.trim() && nameDraft !== broadcast.name) {
                  onRename(broadcast.id, nameDraft.trim());
                }
                setEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') {
                  setNameDraft(broadcast.name);
                  setEditingName(false);
                }
              }}
              className="h-8"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="flex-1 truncate text-left text-base font-semibold text-zoru-ink hover:underline"
            title="Click to rename"
          >
            {broadcast.name}
          </button>
        )}
        <ZoruBadge variant="secondary" className="shrink-0">
          {broadcast.recipients.length} recipients
        </ZoruBadge>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 md:p-4">
        {/* Recipients */}
        <ZoruCard>
          <ZoruCardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <ZoruCardTitle className="text-sm">Recipients</ZoruCardTitle>
              <ZoruCardDescription className="text-xs">
                Each recipient receives the message as a 1:1 chat.
              </ZoruCardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.size > 0 && (
                <ZoruButton
                  variant="outline"
                  size="sm"
                  className="gap-1 text-zoru-danger"
                  onClick={() => {
                    onRemoveRecipients(broadcast.id, Array.from(selected));
                    setSelected(new Set());
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove ({selected.size})
                </ZoruButton>
              )}
              <ZoruButton
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add recipient
              </ZoruButton>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="px-0">
            {broadcast.recipients.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-zoru-ink-muted">
                No recipients yet. Add at least one to enable sending.
              </div>
            ) : (
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead className="w-10">
                      <ZoruCheckbox
                        aria-label="Select all"
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                      />
                    </ZoruTableHead>
                    <ZoruTableHead>Name</ZoruTableHead>
                    <ZoruTableHead>JID</ZoruTableHead>
                    <ZoruTableHead className="w-10" />
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {broadcast.recipients.map((r) => (
                    <ZoruTableRow key={r.jid}>
                      <ZoruTableCell>
                        <ZoruCheckbox
                          aria-label={`Select ${r.displayName ?? r.jid}`}
                          checked={selected.has(r.jid)}
                          onCheckedChange={() => toggleOne(r.jid)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        {r.displayName ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-xs text-zoru-ink-muted">
                        {r.jid}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <button
                          type="button"
                          aria-label={`Remove ${r.displayName ?? r.jid}`}
                          onClick={() =>
                            onRemoveRecipients(broadcast.id, [r.jid])
                          }
                          className="rounded-[var(--zoru-radius)] p-1 text-zoru-ink-muted hover:bg-zoru-danger/10 hover:text-zoru-danger"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </ZoruTable>
            )}
          </ZoruCardContent>
        </ZoruCard>

        {/* Composer */}
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-sm">Compose &amp; send</ZoruCardTitle>
            <ZoruCardDescription className="text-xs">
              Sent to all {broadcast.recipients.length} recipient
              {broadcast.recipients.length === 1 ? '' : 's'} as 1:1.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-3">
            <ZoruTextarea
              placeholder="Type your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SabFilePickerButton
                  accept="all"
                  onPick={(p) => setMedia(p)}
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {media ? 'Replace media' : 'Attach media'}
                </SabFilePickerButton>
                {media && (
                  <div className="flex items-center gap-1 rounded-[var(--zoru-radius)] bg-zoru-surface px-2 py-1 text-xs text-zoru-ink">
                    <span className="max-w-[180px] truncate">{media.name}</span>
                    <button
                      type="button"
                      onClick={() => setMedia(null)}
                      aria-label="Remove attachment"
                      className="rounded p-0.5 hover:bg-zoru-bg"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <ZoruButton
                size="sm"
                onClick={handleSend}
                disabled={
                  sending ||
                  broadcast.recipients.length === 0 ||
                  (!body.trim() && !media)
                }
                className="gap-1"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send
              </ZoruButton>
            </div>
          </ZoruCardContent>
        </ZoruCard>

        {/* History */}
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-sm">History</ZoruCardTitle>
            <ZoruCardDescription className="text-xs">
              Past sends from this list with delivery counts.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="px-0">
            {broadcast.history.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-zoru-ink-muted">
                No sends yet.
              </div>
            ) : (
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>Sent</ZoruTableHead>
                    <ZoruTableHead>Body</ZoruTableHead>
                    <ZoruTableHead className="w-24 text-right">
                      Delivered
                    </ZoruTableHead>
                    <ZoruTableHead className="w-20 text-right">
                      Failed
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {broadcast.history.map((h) => (
                    <ZoruTableRow key={h.id}>
                      <ZoruTableCell className="whitespace-nowrap text-xs text-zoru-ink-muted">
                        {h.sentAt.toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="max-w-[280px] truncate text-xs">
                        {h.body || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-xs">
                        {h.sentCount}/{h.totalCount}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-xs text-zoru-danger">
                        {h.failedCount}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </ZoruTable>
            )}
          </ZoruCardContent>
        </ZoruCard>
      </div>

      <ZoruDialog open={addOpen} onOpenChange={setAddOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add recipient</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter a phone number with country code, or a full JID.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <ZoruLabel htmlFor="add-jid">Phone or JID</ZoruLabel>
              <ZoruInput
                id="add-jid"
                value={newJid}
                onChange={(e) => setNewJid(e.target.value)}
                placeholder="e.g. 919876543210 or 919876543210@s.whatsapp.net"
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel htmlFor="add-name">Display name (optional)</ZoruLabel>
              <ZoruInput
                id="add-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Asha Khan"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={handleAddRecipient}
              disabled={!newJid.trim()}
            >
              Add
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function BroadcastsPage() {
  const toaster = useZoruToast();
  const [broadcasts, setBroadcasts] =
    React.useState<Broadcast[]>(SAMPLE_BROADCASTS);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    SAMPLE_BROADCASTS[0]?.id ?? null,
  );
  const [newOpen, setNewOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');

  const selected = React.useMemo(
    () => broadcasts.find((b) => b.id === selectedId) ?? null,
    [broadcasts, selectedId],
  );

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const id = `b_${Date.now().toString(36)}`;
    setBroadcasts((prev) => [
      { id, name, recipients: [], history: [] },
      ...prev,
    ]);
    setSelectedId(id);
    setNewName('');
    setNewOpen(false);
    toaster.toast({ title: 'Broadcast list created', description: name });
  };

  const handleDelete = (id: string) => {
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((curr) => (curr === id ? null : curr));
  };

  const handleRename = (id: string, name: string) => {
    setBroadcasts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name } : b)),
    );
  };

  const handleRemoveRecipients = (id: string, jids: string[]) => {
    const toDrop = new Set(jids);
    setBroadcasts((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              recipients: b.recipients.filter((r) => !toDrop.has(r.jid)),
            }
          : b,
      ),
    );
  };

  const handleAddRecipient = (id: string, recipient: Recipient) => {
    setBroadcasts((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        if (b.recipients.some((r) => r.jid === recipient.jid)) return b;
        return { ...b, recipients: [...b.recipients, recipient] };
      }),
    );
  };

  const handleSend = async (
    id: string,
    body: string,
    media: SabFilePick | null,
  ) => {
    // Optimistic local history. Wire to `sendBroadcast` once the Rust engine
    // bridge ships (SABWA_PLAN.md §13).
    const target = broadcasts.find((b) => b.id === id);
    if (!target) return;
    const now = new Date();
    const previewBody = body || (media ? `[media] ${media.name}` : '');
    const entry: HistoryEntry = {
      id: `h_${Date.now().toString(36)}`,
      sentAt: now,
      totalCount: target.recipients.length,
      sentCount: target.recipients.length,
      failedCount: 0,
      body: previewBody,
    };
    setBroadcasts((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              history: [entry, ...b.history],
              lastSentAt: now,
            }
          : b,
      ),
    );
    toaster.toast({
      title: 'Broadcast queued',
      description: `${target.recipients.length} recipient${
        target.recipients.length === 1 ? '' : 's'
      }`,
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col bg-zoru-bg">
      {/* Breadcrumb + heading */}
      <div className="border-b border-zoru-line p-3 md:p-4">
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
              <ZoruBreadcrumbPage>Broadcasts</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </ZoruBreadcrumb>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
              <Send className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[20px] tracking-[-0.015em] text-zoru-ink leading-[1.2]">
                Broadcasts
              </h1>
              <p className="mt-0.5 text-xs text-zoru-ink-muted">
                Native WhatsApp broadcast lists — recipients receive as 1:1, no
                cross-visibility.
              </p>
            </div>
          </div>
          <ZoruButton onClick={() => setNewOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New broadcast list</span>
            <span className="sm:hidden">New</span>
          </ZoruButton>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {/* md+: two-pane */}
        <div className="hidden h-full md:grid md:grid-cols-[320px_1fr] md:divide-x md:divide-zoru-line">
          <BroadcastListPane
            broadcasts={broadcasts}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onNew={() => setNewOpen(true)}
            onDelete={handleDelete}
          />
          {selected ? (
            <BroadcastDetailPane
              broadcast={selected}
              onBack={() => setSelectedId(null)}
              onRename={handleRename}
              onRemoveRecipients={handleRemoveRecipients}
              onAddRecipient={handleAddRecipient}
              onSend={handleSend}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <Users className="mx-auto h-8 w-8 text-zoru-ink-muted" />
                <p className="mt-3 text-sm font-medium text-zoru-ink">
                  Select or create a broadcast list
                </p>
                <p className="mt-1 text-xs text-zoru-ink-muted">
                  Broadcast lists let you fan out a message to many contacts,
                  while keeping each thread 1:1.
                </p>
              </div>
            </div>
          )}
        </div>
        {/* Mobile: list ⇄ detail navigation */}
        <div className="h-full md:hidden">
          {selected ? (
            <BroadcastDetailPane
              broadcast={selected}
              onBack={() => setSelectedId(null)}
              onRename={handleRename}
              onRemoveRecipients={handleRemoveRecipients}
              onAddRecipient={handleAddRecipient}
              onSend={handleSend}
            />
          ) : (
            <BroadcastListPane
              broadcasts={broadcasts}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onNew={() => setNewOpen(true)}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      <ZoruDialog open={newOpen} onOpenChange={setNewOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New broadcast list</ZoruDialogTitle>
            <ZoruDialogDescription>
              Give the list a recognisable name. You can add recipients after
              creating it.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-1">
            <ZoruLabel htmlFor="new-broadcast-name">Name</ZoruLabel>
            <ZoruInput
              id="new-broadcast-name"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Premium customers"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
            />
          </div>
          <ZoruSeparator />
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
