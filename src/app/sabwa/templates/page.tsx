'use client';

/**
 * SabWa — Templates (Page 15)
 *
 * Folder-organised grid of reusable message templates with rich body,
 * variables, and a media attachment via SabFiles. The editor opens in a
 * Dialog. Each card exposes a "Use template" menu for insert / broadcast
 * / schedule, and search filters across name + body.
 *
 * Source of truth: SABWA_PLAN.md § 6 — Page 15.
 */

import * as React from 'react';
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
  Trash2,
  CalendarClock,
  Paperclip,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  listTemplates,
  upsertTemplate,
  deleteTemplate,
} from '@/app/actions/sabwa.actions';
import type { SabwaTemplate } from '@/lib/sabwa/types';
import { cn } from '@/lib/utils';

// TODO (Phase 2): swap to live session via SessionSwitcher.
const PLACEHOLDER_SESSION = 'stub-primary';

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
    setLoading(true);
    const res = await listTemplates(PLACEHOLDER_SESSION);
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
  }, []);

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

  const onSaved = async () => {
    setEditorOpen(false);
    await refresh();
  };

  const addFolder = (name: string) => {
    const id = name.trim();
    if (!id || folders.some((f) => f.id === id)) return;
    setFolders((prev) => [...prev, { id, name: id }]);
    setActiveFolder(id);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-secondary p-3">
            <BookCopy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reusable message templates with variables and media. Pull them
              into any composer, scheduler, or broadcast.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> New template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        {/* Folder sidebar */}
        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Folders</CardTitle>
            <NewFolderButton onCreate={addFolder} />
          </CardHeader>
          <CardContent className="p-2">
            <ul className="flex flex-col gap-0.5">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setActiveFolder(f.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                      activeFolder === f.id && 'bg-muted font-medium',
                    )}
                  >
                    <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {f.id === 'all'
                        ? templates.length
                        : templates.filter((t) => t.folder === f.id).length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Right pane: search + grid */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates by name or body…"
              className="pl-9"
              aria-label="Search templates"
            />
          </div>

          {loading && filtered.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Loading templates…
              </CardContent>
            </Card>
          )}
          {!loading && filtered.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No templates yet. Click <strong>New template</strong> to start.
              </CardContent>
            </Card>
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
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="New folder">
          <FolderPlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
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
      </PopoverContent>
    </Popover>
  );
}

// ─── Template card ─────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: TemplateRow;
  onEdit: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const [actionsOpen, setActionsOpen] = React.useState(false);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {template.name}
            </CardTitle>
            {template.category && (
              <CardDescription>
                <Badge variant="outline" className="text-[10px]">
                  {template.category}
                </Badge>
              </CardDescription>
            )}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              <button
                type="button"
                onClick={onEdit}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-muted"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pb-3">
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
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
        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>Used {template.usageCount}×</span>
          <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                Use template
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="end">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => setActionsOpen(false)}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" /> Insert into chat
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => setActionsOpen(false)}
              >
                <Send className="h-3.5 w-3.5" /> Send to broadcast
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => setActionsOpen(false)}
              >
                <CalendarClock className="h-3.5 w-3.5" /> Schedule
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Editor dialog ─────────────────────────────────────────────────────────

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TemplateRow | null;
  folders: string[];
  onSaved: () => void;
}

function TemplateEditorDialog({
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
      sessionId: PLACEHOLDER_SESSION,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription>
            Compose a reusable message. Use{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {'{{variable}}'}
            </code>{' '}
            for dynamic fields.
          </DialogDescription>
        </DialogHeader>

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
              <SelectTrigger id="tpl-folder">
                <SelectValue placeholder="Uncategorised" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Uncategorised">Uncategorised</SelectItem>
                {folders
                  .filter((f) => f !== 'Uncategorised')
                  .map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
              </SelectContent>
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
          <span className="text-xs text-muted-foreground">Insert variable:</span>
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
            <span className="ml-auto text-xs text-muted-foreground">
              Variables: {detected.map((v) => `{{${v}}}`).join(', ')}
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSubmit()}
            disabled={saving || !name.trim() || !body.trim()}
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
