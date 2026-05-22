'use client';

import {
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
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Separator,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
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

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import {
  deleteBroadcast,
  listBroadcasts,
  sendBroadcast,
  upsertBroadcast,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import { formatJid, useResolveJid } from '@/lib/sabwa/format-jid';
import type {
  SabwaBroadcast,
  SabwaBroadcastRecipientStatus,
  SabwaScheduledPayload,
} from '@/lib/sabwa/types';

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

// ─── Wire mapping ───────────────────────────────────────────────────────────
// The engine row carries `_id`/`projectId`/`sessionId` as `ObjectId` typed
// fields but serialises them as strings across the server-action boundary, and
// returns `recipients` as `SabwaBroadcastRecipientStatus[]` (no `displayName`).
// We map down to the leaner `Broadcast`/`Recipient` shape the UI renders.

type BroadcastWire = SabwaBroadcast | (Omit<SabwaBroadcast, '_id' | 'projectId' | 'sessionId'> & {
  _id: string;
  projectId: string;
  sessionId: string;
});

function recipientStatusToUi(
  s: SabwaBroadcastRecipientStatus['status'],
): RecipientStatus | undefined {
  if (s === 'queued' || s === 'sent' || s === 'failed' || s === 'skipped') return s;
  // map SabwaMessageStatus → UI status
  if (s === 'delivered' || s === 'read' || s === 'sending') return 'sent';
  return undefined;
}

function mapWireToBroadcast(b: BroadcastWire): Broadcast {
  const id = String((b as { _id: unknown })._id ?? '');
  const recipients: Recipient[] = (b.recipients ?? []).map((r) => ({
    jid: r.jid,
    status: recipientStatusToUi(r.status),
  }));
  // We don't get per-send history rows on the list endpoint yet, but the
  // aggregate counts let us synthesise a single "latest send" row when
  // anything has been sent.
  const lastSentRaw = b.completedAt ?? b.startedAt ?? null;
  const lastSentAt = lastSentRaw ? new Date(lastSentRaw as string | Date) : undefined;
  const history: HistoryEntry[] =
    b.sentCount > 0 || b.failedCount > 0
      ? [
          {
            id: `${id}:latest`,
            sentAt: lastSentAt ?? new Date(b.updatedAt as string | Date),
            totalCount: b.totalCount ?? recipients.length,
            sentCount: b.sentCount ?? 0,
            failedCount: b.failedCount ?? 0,
            body: b.payload?.body ?? (b.payload?.caption ?? ''),
          },
        ]
      : [];
  return {
    id,
    name: b.name,
    recipients,
    history,
    lastSentAt,
  };
}

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
        <Button size="sm" onClick={onNew} className="gap-1">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {broadcasts.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Users />}
              title="No broadcast lists yet"
              description="Create a list to fan out a single message to many contacts as 1:1 sends — recipients can't see each other."
              action={
                <Button size="md" onClick={onNew}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Compose first broadcast
                </Button>
              }
            />
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
  resolve: (jid: string | undefined) => string;
}

function BroadcastDetailPane({
  broadcast,
  onBack,
  onRename,
  onRemoveRecipients,
  onAddRecipient,
  onSend,
  resolve,
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onBack}
          aria-label="Back to list"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
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
        <Badge variant="secondary" className="shrink-0">
          {broadcast.recipients.length} recipients
        </Badge>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 md:p-4">
        {/* Recipients */}
        <Card>
          <ZoruCardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <ZoruCardTitle className="text-sm">Recipients</ZoruCardTitle>
              <ZoruCardDescription className="text-xs">
                Each recipient receives the message as a 1:1 chat.
              </ZoruCardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.size > 0 && (
                <Button
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
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add recipient
              </Button>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="px-0">
            {broadcast.recipients.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-zoru-ink-muted">
                No recipients yet. Add at least one to enable sending.
              </div>
            ) : (
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead className="w-10">
                      <Checkbox
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
                  {broadcast.recipients.map((r) => {
                    const resolvedName = r.displayName ?? resolve(r.jid);
                    return (
                      <ZoruTableRow key={r.jid}>
                        <ZoruTableCell>
                          <Checkbox
                            aria-label={`Select ${resolvedName}`}
                            checked={selected.has(r.jid)}
                            onCheckedChange={() => toggleOne(r.jid)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-medium text-zoru-ink">
                          {resolvedName}
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-xs text-zoru-ink-muted">
                          {formatJid(r.jid)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <button
                            type="button"
                            aria-label={`Remove ${resolvedName}`}
                            onClick={() =>
                              onRemoveRecipients(broadcast.id, [r.jid])
                            }
                            className="rounded-[var(--zoru-radius)] p-1 text-zoru-ink-muted hover:bg-zoru-danger/10 hover:text-zoru-danger"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })}
                </ZoruTableBody>
              </Table>
            )}
          </ZoruCardContent>
        </Card>

        {/* Composer */}
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-sm">Compose &amp; send</ZoruCardTitle>
            <ZoruCardDescription className="text-xs">
              Sent to all {broadcast.recipients.length} recipient
              {broadcast.recipients.length === 1 ? '' : 's'} as 1:1.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-3">
            <Textarea
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
              <Button
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
              </Button>
            </div>
          </ZoruCardContent>
        </Card>

        {/* History */}
        <Card>
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
              <Table>
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
              </Table>
            )}
          </ZoruCardContent>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add recipient</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter a phone number with country code, or a full JID.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-jid">Phone or JID</Label>
              <Input
                id="add-jid"
                value={newJid}
                onChange={(e) => setNewJid(e.target.value)}
                placeholder="e.g. 919876543210 or 919876543210@s.whatsapp.net"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-name">Display name (optional)</Label>
              <Input
                id="add-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Asha Khan"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddRecipient}
              disabled={!newJid.trim()}
            >
              Add
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function BroadcastsPage() {
  const toaster = useZoruToast();
  const { current: currentSession } = useSabwaSession();
  const sessionId = currentSession?.id;
  const resolve = useResolveJid(sessionId ?? '');

  const [broadcasts, setBroadcasts] = React.useState<Broadcast[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!sessionId) {
      setBroadcasts([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listBroadcasts(sessionId);
      if (!res.ok) {
        setLoadError(res.error ?? 'Failed to load broadcasts.');
        setBroadcasts([]);
        setSelectedId(null);
        return;
      }
      const mapped = (res.broadcasts ?? []).map((b) =>
        mapWireToBroadcast(b as unknown as BroadcastWire),
      );
      setBroadcasts(mapped);
      setSelectedId((prev) =>
        prev && mapped.some((b) => b.id === prev) ? prev : mapped[0]?.id ?? null,
      );
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load broadcasts.',
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const selected = React.useMemo(
    () => broadcasts.find((b) => b.id === selectedId) ?? null,
    [broadcasts, selectedId],
  );

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    if (!sessionId) {
      toaster.toast({
        title: 'Pick a session first',
        description: 'Connect or select a SabWa session to create broadcasts.',
        variant: 'destructive',
      });
      return;
    }
    setNewName('');
    setNewOpen(false);
    const res = await upsertBroadcast({ sessionId, name, recipients: [] });
    if (!res.ok) {
      toaster.toast({
        title: 'Could not create broadcast list',
        description: res.error ?? 'Engine returned an error.',
        variant: 'destructive',
      });
      return;
    }
    toaster.toast({ title: 'Broadcast list created', description: name });
    await reload();
    setSelectedId(res.broadcastId);
  };

  const handleDelete = async (id: string) => {
    // Optimistic remove — drop from local state before the engine round-trip.
    const snapshot = broadcasts;
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((curr) => (curr === id ? null : curr));
    const res = await deleteBroadcast(id);
    if (!res.ok) {
      // Revert and surface the error.
      setBroadcasts(snapshot);
      toaster.toast({
        title: 'Failed to delete broadcast',
        description: res.error ?? 'Engine returned an error.',
        variant: 'destructive',
      });
      return;
    }
    toaster.toast({ title: 'Broadcast deleted' });
  };

  const handleRename = async (id: string, name: string) => {
    if (!sessionId) return;
    const target = broadcasts.find((b) => b.id === id);
    if (!target) return;
    setBroadcasts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name } : b)),
    );
    const res = await upsertBroadcast({
      sessionId,
      id,
      name,
      recipients: target.recipients.map((r) => r.jid),
    });
    if (!res.ok) {
      toaster.toast({
        title: 'Rename failed',
        description: res.error ?? 'Engine returned an error.',
        variant: 'destructive',
      });
      await reload();
    }
  };

  const handleRemoveRecipients = async (id: string, jids: string[]) => {
    if (!sessionId) return;
    const target = broadcasts.find((b) => b.id === id);
    if (!target) return;
    const toDrop = new Set(jids);
    const nextRecipients = target.recipients.filter((r) => !toDrop.has(r.jid));
    setBroadcasts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, recipients: nextRecipients } : b)),
    );
    const res = await upsertBroadcast({
      sessionId,
      id,
      name: target.name,
      recipients: nextRecipients.map((r) => r.jid),
    });
    if (!res.ok) {
      toaster.toast({
        title: 'Could not update recipients',
        description: res.error ?? 'Engine returned an error.',
        variant: 'destructive',
      });
      await reload();
    }
  };

  const handleAddRecipient = async (id: string, recipient: Recipient) => {
    if (!sessionId) return;
    const target = broadcasts.find((b) => b.id === id);
    if (!target) return;
    if (target.recipients.some((r) => r.jid === recipient.jid)) return;
    const nextRecipients = [...target.recipients, recipient];
    setBroadcasts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, recipients: nextRecipients } : b)),
    );
    const res = await upsertBroadcast({
      sessionId,
      id,
      name: target.name,
      recipients: nextRecipients.map((r) => r.jid),
    });
    if (!res.ok) {
      toaster.toast({
        title: 'Could not add recipient',
        description: res.error ?? 'Engine returned an error.',
        variant: 'destructive',
      });
      await reload();
    }
  };

  const handleSend = async (
    id: string,
    body: string,
    media: SabFilePick | null,
  ) => {
    if (!sessionId) {
      toaster.toast({
        title: 'Pick a session first',
        variant: 'destructive',
      });
      return;
    }
    const target = broadcasts.find((b) => b.id === id);
    if (!target) return;

    const payload: SabwaScheduledPayload = media
      ? {
          // Best-effort message type — engine inspects the file MIME to refine.
          type: media.mime?.startsWith('image/')
            ? 'image'
            : media.mime?.startsWith('video/')
              ? 'video'
              : media.mime?.startsWith('audio/')
                ? 'audio'
                : 'document',
          mediaSabFileId: media.id,
          caption: body || undefined,
        }
      : { type: 'text', body };

    const res = await sendBroadcast(sessionId, id, payload);
    if (!res.ok) {
      toaster.toast({
        title: 'Send failed',
        description: res.error ?? 'Engine returned an error.',
        variant: 'destructive',
      });
      return;
    }
    toaster.toast({
      title: 'Broadcast queued',
      description: `${target.recipients.length} recipient${
        target.recipients.length === 1 ? '' : 's'
      }`,
    });
    // Refresh so updated counts / lastSentAt land in the UI.
    await reload();
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col bg-zoru-bg">
      {/* Breadcrumb + heading */}
      <div className="border-b border-zoru-line p-3 md:p-4">
        <Breadcrumb>
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
        </Breadcrumb>

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
          <Button onClick={() => setNewOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New broadcast list</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="border-b border-zoru-danger/30 bg-zoru-danger/5 px-3 py-2 text-xs text-zoru-danger md:px-4"
        >
          Couldn&apos;t load broadcasts: {loadError}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="grid h-full md:grid-cols-[320px_1fr] md:divide-x md:divide-zoru-line">
            <div className="space-y-2 p-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
            <div className="hidden space-y-3 p-4 md:block">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        ) : (
          <>
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
                  resolve={resolve}
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
                  resolve={resolve}
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
          </>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New broadcast list</ZoruDialogTitle>
            <ZoruDialogDescription>
              Give the list a recognisable name. You can add recipients after
              creating it.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="new-broadcast-name">Name</Label>
            <Input
              id="new-broadcast-name"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Premium customers"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate();
              }}
            />
          </div>
          <Separator />
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={!newName.trim() || !sessionId}
            >
              Create
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
