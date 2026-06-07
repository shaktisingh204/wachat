'use client';

import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Separator,
  Skeleton,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Textarea,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  ArrowLeft,
  ChevronRight,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';

/**
 * /sabwa/broadcasts - Broadcast lists (20ui).
 *
 * Per SABWA_PLAN.md section 6 page 9: WhatsApp's native broadcast lists (1:1
 * fan-out, no cross-recipient visibility). CRUD broadcast lists, send composer,
 * history.
 *
 * Two-pane layout on md+: left = list of broadcasts, right = selected detail.
 * On mobile we collapse to a list, then detail navigation.
 *
 * Pure 20ui: design-system pieces come only from `@/components/sabcrm/20ui`,
 * file picking from `@/components/sabfiles`. Server-action surface, prop shapes
 * and data flow are unchanged.
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

// --- Local model ------------------------------------------------------------
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

// --- Wire mapping -----------------------------------------------------------
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
  // map SabwaMessageStatus to UI status
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
  if (!d) return '-';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

// --- List pane --------------------------------------------------------------

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
      <div className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-3 py-2">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">Broadcast lists</h2>
        <Button size="sm" variant="primary" iconLeft={Plus} onClick={onNew}>
          New
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {broadcasts.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No broadcast lists yet"
              description="Create a list to fan out a single message to many contacts as 1:1 sends. Recipients can't see each other."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={onNew}>
                  Compose first broadcast
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {broadcasts.map((b) => {
              const isActive = b.id === selectedId;
              return (
                <li key={b.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(b.id);
                      }
                    }}
                    className={cn(
                      'group flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left outline-none transition hover:bg-[var(--st-bg-secondary)] focus-visible:bg-[var(--st-bg-secondary)]',
                      isActive && 'bg-[var(--st-bg-secondary)]',
                    )}
                  >
                    <div
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                    >
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-[var(--st-text)]">
                          {b.name}
                        </p>
                        <span className="shrink-0 text-[11px] text-[var(--st-text-secondary)]">
                          {fmtTimeAgo(b.lastSentAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-[var(--st-text-secondary)]">
                        {b.recipients.length} recipient
                        {b.recipients.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      <IconButton
                        label={`Delete ${b.name}`}
                        icon={Trash2}
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(b.id);
                        }}
                      />
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)] md:hidden"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- Detail pane ------------------------------------------------------------

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
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] px-3 py-2 md:px-4">
        <span className="md:hidden">
          <IconButton
            label="Back to list"
            icon={ArrowLeft}
            variant="ghost"
            size="sm"
            onClick={onBack}
          />
        </span>
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              autoFocus
              inputSize="sm"
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
            />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingName(true)}
            className="min-w-0 flex-1 justify-start truncate text-left text-base font-semibold text-[var(--st-text)] hover:underline"
            title="Click to rename"
          >
            {broadcast.name}
          </Button>
        )}
        <Badge tone="neutral" className="shrink-0">
          {broadcast.recipients.length} recipients
        </Badge>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 md:p-4">
        {/* Recipients */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>
                Each recipient receives the message as a 1:1 chat.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={Trash2}
                  className="text-[var(--st-danger)]"
                  onClick={() => {
                    onRemoveRecipients(broadcast.id, Array.from(selected));
                    setSelected(new Set());
                  }}
                >
                  Remove ({selected.size})
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                iconLeft={Plus}
                onClick={() => setAddOpen(true)}
              >
                Add recipient
              </Button>
            </div>
          </CardHeader>
          <CardBody className="px-0">
            {broadcast.recipients.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
                No recipients yet. Add at least one to enable sending.
              </div>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th width={40}>
                      <Checkbox
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={toggleAll}
                      />
                    </Th>
                    <Th>Name</Th>
                    <Th>JID</Th>
                    <Th width={40} />
                  </Tr>
                </THead>
                <TBody>
                  {broadcast.recipients.map((r) => {
                    const resolvedName = r.displayName ?? resolve(r.jid);
                    return (
                      <Tr key={r.jid}>
                        <Td>
                          <Checkbox
                            aria-label={`Select ${resolvedName}`}
                            checked={selected.has(r.jid)}
                            onChange={() => toggleOne(r.jid)}
                          />
                        </Td>
                        <Td className="font-medium text-[var(--st-text)]">
                          {resolvedName}
                        </Td>
                        <Td className="font-mono text-xs text-[var(--st-text-secondary)]">
                          {formatJid(r.jid)}
                        </Td>
                        <Td>
                          <IconButton
                            label={`Remove ${resolvedName}`}
                            icon={X}
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              onRemoveRecipients(broadcast.id, [r.jid])
                            }
                          />
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        {/* Composer */}
        <Card>
          <CardHeader>
            <CardTitle>Compose and send</CardTitle>
            <CardDescription>
              Sent to all {broadcast.recipients.length} recipient
              {broadcast.recipients.length === 1 ? '' : 's'} as 1:1.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="Message">
              <Textarea
                placeholder="Type your message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
            </Field>
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
                  <div className="flex items-center gap-1 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-2 py-1 text-xs text-[var(--st-text)]">
                    <span className="max-w-[180px] truncate">{media.name}</span>
                    <IconButton
                      label="Remove attachment"
                      icon={X}
                      variant="ghost"
                      size="sm"
                      onClick={() => setMedia(null)}
                    />
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="primary"
                iconLeft={sending ? undefined : Send}
                loading={sending}
                onClick={handleSend}
                disabled={
                  sending ||
                  broadcast.recipients.length === 0 ||
                  (!body.trim() && !media)
                }
              >
                Send
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>
              Past sends from this list with delivery counts.
            </CardDescription>
          </CardHeader>
          <CardBody className="px-0">
            {broadcast.history.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
                No sends yet.
              </div>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Sent</Th>
                    <Th>Body</Th>
                    <Th align="right" width={96}>
                      Delivered
                    </Th>
                    <Th align="right" width={80}>
                      Failed
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {broadcast.history.map((h) => (
                    <Tr key={h.id}>
                      <Td className="whitespace-nowrap text-xs text-[var(--st-text-secondary)]">
                        {h.sentAt.toLocaleString()}
                      </Td>
                      <Td truncate className="max-w-[280px] text-xs">
                        {h.body || '-'}
                      </Td>
                      <Td align="right" className="text-xs">
                        {h.sentCount}/{h.totalCount}
                      </Td>
                      <Td align="right" className="text-xs text-[var(--st-danger)]">
                        {h.failedCount}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add recipient</DialogTitle>
            <DialogDescription>
              Enter a phone number with country code, or a full JID.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Phone or JID">
              <Input
                value={newJid}
                onChange={(e) => setNewJid(e.target.value)}
                placeholder="e.g. 919876543210 or 919876543210@s.whatsapp.net"
              />
            </Field>
            <Field label="Display name (optional)">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Asha Khan"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddRecipient}
              disabled={!newJid.trim()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Page -------------------------------------------------------------------

export default function BroadcastsPage() {
  const { toast } = useToast();
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
      toast({
        title: 'Pick a session first',
        description: 'Connect or select a SabWa session to create broadcasts.',
        tone: 'danger',
      });
      return;
    }
    setNewName('');
    setNewOpen(false);
    const res = await upsertBroadcast({ sessionId, name, recipients: [] });
    if (!res.ok) {
      toast({
        title: 'Could not create broadcast list',
        description: res.error ?? 'Engine returned an error.',
        tone: 'danger',
      });
      return;
    }
    toast({ title: 'Broadcast list created', description: name, tone: 'success' });
    await reload();
    setSelectedId(res.broadcastId);
  };

  const handleDelete = async (id: string) => {
    // Optimistic remove. Drop from local state before the engine round-trip.
    const snapshot = broadcasts;
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((curr) => (curr === id ? null : curr));
    const res = await deleteBroadcast(id);
    if (!res.ok) {
      // Revert and surface the error.
      setBroadcasts(snapshot);
      toast({
        title: 'Failed to delete broadcast',
        description: res.error ?? 'Engine returned an error.',
        tone: 'danger',
      });
      return;
    }
    toast({ title: 'Broadcast deleted', tone: 'success' });
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
      toast({
        title: 'Rename failed',
        description: res.error ?? 'Engine returned an error.',
        tone: 'danger',
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
      toast({
        title: 'Could not update recipients',
        description: res.error ?? 'Engine returned an error.',
        tone: 'danger',
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
      toast({
        title: 'Could not add recipient',
        description: res.error ?? 'Engine returned an error.',
        tone: 'danger',
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
      toast({
        title: 'Pick a session first',
        tone: 'danger',
      });
      return;
    }
    const target = broadcasts.find((b) => b.id === id);
    if (!target) return;

    const payload: SabwaScheduledPayload = media
      ? {
          // Best-effort message type. The engine inspects the file MIME to refine.
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
      toast({
        title: 'Send failed',
        description: res.error ?? 'Engine returned an error.',
        tone: 'danger',
      });
      return;
    }
    toast({
      title: 'Broadcast queued',
      description: `${target.recipients.length} recipient${
        target.recipients.length === 1 ? '' : 's'
      }`,
      tone: 'success',
    });
    // Refresh so updated counts / lastSentAt land in the UI.
    await reload();
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col bg-[var(--st-bg)]">
      {/* Breadcrumb + heading */}
      <div className="p-3 md:p-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Broadcasts</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader className="mt-3">
          <PageHeaderHeading>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
                <Send aria-hidden="true" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <PageTitle>Broadcasts</PageTitle>
                <PageDescription>
                  Native WhatsApp broadcast lists. Recipients receive as 1:1, no
                  cross-visibility.
                </PageDescription>
              </div>
            </div>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="primary" iconLeft={Plus} onClick={() => setNewOpen(true)}>
              <span className="hidden sm:inline">New broadcast list</span>
              <span className="sm:hidden">New</span>
            </Button>
          </PageActions>
        </PageHeader>
      </div>

      {loadError && (
        <div
          role="alert"
          className="border-b border-[var(--st-danger)]/30 bg-[var(--st-danger)]/5 px-3 py-2 text-xs text-[var(--st-danger)] md:px-4"
        >
          Couldn&apos;t load broadcasts: {loadError}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="grid h-full md:grid-cols-[320px_1fr] md:divide-x md:divide-[var(--st-border)]">
            <div className="space-y-2 p-3">
              <Skeleton height={32} width="100%" />
              <Skeleton height={56} width="100%" />
              <Skeleton height={56} width="100%" />
              <Skeleton height={56} width="100%" />
            </div>
            <div className="hidden flex-col items-center justify-center gap-2 p-4 md:flex">
              <Spinner size="lg" label="Loading broadcasts" />
              <p className="text-xs text-[var(--st-text-secondary)]">
                Loading broadcasts...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* md+: two-pane */}
            <div className="hidden h-full md:grid md:grid-cols-[320px_1fr] md:divide-x md:divide-[var(--st-border)]">
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
                  <EmptyState
                    icon={Users}
                    title="Select or create a broadcast list"
                    description="Broadcast lists let you fan out a message to many contacts, while keeping each thread 1:1."
                  />
                </div>
              )}
            </div>
            {/* Mobile: list and detail navigation */}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New broadcast list</DialogTitle>
            <DialogDescription>
              Give the list a recognisable name. You can add recipients after
              creating it.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Premium customers"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate();
              }}
            />
          </Field>
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleCreate()}
              disabled={!newName.trim() || !sessionId}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
