'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardHeader, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, Label, Popover, PopoverContent, PopoverTrigger, Skeleton, Switch, Table, TBody, Td, Th, THead, Tr, Textarea } from '@/components/sabcrm/20ui/compat';
import {
  Edit3,
  MessageSquareReply,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Smartphone,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * SabWa — Quick Replies (Page 16)
 *
 * Table of slash-command shortcuts (e.g. /thanks → "Thanks for reaching
 * out!"). Each row exposes a usage count, last-used timestamp, and an
 * enable toggle. A "New quick reply" Dialog has a live preview showing
 * what gets sent when the user types the shortcut, plus optional media.
 *
 * Migrated to ZoruUI primitives. No behaviour changes — same server
 * actions, same prop shapes.
 *
 * Source of truth: SABWA_PLAN.md § 6 — Page 16.
 */

import * as React from 'react';
import Link from 'next/link';

import { SabFilePickerButton } from '@/components/sabfiles';
import {
  listQuickReplies,
  upsertQuickReply,
  deleteQuickReply,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import type { SabwaQuickReply } from '@/lib/sabwa/types';

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
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? null;
  const [rows, setRows] = React.useState<QuickReplyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<QuickReplyRow | null>(null);

  const refresh = React.useCallback(async () => {
    if (!sessionId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listQuickReplies(sessionId);
    setRows(res.ok ? res.quickReplies.map(toRow) : []);
    setLoading(false);
  }, [sessionId]);

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
    if (!sessionId) return;
    setRows((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, enabled } : x)),
    );
    await upsertQuickReply({
      id: r.id,
      sessionId,
      shortcut: r.shortcut,
      body: r.body,
      mediaSabFileId: r.mediaSabFileId,
      enabled,
    });
  };

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10 space-y-6">
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
              <BreadcrumbPage>Quick replies</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <EmptyState
          icon={<Smartphone />}
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
            <BreadcrumbPage>Quick replies</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
            <MessageSquareReply className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[24px] tracking-[-0.015em] text-[var(--st-text)] leading-[1.2]">
              Quick replies
            </h1>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)] max-w-2xl">
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shortcuts or body…"
              className="pl-9"
              aria-label="Search quick replies"
            />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th className="w-20">On</Th>
                <Th>Shortcut</Th>
                <Th>Body preview</Th>
                <Th className="w-24">Usage</Th>
                <Th className="w-32">Last used</Th>
                <Th className="w-12" />
              </Tr>
            </THead>
            <TBody>
              {loading && filtered.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <Tr key={`qr-skeleton-${i}`}>
                    <Td colSpan={6} className="py-2">
                      <Skeleton className="h-[56px] w-full rounded-[var(--st-radius-lg)]" />
                    </Td>
                  </Tr>
                ))}
              {!loading && filtered.length === 0 && (
                <Tr>
                  <Td colSpan={6} className="py-8">
                    <EmptyState
                      icon={<MessageSquareReply />}
                      title={
                        search
                          ? 'No quick replies match your search'
                          : 'No quick replies yet'
                      }
                      description={
                        search
                          ? 'Try a different shortcut or body keyword, or clear the search.'
                          : 'Save short blurbs as slash-commands like /thanks or /eta — type the shortcut in any composer to expand it instantly.'
                      }
                      action={
                        search ? (
                          <Button
                            variant="outline"
                            onClick={() => setSearch('')}
                          >
                            Clear search
                          </Button>
                        ) : (
                          <Button onClick={openNew}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            New quick reply
                          </Button>
                        )
                      }
                    />
                  </Td>
                </Tr>
              )}
              {filtered.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(v) => void onToggleEnabled(r, v)}
                      aria-label={`Toggle ${r.shortcut}`}
                    />
                  </Td>
                  <Td>
                    <code className="rounded bg-[var(--st-bg-secondary)] px-1.5 py-0.5 text-xs font-medium text-[var(--st-text)]">
                      {r.shortcut}
                    </code>
                    {r.mediaSabFileId && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Media
                      </Badge>
                    )}
                  </Td>
                  <Td className="max-w-md">
                    <span className="line-clamp-1 text-sm text-[var(--st-text-secondary)]">
                      {r.body || '—'}
                    </span>
                  </Td>
                  <Td className="text-sm">{r.usageCount}</Td>
                  <Td className="text-sm text-[var(--st-text-secondary)]">
                    {formatRelative(r.lastUsedAt)}
                  </Td>
                  <Td>
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
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(r.id)}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-[var(--st-danger)] hover:bg-[var(--st-bg-secondary)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </PopoverContent>
                    </Popover>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      <QuickReplyDialog
        sessionId={sessionId}
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
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: QuickReplyRow | null;
  existingShortcuts: string[];
  onSaved: () => void;
}

function QuickReplyDialog({
  sessionId,
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
      sessionId,
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
              <p className="text-[11px] text-[var(--st-text-secondary)]">
                Will be saved as <code>{normalized}</code>.
              </p>
            )}
            {dupShortcut && (
              <p className="text-[11px] text-[var(--st-danger)]">
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
          <div className="flex justify-between items-center">
            <Label htmlFor="qr-body">Body</Label>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--st-text-secondary)]">
              <span>Variables:</span>
              <button type="button" onClick={() => setBody(b => b + '{{first_name}} ')} className="hover:text-[var(--st-text)] hover:underline decoration-dotted transition-colors">{'{{first_name}}'}</button>
              <button type="button" onClick={() => setBody(b => b + '{{last_name}} ')} className="hover:text-[var(--st-text)] hover:underline decoration-dotted transition-colors">{'{{last_name}}'}</button>
              <button type="button" onClick={() => setBody(b => b + '{{name}} ')} className="hover:text-[var(--st-text)] hover:underline decoration-dotted transition-colors">{'{{name}}'}</button>
              <button type="button" onClick={() => setBody(b => b + '{{phone}} ')} className="hover:text-[var(--st-text)] hover:underline decoration-dotted transition-colors">{'{{phone}}'}</button>
            </div>
          </div>
          <Textarea
            id="qr-body"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi {{first_name}}, thanks for reaching out! We'll be back to you within a few hours."
          />
        </div>

        {/* Live preview */}
        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Live preview
          </p>
          <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
            When user types{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 text-xs text-[var(--st-text)]">
              {normalized || '/shortcut'}
            </code>{' '}
            the chat composer expands to:
          </p>
          <div className="mt-2 max-w-md rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm text-[var(--st-text)] shadow-[var(--st-shadow-sm)]">
            <p className="whitespace-pre-wrap">
              {body ? (
                body
                  .replace(/\{\{\s*name\s*\}\}/gi, 'Jane Doe')
                  .replace(/\{\{\s*first_name\s*\}\}/gi, 'Jane')
                  .replace(/\{\{\s*last_name\s*\}\}/gi, 'Doe')
                  .replace(/\{\{\s*phone\s*\}\}/gi, '+1 234 567 8900')
                  .replace(/\{\{\s*company\s*\}\}/gi, 'Acme Corp')
              ) : (
                <span className="italic text-[var(--st-text-secondary)]">
                  (empty body)
                </span>
              )}
            </p>
            {mediaSabFileId && (
              <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
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
