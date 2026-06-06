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
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Textarea,
  cn,
} from '@/components/sabcrm/20ui/compat';
import {
  BookCopy,
  Edit3,
  FolderPlus,
  Folder,
  MessageSquarePlus,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Smartphone,
  Trash2,
  CalendarClock,
  Paperclip,
  X,
  RefreshCw,
} from 'lucide-react';

/**
 * SabWa — Templates (Page 15)
 *
 * Folder-organised grid of reusable message templates with rich body,
 * variables, and a media attachment via SabFiles. The editor opens in a
 * Dialog. Each card exposes a "Use template" menu for insert / broadcast
 * / schedule, and search filters across name + body.
 *
 * Migrated to ZoruUI primitives. No behaviour changes — same server
 * actions, same prop shapes.
 *
 * Source of truth: SABWA_PLAN.md § 6 — Page 15.
 */

import * as React from 'react';
import Link from 'next/link';

import { SabFilePickerButton } from '@/components/sabfiles';
import {
  listTemplates,
  upsertTemplate,
  deleteTemplate,
  syncTemplates,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import type { SabwaTemplate, SabwaTemplateApprovalStatus } from '@/lib/sabwa/types';

const KNOWN_VARIABLES = [
  'firstName',
  'lastName',
  'phone',
  'company',
  'date',
  'time',
  'agent',
];

interface TemplateRow extends Omit<SabwaTemplate, '_id' | 'projectId' | 'sessionId'> {
  id: string;
  folder: string;
  approvalStatus?: SabwaTemplateApprovalStatus;
}

interface FolderRow {
  id: string;
  name: string;
}

function toTemplateRow(t: SabwaTemplate): TemplateRow {
  return {
    id: String(t._id),
    name: t.name,
    category: t.category,
    body: t.body,
    variables: t.variables ?? [],
    mediaSabFileId: t.mediaSabFileId,
    usageCount: t.usageCount ?? 0,
    approvalStatus: t.approvalStatus,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    folder: t.category ?? 'Uncategorised',
  };
}

function detectVariables(body: string): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.add(m[1]);
  return Array.from(out);
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Page() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? null;
  const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
  const [folders, setFolders] = React.useState<FolderRow[]>([
    { id: 'all', name: 'All templates' },
  ]);
  const [activeFolder, setActiveFolder] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorTemplate, setEditorTemplate] = React.useState<TemplateRow | null>(
    null,
  );

  const refresh = React.useCallback(async () => {
    if (!sessionId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listTemplates(sessionId);
    if (res.ok) {
      const rows = res.templates.map(toTemplateRow);
      setTemplates(rows);
      const cats = Array.from(
        new Set(rows.map((r) => r.folder).filter(Boolean)),
      ).map<FolderRow>((name) => ({ id: name, name }));
      setFolders([{ id: 'all', name: 'All templates' }, ...cats]);
    } else {
      setTemplates([]);
    }
    setLoading(false);
  }, [sessionId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (activeFolder !== 'all' && t.folder !== activeFolder) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [templates, activeFolder, search]);

  const openNew = () => {
    setEditorTemplate(null);
    setEditorOpen(true);
  };

  const openEdit = (t: TemplateRow) => {
    setEditorTemplate(t);
    setEditorOpen(true);
  };

  const onDelete = async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await deleteTemplate(id);
  };

  const [syncing, setSyncing] = React.useState(false);

  const onSaved = async () => {
    setEditorOpen(false);
    await refresh();
  };

  const onSync = async () => {
    if (!sessionId) return;
    setSyncing(true);
    await syncTemplates(sessionId);
    await refresh();
    setSyncing(false);
  };

  const addFolder = (name: string) => {
    const id = name.trim();
    if (!id || folders.some((f) => f.id === id)) return;
    setFolders((prev) => [...prev, { id, name: id }]);
    setActiveFolder(id);
  };

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10 space-y-6">
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
              <ZoruBreadcrumbPage>Templates</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
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
            <ZoruBreadcrumbPage>Templates</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
            <BookCopy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[24px] tracking-[-0.015em] text-[var(--st-text)] leading-[1.2]">
              Templates
            </h1>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)] max-w-2xl">
              Reusable message templates with variables and media. Pull them
              into any composer, scheduler, or broadcast.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSync} disabled={syncing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} /> 
            Sync API
          </Button>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> New template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        {/* Folder sidebar */}
        <Card className="h-fit">
          <ZoruCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <ZoruCardTitle className="text-sm">Folders</ZoruCardTitle>
            <NewFolderButton onCreate={addFolder} />
          </ZoruCardHeader>
          <ZoruCardContent className="p-2">
            <ul className="flex flex-col gap-0.5">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setActiveFolder(f.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-[var(--zoru-radius)] px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]',
                      activeFolder === f.id &&
                        'bg-[var(--st-bg-secondary)] font-medium',
                    )}
                  >
                    <Folder className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                    <span className="truncate">{f.name}</span>
                    <span className="ml-auto text-xs text-[var(--st-text-secondary)]">
                      {f.id === 'all'
                        ? templates.length
                        : templates.filter((t) => t.folder === f.id).length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ZoruCardContent>
        </Card>

        {/* Right pane: search + grid */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates by name or body…"
              className="pl-9"
              aria-label="Search templates"
            />
          </div>

          {loading && filtered.length === 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={`templates-skeleton-${i}`}
                  className="h-[180px] rounded-[var(--zoru-radius-lg)]"
                />
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <EmptyState
              icon={<MessageSquarePlus />}
              title={search ? "No templates match your search" : "No templates yet"}
              description={
                search
                  ? "Try a different keyword, or clear the search to see every template in this folder."
                  : "Save reusable message blocks with variables and media — then pull them into the composer, scheduler, or broadcasts in one click."
              }
              action={
                search ? (
                  <Button variant="outline" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button onClick={openNew}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    New template
                  </Button>
                )
              }
            />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => openEdit(t)}
                onDelete={() => onDelete(t.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <TemplateEditorDialog
        sessionId={sessionId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorTemplate}
        folders={folders.filter((f) => f.id !== 'all').map((f) => f.name)}
        onSaved={onSaved}
      />
    </div>
  );
}

// ─── Folder creator popover ────────────────────────────────────────────────

function NewFolderButton({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ZoruPopoverTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="New folder">
          <FolderPlus className="h-4 w-4" />
        </Button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent className="w-56" align="end">
        <div className="space-y-2">
          <Label htmlFor="folder-name" className="text-xs">
            Folder name
          </Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Onboarding"
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              if (name.trim()) {
                onCreate(name.trim());
                setName('');
                setOpen(false);
              }
            }}
          >
            Create
          </Button>
        </div>
      </ZoruPopoverContent>
    </Popover>
  );
}

// ─── Template card ─────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: TemplateRow;
  onEdit: () => void;
  onDelete: () => void;
}

const statusColorMap: Record<string, string> = {
  APPROVED: 'bg-[var(--st-text)]/10 text-[var(--st-text)] border-[var(--st-border)]',
  REJECTED: 'bg-[var(--st-text)]/10 text-[var(--st-text)] border-[var(--st-border)]',
  PENDING: 'bg-[var(--st-text)]/10 text-[var(--st-text)] border-[var(--st-border)]',
  PAUSED: 'bg-[var(--st-text)]/10 text-[var(--st-text)] border-[var(--st-border)]',
  UNMAPPED: 'bg-[var(--st-text)]/10 text-[var(--st-text)] border-[var(--st-border)]',
};

function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const [actionsOpen, setActionsOpen] = React.useState(false);
  return (
    <Card className="flex h-full flex-col">
      <ZoruCardHeader className="space-y-1 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <ZoruCardTitle className="truncate text-base">
              {template.name}
            </ZoruCardTitle>
            {(template.category || template.approvalStatus) && (
              <ZoruCardDescription className="flex items-center gap-1.5 flex-wrap mt-1">
                {template.category && (
                  <Badge variant="outline" className="text-[10px]">
                    {template.category}
                  </Badge>
                )}
                {template.approvalStatus && (
                  <Badge variant="outline" className={cn("text-[10px]", statusColorMap[template.approvalStatus])}>
                    {template.approvalStatus}
                  </Badge>
                )}
              </ZoruCardDescription>
            )}
          </div>
          <Popover>
            <ZoruPopoverTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </ZoruPopoverTrigger>
            <ZoruPopoverContent align="end" className="w-44 p-1">
              <button
                type="button"
                onClick={onEdit}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-[var(--st-danger)] hover:bg-[var(--st-bg-secondary)]"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </ZoruPopoverContent>
          </Popover>
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="flex flex-1 flex-col gap-3 pb-3">
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[var(--st-text-secondary)]">
          {template.body}
        </p>
        {template.variables.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.variables.map((v) => (
              <Badge key={v} variant="secondary" className="text-[10px]">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
          <span>Used {template.usageCount}×</span>
          <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
            <ZoruPopoverTrigger asChild>
              <Button size="sm" variant="outline">
                Use template
              </Button>
            </ZoruPopoverTrigger>
            <ZoruPopoverContent className="w-52 p-1" align="end">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
                onClick={() => setActionsOpen(false)}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" /> Insert into chat
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
                onClick={() => setActionsOpen(false)}
              >
                <Send className="h-3.5 w-3.5" /> Send to broadcast
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
                onClick={() => setActionsOpen(false)}
              >
                <CalendarClock className="h-3.5 w-3.5" /> Schedule
              </button>
            </ZoruPopoverContent>
          </Popover>
        </div>
      </ZoruCardContent>
    </Card>
  );
}

// ─── Editor dialog ─────────────────────────────────────────────────────────

interface TemplateEditorDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TemplateRow | null;
  folders: string[];
  onSaved: () => void;
}

function TemplateEditorDialog({
  sessionId,
  open,
  onOpenChange,
  initial,
  folders,
  onSaved,
}: TemplateEditorDialogProps) {
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<string>('Uncategorised');
  const [body, setBody] = React.useState('');
  const [mediaSabFileId, setMediaSabFileId] = React.useState<string | undefined>();
  const [mediaName, setMediaName] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setCategory(initial?.folder ?? 'Uncategorised');
    setBody(initial?.body ?? '');
    setMediaSabFileId(initial?.mediaSabFileId);
    setMediaName('');
  }, [open, initial]);

  const insertVar = (v: string) => {
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const detected = detectVariables(body);

  const onSubmit = async () => {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    await upsertTemplate({
      id: initial?.id,
      sessionId,
      name: name.trim(),
      category: category === 'Uncategorised' ? undefined : category,
      body,
      variables: detected,
      mediaSabFileId,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-2xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>{initial ? 'Edit template' : 'New template'}</ZoruDialogTitle>
          <ZoruDialogDescription>
            Compose a reusable message. Use{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 text-xs text-[var(--st-text)]">
              {'{{variable}}'}
            </code>{' '}
            for dynamic fields.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Welcome back"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-folder">Folder</Label>
            <Select value={category} onValueChange={setCategory}>
              <ZoruSelectTrigger id="tpl-folder">
                <ZoruSelectValue placeholder="Uncategorised" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="Uncategorised">Uncategorised</ZoruSelectItem>
                {folders
                  .filter((f) => f !== 'Uncategorised')
                  .map((f) => (
                    <ZoruSelectItem key={f} value={f}>
                      {f}
                    </ZoruSelectItem>
                  ))}
              </ZoruSelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-body">Body</Label>
          <Textarea
            id="tpl-body"
            ref={bodyRef}
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Hi {{firstName}},\n\nThanks for reaching out!`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--st-text-secondary)]">Insert variable:</span>
          {KNOWN_VARIABLES.map((v) => (
            <Button
              key={v}
              size="sm"
              variant="outline"
              type="button"
              onClick={() => insertVar(v)}
              className="h-7 text-[11px]"
            >
              {`{{${v}}}`}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SabFilePickerButton
            accept="all"
            title="Attach media"
            onPick={({ id, name: fname }) => {
              setMediaSabFileId(id);
              setMediaName(fname);
            }}
          >
            <Paperclip className="mr-1.5 h-3.5 w-3.5" />
            {mediaSabFileId ? 'Replace media' : 'Attach media'}
          </SabFilePickerButton>
          {mediaSabFileId && (
            <Badge variant="secondary" className="gap-1">
              {mediaName || mediaSabFileId}
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
          {detected.length > 0 && (
            <span className="ml-auto text-xs text-[var(--st-text-secondary)]">
              Variables: {detected.map((v) => `{{${v}}}`).join(', ')}
            </span>
          )}
        </div>

        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSubmit()}
            disabled={saving || !name.trim() || !body.trim()}
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create template'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
