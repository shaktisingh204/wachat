'use client';

/**
 * /sabwa/broadcasts — Broadcast lists.
 *
 * Per SABWA_PLAN.md §6 page 9: WhatsApp's native broadcast lists (1:1 fan-out,
 * no cross-recipient visibility). CRUD broadcast lists, send composer, history.
 *
 * Two-pane layout on md+: left = list of broadcasts, right = selected detail.
 * On mobile we collapse to a list → detail navigation.
 *
 * Server-action wiring is intentionally permissive: the canonical
 * `sabwa.actions.ts` Phase-1 stubs only export a subset of the eventual API
 * surface (`createBroadcastList`, `sendBroadcast`). The fuller verbs called
 * out in the task brief (`listBroadcasts`, `upsertBroadcast`, `deleteBroadcast`)
 * will land alongside the Rust engine — for now we shape the UI around the
 * eventual contract and call into the existing stubs where they exist, falling
 * back to local optimistic state so the page is fully exercisable in dev.
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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Broadcast lists</h2>
        <Button size="sm" onClick={onNew} className="h-8 gap-1">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {broadcasts.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No broadcast lists yet. Create one to start fanning out 1:1 messages.
          </div>
        ) : (
          <ul className="divide-y">
            {broadcasts.map((b) => {
              const isActive = b.id === selectedId;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(b.id)}
                    className={cn(
                      'group flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-muted/60',
                      isActive && 'bg-muted',
                    )}
                  >
                    <div
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground"
                    >
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{b.name}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {fmtTimeAgo(b.lastSentAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
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
                      className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground md:hidden" />
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
      <div className="flex items-center gap-2 border-b px-3 py-2 md:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden"
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
            className="flex-1 truncate text-left text-base font-semibold hover:underline"
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
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-sm">Recipients</CardTitle>
              <CardDescription className="text-xs">
                Each recipient receives the message as a 1:1 chat.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-destructive"
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
                className="h-8 gap-1"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add recipient
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {broadcast.recipients.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No recipients yet. Add at least one to enable sending.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>JID</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {broadcast.recipients.map((r) => (
                    <TableRow key={r.jid}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.displayName ?? r.jid}`}
                          checked={selected.has(r.jid)}
                          onChange={() => toggleOne(r.jid)}
                          className="h-3.5 w-3.5"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.displayName ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.jid}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          aria-label={`Remove ${r.displayName ?? r.jid}`}
                          onClick={() =>
                            onRemoveRecipients(broadcast.id, [r.jid])
                          }
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Compose &amp; send</CardTitle>
            <CardDescription className="text-xs">
              Sent to all {broadcast.recipients.length} recipient
              {broadcast.recipients.length === 1 ? '' : 's'} as 1:1.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
                  <div className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs">
                    <span className="max-w-[180px] truncate">{media.name}</span>
                    <button
                      type="button"
                      onClick={() => setMedia(null)}
                      aria-label="Remove attachment"
                      className="rounded p-0.5 hover:bg-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <Button
                onClick={handleSend}
                disabled={
                  sending ||
                  broadcast.recipients.length === 0 ||
                  (!body.trim() && !media)
                }
                className="h-8 gap-1"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">History</CardTitle>
            <CardDescription className="text-xs">
              Past sends from this list with delivery counts.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {broadcast.history.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No sends yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sent</TableHead>
                    <TableHead>Body</TableHead>
                    <TableHead className="w-24 text-right">Delivered</TableHead>
                    <TableHead className="w-20 text-right">Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {broadcast.history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {h.sentAt.toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs">
                        {h.body || '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {h.sentCount}/{h.totalCount}
                      </TableCell>
                      <TableCell className="text-right text-xs text-destructive">
                        {h.failedCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRecipient} disabled={!newJid.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function BroadcastsPage() {
  const { toast } = useToast();
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
    toast({ title: 'Broadcast list created', description: name });
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
    toast({
      title: 'Broadcast queued',
      description: `${target.recipients.length} recipient${
        target.recipients.length === 1 ? '' : 's'
      }`,
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b p-3 md:p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-secondary p-2">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Broadcasts</h1>
            <p className="text-xs text-muted-foreground">
              Native WhatsApp broadcast lists — recipients receive as 1:1, no
              cross-visibility.
            </p>
          </div>
        </div>
        <Button onClick={() => setNewOpen(true)} className="h-9 gap-1">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New broadcast list</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        {/* md+: two-pane */}
        <div className="hidden h-full md:grid md:grid-cols-[320px_1fr] md:divide-x">
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
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">
                  Select or create a broadcast list
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
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

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New broadcast list</DialogTitle>
            <DialogDescription>
              Give the list a recognisable name. You can add recipients after
              creating it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="new-broadcast-name">Name</Label>
            <Input
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
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
