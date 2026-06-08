'use client';

/**
 * FoldersClient
 *
 * Manages SabFlow folder records: list, create, rename, delete. The
 * underlying REST endpoints under `/api/sabflow/folders` cascade renames
 * onto every flow assigned to the folder, and unset `folderId` on
 * deletion (flows themselves are never removed).
 *
 * Folder counts are best-effort: if a `flows-by-folder` endpoint is not
 * available we just show the folder card without a count.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Folder,
  FolderPlus,
  Loader,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Radio,
  RadioGroup,
  useToast,
} from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';

type FolderRow = {
  _id: string;
  name: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
};

const PALETTE: Array<{ value: string; label: string }> = [
  { value: '#f59e0b', label: 'Amber' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#71717a', label: 'Zinc' },
];

export function FoldersClient() {
  const { toast } = useToast();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FolderRow | null>(null);
  const [deleting, setDeleting] = useState<FolderRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sabflow/folders', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load folders (${res.status})`);
      }
      const json = (await res.json()) as { folders: FolderRow[] };
      const rows = json.folders ?? [];
      setFolders(rows);

      // Best-effort fetch of folder counts. If the endpoint is not wired
      // up we silently skip the count column.
      try {
        const entries = await Promise.all(
          rows.map(async (folder) => {
            const r = await fetch(
              `/api/sabflow/flows-by-folder?folder=${encodeURIComponent(folder.name)}`,
              { cache: 'no-store' },
            );
            if (!r.ok) return [folder._id, null] as const;
            const payload = (await r.json().catch(() => null)) as
              | { count?: number; flows?: unknown[] }
              | null;
            const count =
              typeof payload?.count === 'number'
                ? payload.count
                : Array.isArray(payload?.flows)
                  ? payload.flows.length
                  : null;
            return [folder._id, count] as const;
          }),
        );
        const next: Record<string, number> = {};
        for (const [id, count] of entries) {
          if (typeof count === 'number') next[id] = count;
        }
        setCounts(next);
      } catch {
        setCounts({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(
    async (name: string, color?: string) => {
      const res = await fetch('/api/sabflow/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `Failed (${res.status})`);
      }
      setCreateOpen(false);
      toast.success('Folder created');
      await load();
    },
    [load, toast],
  );

  const handleRename = useCallback(
    async (folderId: string, name: string, color?: string) => {
      const res = await fetch(`/api/sabflow/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `Failed (${res.status})`);
      }
      setEditing(null);
      toast.success('Folder updated');
      await load();
    },
    [load, toast],
  );

  const handleDelete = useCallback(
    async (folderId: string) => {
      const res = await fetch(`/api/sabflow/folders/${folderId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `Failed (${res.status})`);
      }
      setDeleting(null);
      toast.success('Folder deleted');
      await load();
    },
    [load, toast],
  );

  return (
    <div className="20ui flex flex-col h-full">
      {/* Header */}
      <PageHeader className="px-4 sm:px-6 py-4 shrink-0">
        <PageHeaderHeading className="flex-row items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
            aria-hidden="true"
          >
            <Folder className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="flex flex-col leading-tight min-w-0">
            <PageTitle>Folders</PageTitle>
            <PageDescription>
              Organise your flows into colour-coded groups
            </PageDescription>
          </span>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            iconLeft={RefreshCw}
            onClick={load}
            disabled={loading}
            className={cn(loading && '[&_svg]:animate-spin')}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setCreateOpen(true)}
          >
            Create folder
          </Button>
        </PageActions>
      </PageHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-6">
            <Alert tone="danger" title="Could not load folders">
              {error}
            </Alert>
          </div>
        )}

        {loading && folders.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="text-[12px]">Loading folders...</span>
          </div>
        ) : folders.length === 0 && !error ? (
          <div className="flex h-[60vh] items-center justify-center px-6">
            <EmptyState
              icon={FolderPlus}
              title="No folders yet"
              description="Create a folder to group related flows together. Flows can be moved in and out at any time."
              action={
                <Button
                  variant="primary"
                  iconLeft={Plus}
                  onClick={() => setCreateOpen(true)}
                >
                  Create your first folder
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folders.map((folder) => (
              <FolderCard
                key={folder._id}
                folder={folder}
                count={counts[folder._id]}
                onEdit={() => setEditing(folder)}
                onDelete={() => setDeleting(folder)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <FolderModal
        open={createOpen}
        title="Create folder"
        submitLabel="Create"
        onSubmit={handleCreate}
        onClose={() => setCreateOpen(false)}
      />
      <FolderModal
        open={Boolean(editing)}
        title="Rename folder"
        submitLabel="Save"
        initialName={editing?.name}
        initialColor={editing?.color}
        onSubmit={async (name, color) => {
          if (editing) await handleRename(editing._id, name, color);
        }}
        onClose={() => setEditing(null)}
      />
      <DeleteConfirmModal
        folder={deleting}
        onConfirm={async () => {
          if (deleting) await handleDelete(deleting._id);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/* Folder card */

function FolderCard({
  folder,
  count,
  onEdit,
  onDelete,
}: {
  folder: FolderRow;
  count: number | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const swatch = folder.color ?? '#71717a';
  return (
    <Card variant="interactive" padding="md" className="group relative flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
          style={{ backgroundColor: `${swatch}1f`, color: swatch }}
          aria-hidden="true"
        >
          <Folder className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[13.5px] font-semibold text-[var(--st-text)]"
            title={folder.name}
          >
            {folder.name}
          </p>
          <div className="mt-1">
            {typeof count === 'number' ? (
              <Badge tone="neutral" kind="soft" dot>
                {count} {count === 1 ? 'flow' : 'flows'}
              </Badge>
            ) : (
              <Badge tone="neutral" kind="soft">
                Folder
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10.5px] text-[var(--st-text-secondary)]">
        <span>
          Created {folder.createdAt ? formatDate(folder.createdAt) : '-'}
        </span>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
          <IconButton
            label="Rename folder"
            icon={Pencil}
            size="sm"
            variant="ghost"
            onClick={onEdit}
          />
          <IconButton
            label="Delete folder"
            icon={Trash2}
            size="sm"
            variant="ghost"
            onClick={onDelete}
          />
        </div>
      </div>
    </Card>
  );
}

/* Create / edit modal */

function FolderModal({
  open,
  title,
  submitLabel,
  initialName,
  initialColor,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  initialName?: string;
  initialColor?: string;
  onSubmit: (name: string, color?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [color, setColor] = useState<string | undefined>(
    initialColor ?? PALETTE[0]?.value,
  );
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Re-seed the form whenever the modal opens for a different record.
  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setColor(initialColor ?? PALETTE[0]?.value);
      setErr(null);
    }
  }, [open, initialName, initialColor]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit(name.trim(), color);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="folder-form"
            loading={submitting}
            disabled={!name.trim()}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="folder-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Customer onboarding"
            maxLength={60}
          />
        </Field>

        <Field label="Colour">
          <RadioGroup
            orientation="horizontal"
            value={color}
            onValueChange={setColor}
            aria-label="Folder colour"
            className="flex-wrap gap-2"
          >
            {PALETTE.map((c) => (
              <Radio
                key={c.value}
                value={c.value}
                aria-label={c.label}
                label={
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-[var(--st-border)] align-middle"
                    style={{ backgroundColor: c.value }}
                    aria-hidden="true"
                  />
                }
              />
            ))}
          </RadioGroup>
        </Field>

        {err && (
          <Alert tone="danger">{err}</Alert>
        )}
      </form>
    </Modal>
  );
}

/* Delete confirmation */

function DeleteConfirmModal({
  folder,
  onConfirm,
  onClose,
}: {
  folder: FolderRow | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (folder) setErr(null);
  }, [folder]);

  async function confirm() {
    setSubmitting(true);
    setErr(null);
    try {
      await onConfirm();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={Boolean(folder)}
      onClose={onClose}
      title="Delete folder"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            iconLeft={Trash2}
            onClick={confirm}
            loading={submitting}
          >
            Delete folder
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-[var(--st-text)]">
          Delete{' '}
          <span className="font-semibold">&ldquo;{folder?.name}&rdquo;</span>?
        </p>
        <p className="text-[12px] text-[var(--st-text-secondary)]">
          Deleting will not delete flows, they will move back to the workspace
          root.
        </p>

        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}

/* Helpers */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
