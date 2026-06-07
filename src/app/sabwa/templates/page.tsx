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
  Menu,
  MenuItem,
  MenuSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tag,
  Textarea,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
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
  RefreshCw,
} from 'lucide-react';

/**
 * SabWa, Templates (Page 15)
 *
 * Folder-organised grid of reusable message templates with rich body,
 * variables, and a media attachment via SabFiles. The editor opens in a
 * Dialog. Each card exposes a "Use template" menu for insert / broadcast
 * / schedule, and search filters across name + body.
 *
 * Built on pure 20ui primitives. No behaviour changes. Same server
 * actions, same prop shapes.
 *
 * Source of truth: SABWA_PLAN.md section 6, Page 15.
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

/* Page */

export default function Page() {
  const { current: activeSession } = useSabwaSession();
  const { toast } = useToast();
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
    toast.success('Template deleted');
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
    toast.success('Templates synced');
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
              <BreadcrumbPage>Templates</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <EmptyState
          icon={Smartphone}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button>Open accounts</Button>
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
            <BreadcrumbPage>Templates</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
            aria-hidden="true"
          >
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
            <RefreshCw
              className={cn('mr-2 h-4 w-4', syncing && 'animate-spin')}
              aria-hidden="true"
            />
            Sync API
          </Button>
          <Button variant="primary" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> New template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        {/* Folder sidebar */}
        <Card className="h-fit" padding="none">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">Folders</CardTitle>
            <NewFolderButton onCreate={addFolder} />
          </CardHeader>
          <CardBody className="p-2">
            <ul className="flex flex-col gap-0.5">
              {folders.map((f) => (
                <li key={f.id}>
                  <Button
                    variant="ghost"
                    block
                    onClick={() => setActiveFolder(f.id)}
                    className={cn(
                      'justify-start',
                      activeFolder === f.id && 'bg-[var(--st-bg-secondary)] font-medium',
                    )}
                  >
                    <Folder
                      className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                      aria-hidden="true"
                    />
                    <span className="truncate">{f.name}</span>
                    <span className="ml-auto text-xs text-[var(--st-text-secondary)]">
                      {f.id === 'all'
                        ? templates.length
                        : templates.filter((t) => t.folder === f.id).length}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {/* Right pane: search + grid */}
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name or body..."
            iconLeft={Search}
            aria-label="Search templates"
          />

          {loading && filtered.length === 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={`templates-skeleton-${i}`}
                  height={180}
                  radius="var(--st-radius-lg)"
                />
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <EmptyState
              icon={MessageSquarePlus}
              title={search ? 'No templates match your search' : 'No templates yet'}
              description={
                search
                  ? 'Try a different keyword, or clear the search to see every template in this folder.'
                  : 'Save reusable message blocks with variables and media, then pull them into the composer, scheduler, or broadcasts in one click.'
              }
              action={
                search ? (
                  <Button variant="outline" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                ) : (
                  <Button variant="primary" onClick={openNew}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
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

/* Folder creator popover */

function NewFolderButton({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton label="New folder" icon={FolderPlus} variant="ghost" size="sm" />
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="space-y-2">
          <Field label="Folder name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Onboarding"
              inputSize="sm"
            />
          </Field>
          <Button
            variant="primary"
            size="sm"
            block
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

/* Template card */

interface TemplateCardProps {
  template: TemplateRow;
  onEdit: () => void;
  onDelete: () => void;
}

const APPROVAL_TONE: Record<string, React.ComponentProps<typeof Badge>['tone']> = {
  APPROVED: 'success',
  REJECTED: 'danger',
  PENDING: 'warning',
  PAUSED: 'neutral',
  UNMAPPED: 'neutral',
};

function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const approvalTone =
    (template.approvalStatus && APPROVAL_TONE[template.approvalStatus]) ?? 'neutral';
  return (
    <Card variant="outlined" className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{template.name}</CardTitle>
            {(template.category || template.approvalStatus) && (
              <CardDescription className="flex items-center gap-1.5 flex-wrap mt-1">
                {template.category && (
                  <Badge tone="neutral" kind="outline" className="text-[10px]">
                    {template.category}
                  </Badge>
                )}
                {template.approvalStatus && (
                  <Badge tone={approvalTone} className="text-[10px]">
                    {template.approvalStatus}
                  </Badge>
                )}
              </CardDescription>
            )}
          </div>
          <Menu
            label="Template actions"
            align="end"
            trigger={
              <IconButton label="More actions" icon={MoreHorizontal} variant="ghost" size="sm" />
            }
          >
            <MenuItem icon={Edit3} onSelect={onEdit}>
              Edit
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={Trash2} danger onSelect={onDelete}>
              Delete
            </MenuItem>
          </Menu>
        </div>
      </CardHeader>
      <CardBody className="flex flex-1 flex-col gap-3 pb-3">
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[var(--st-text-secondary)]">
          {template.body}
        </p>
        {template.variables.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.variables.map((v) => (
              <Badge key={v} tone="neutral" className="text-[10px]">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
          <span>Used {template.usageCount} times</span>
          <Menu
            label="Use template"
            align="end"
            trigger={
              <Button size="sm" variant="outline">
                Use template
              </Button>
            }
          >
            <MenuItem icon={MessageSquarePlus} onSelect={() => {}}>
              Insert into chat
            </MenuItem>
            <MenuItem icon={Send} onSelect={() => {}}>
              Send to broadcast
            </MenuItem>
            <MenuItem icon={CalendarClock} onSelect={() => {}}>
              Schedule
            </MenuItem>
          </Menu>
        </div>
      </CardBody>
    </Card>
  );
}

/* Editor dialog */

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
  const { toast } = useToast();
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
    toast.success(initial ? 'Template updated' : 'Template created');
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription>
            Compose a reusable message. Use{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 text-xs text-[var(--st-text)]">
              {'{{variable}}'}
            </code>{' '}
            for dynamic fields.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Welcome back"
            />
          </Field>
          <Field label="Folder">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Folder">
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
          </Field>
        </div>

        <Field label="Body">
          <Textarea
            ref={bodyRef}
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Hi {{firstName}},\n\nThanks for reaching out!`}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--st-text-secondary)]">Insert variable:</span>
          {KNOWN_VARIABLES.map((v) => (
            <Button
              key={v}
              size="sm"
              variant="outline"
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
            <Paperclip className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {mediaSabFileId ? 'Replace media' : 'Attach media'}
          </SabFilePickerButton>
          {mediaSabFileId && (
            <Tag
              onRemove={() => {
                setMediaSabFileId(undefined);
                setMediaName('');
              }}
              removeLabel="Remove media"
            >
              {mediaName || mediaSabFileId}
            </Tag>
          )}
          {detected.length > 0 && (
            <span className="ml-auto text-xs text-[var(--st-text-secondary)]">
              Variables: {detected.map((v) => `{{${v}}}`).join(', ')}
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void onSubmit()}
            disabled={saving || !name.trim() || !body.trim()}
            loading={saving}
          >
            {saving ? 'Saving' : initial ? 'Save changes' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
