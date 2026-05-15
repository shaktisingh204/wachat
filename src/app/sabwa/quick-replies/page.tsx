'use client';

/**
 * SabWa — Quick Replies (Page 16)
 *
 * Table of slash-command shortcuts (e.g. /thanks → "Thanks for reaching
 * out!"). Each row exposes a usage count, last-used timestamp, and an
 * enable toggle. A "New quick reply" Dialog has a live preview showing
 * what gets sent when the user types the shortcut, plus optional media.
 *
 * Source of truth: SABWA_PLAN.md § 6 — Page 16.
 */

import * as React from 'react';
import {
  Edit3,
  MessageSquareReply,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
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
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  listQuickReplies,
  upsertQuickReply,
  deleteQuickReply,
} from '@/app/actions/sabwa.actions';
import type { SabwaQuickReply } from '@/lib/sabwa/types';

// TODO (Phase 2): replace placeholder with active session id from SessionSwitcher.
const PLACEHOLDER_SESSION = 'stub-primary';

interface QuickReplyRow
  extends Omit<SabwaQuickReply, '_id' | 'projectId' | 'sessionId'> {
  id: string;
  enabled: boolean;
  usageCount: number;
  lastUsedAt?: Date;
}

function toRow(q: SabwaQuickReply): QuickReplyRow {
  const extra = q as SabwaQuickReply & {
    enabled?: boolean;
    usageCount?: number;
    lastUsedAt?: Date;
  };
  return {
    id: String(q._id),
    shortcut: q.shortcut,
    body: q.body,
    mediaSabFileId: q.mediaSabFileId,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    enabled: extra.enabled ?? true,
    usageCount: extra.usageCount ?? 0,
    lastUsedAt: extra.lastUsedAt,
  };
}

function formatRelative(ts?: Date | string): string {
  if (!ts) return 'Never';
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return 'Never';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86_400 * 7) return `${Math.floor(diff / 86_400)}d ago`;
  return d.toLocaleDateString();
}

function normalizeShortcut(value: string): string {
  let v = value.trim();
  if (!v) return '';
  if (!v.startsWith('/')) v = `/${v}`;
  return v.replace(/\s+/g, '-').toLowerCase();
}

export default function Page() {
  const [rows, setRows] = React.useState<QuickReplyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<QuickReplyRow | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const res = await listQuickReplies(PLACEHOLDER_SESSION);
    setRows(res.ok ? res.quickReplies.map(toRow) : []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.shortcut.toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (r: QuickReplyRow) => {
    setEditing(r);
    setEditorOpen(true);
  };

  const onDelete = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await deleteQuickReply(id);
  };

  const onToggleEnabled = async (r: QuickReplyRow, enabled: boolean) => {
    setRows((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, enabled } : x)),
    );
    await upsertQuickReply({
      id: r.id,
      sessionId: PLACEHOLDER_SESSION,
      shortcut: r.shortcut,
      body: r.body,
      mediaSabFileId: r.mediaSabFileId,
      enabled,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-secondary p-3">
            <MessageSquareReply className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Quick replies
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Slash-command shortcuts that expand into saved blurbs inside the
              chat composer.
            </p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New quick reply
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shortcuts or body…"
              className="pl-9"
              aria-label="Search quick replies"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">On</TableHead>
                <TableHead>Shortcut</TableHead>
                <TableHead>Body preview</TableHead>
                <TableHead className="w-24">Usage</TableHead>
                <TableHead className="w-32">Last used</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Loading quick replies…
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No quick replies yet — start with <code>/thanks</code> or{' '}
                    <code>/eta</code>.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(v) => void onToggleEnabled(r, v)}
                      aria-label={`Toggle ${r.shortcut}`}
                    />
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                      {r.shortcut}
                    </code>
                    {r.mediaSabFileId && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Media
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="line-clamp-1 text-sm text-muted-foreground">
                      {r.body || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{r.usageCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelative(r.lastUsedAt)}
                  </TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Actions for ${r.shortcut}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-40 p-1">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(r.id)}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <QuickReplyDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editing}
        existingShortcuts={rows.map((r) => r.shortcut)}
        onSaved={async () => {
          setEditorOpen(false);
          await refresh();
        }}
      />
    </div>
  );
}

// ─── Editor dialog ─────────────────────────────────────────────────────────

interface QuickReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: QuickReplyRow | null;
  existingShortcuts: string[];
  onSaved: () => void;
}

function QuickReplyDialog({
  open,
  onOpenChange,
  initial,
  existingShortcuts,
  onSaved,
}: QuickReplyDialogProps) {
  const [shortcut, setShortcut] = React.useState('');
  const [body, setBody] = React.useState('');
  const [mediaSabFileId, setMediaSabFileId] = React.useState<string | undefined>();
  const [mediaName, setMediaName] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setShortcut(initial?.shortcut ?? '');
    setBody(initial?.body ?? '');
    setMediaSabFileId(initial?.mediaSabFileId);
    setMediaName('');
  }, [open, initial]);

  const normalized = normalizeShortcut(shortcut);
  const dupShortcut =
    !!normalized &&
    normalized !== initial?.shortcut &&
    existingShortcuts.includes(normalized);
  const valid =
    !!normalized && normalized.startsWith('/') && !!body.trim() && !dupShortcut;

  const onSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    await upsertQuickReply({
      id: initial?.id,
      sessionId: PLACEHOLDER_SESSION,
      shortcut: normalized,
      body,
      mediaSabFileId,
      enabled: initial?.enabled ?? true,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? 'Edit quick reply' : 'New quick reply'}
          </DialogTitle>
          <DialogDescription>
            Type the shortcut in any chat composer to expand it into the body
            below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="qr-shortcut">Shortcut</Label>
            <Input
              id="qr-shortcut"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="/thanks"
              aria-invalid={dupShortcut || undefined}
            />
            {!shortcut.startsWith('/') && shortcut && (
              <p className="text-[11px] text-muted-foreground">
                Will be saved as <code>{normalized}</code>.
              </p>
            )}
            {dupShortcut && (
              <p className="text-[11px] text-destructive">
                Another quick reply already uses this shortcut.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Attached media</Label>
            <div className="flex items-center gap-2">
              <SabFilePickerButton
                accept="all"
                title="Attach media"
                onPick={({ id, name }) => {
                  setMediaSabFileId(id);
                  setMediaName(name);
                }}
              >
                <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                {mediaSabFileId ? 'Replace' : 'Attach'}
              </SabFilePickerButton>
              {mediaSabFileId && (
                <Badge variant="secondary" className="gap-1">
                  {mediaName || 'Media attached'}
                  <button
                    type="button"
                    aria-label="Remove media"
                    onClick={() => {
                      setMediaSabFileId(undefined);
                      setMediaName('');
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qr-body">Body</Label>
          <Textarea
            id="qr-body"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Thanks for reaching out! We'll be back to you within a few hours."
          />
        </div>

        {/* Live preview */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Live preview
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            When user types{' '}
            <code className="rounded bg-background px-1 py-0.5 text-xs">
              {normalized || '/shortcut'}
            </code>{' '}
            the chat composer expands to:
          </p>
          <div className="mt-2 max-w-md rounded-lg bg-green-100 px-3 py-2 text-sm shadow-sm dark:bg-green-900/40">
            <p className="whitespace-pre-wrap">
              {body || (
                <span className="italic text-muted-foreground">
                  (empty body)
                </span>
              )}
            </p>
            {mediaSabFileId && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                + media: {mediaName || mediaSabFileId}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={!valid || saving}>
            {saving
              ? 'Saving…'
              : initial
                ? 'Save changes'
                : 'Create quick reply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
