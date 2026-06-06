'use client';

/**
 * EnvVarsClient
 *
 * CRUD UI for workspace-scoped SabFlow env vars.  Talks to:
 *
 *   GET    /api/sabflow/env-vars
 *   PUT    /api/sabflow/env-vars            { key, value, isSecret? }
 *   DELETE /api/sabflow/env-vars?key=KEY
 *
 * Vars are referenced from flow expressions as `$env.KEY`.  Keys must match
 * `/^[A-Z][A-Z0-9_]*$/`, validated client-side before any network call.
 * Secrets are stored opaquely; the API returns `value: null` for them, and
 * the table masks them as bullets.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  Key,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Spinner,
  Table,
  TBody,
  Td,
  Textarea,
  THead,
  Th,
  Tr,
  Checkbox,
  useToast,
} from '@/components/sabcrm/20ui';

type EnvVarRow = {
  _id: string;
  key: string;
  value: string | null;
  isSecret: boolean;
  updatedAt: string;
};

const KEY_RE = /^[A-Z][A-Z0-9_]*$/;
const KEY_HINT =
  'UPPER_SNAKE_CASE: starts with a letter, then letters, digits, or underscores.';

export function EnvVarsClient() {
  const { toast } = useToast();

  const [vars, setVars] = useState<EnvVarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EnvVarRow | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<EnvVarRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sabflow/env-vars', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load env vars (${res.status})`);
      }
      const json = (await res.json()) as { vars: EnvVarRow[] };
      setVars(json.vars ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return vars;
    const needle = search.toLowerCase();
    return vars.filter((v) => v.key.toLowerCase().includes(needle));
  }, [vars, search]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((row: EnvVarRow) => {
    setEditing(row);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const handleSaved = useCallback(
    async (saved: EnvVarRow) => {
      // Optimistic merge while we re-fetch in the background.
      setVars((prev) => {
        const idx = prev.findIndex((v) => v.key === saved.key);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = saved;
          return copy;
        }
        return [...prev, saved].sort((a, b) => a.key.localeCompare(b.key));
      });
      toast.success(`Saved ${saved.key}`);
      closeModal();
      void load();
    },
    [closeModal, load, toast],
  );

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sabflow/env-vars?key=${encodeURIComponent(confirmDelete.key)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to delete (${res.status})`);
      }
      setVars((prev) => prev.filter((v) => v.key !== confirmDelete.key));
      toast.success(`Deleted ${confirmDelete.key}`);
      setConfirmDelete(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete';
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, toast]);

  return (
    <div className="ui20 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[var(--st-border)] px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
            <Key className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <h1 className="text-[15px] font-semibold text-[var(--st-text)]">
              Environment variables
            </h1>
            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
              Workspace env vars are accessible to every flow as{' '}
              <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[10.5px] text-[var(--st-text)]">
                $env.KEY
              </code>
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              iconLeft={RefreshCw}
              loading={loading}
              onClick={load}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              onClick={openCreate}
            >
              Add variable
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--st-border)] px-4 sm:px-6 py-2.5 shrink-0">
        <div className="w-full sm:w-[260px]">
          <Field>
            <Input
              inputSize="sm"
              type="text"
              iconLeft={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by key..."
              aria-label="Search by key"
            />
          </Field>
        </div>
        <span className="text-[10.5px] text-[var(--st-text-secondary)] ml-auto tabular-nums">
          {filtered.length} of {vars.length}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 sm:mx-6 mt-4">
          <Alert tone="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && vars.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Loading variables" />
            <span className="text-[12px]">Loading variables...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <EmptyState
              icon={Key}
              title={
                search
                  ? 'No variables match'
                  : vars.length === 0
                    ? 'No environment variables yet'
                    : 'No variables match'
              }
              description={
                search
                  ? 'Try a different search term.'
                  : 'Add a variable to share configuration across all your flows.'
              }
              action={
                !search && vars.length === 0 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={openCreate}
                  >
                    Add your first variable
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Table density="compact" hover>
            <THead>
              <Tr>
                <Th>Key</Th>
                <Th>Value</Th>
                <Th className="hidden sm:table-cell">Updated</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.map((row) => (
                <Tr key={row._id}>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      {row.isSecret && (
                        <Lock
                          className="h-3 w-3 text-[var(--st-text-secondary)]"
                          strokeWidth={2.5}
                          aria-label="Secret"
                        />
                      )}
                      <span className="font-mono font-medium text-[var(--st-text)]">
                        {row.key}
                      </span>
                    </span>
                  </Td>
                  <Td>
                    {row.isSecret ? (
                      <span className="font-mono text-[var(--st-text-secondary)]">
                        {'•'.repeat(8)}
                      </span>
                    ) : (
                      <span
                        className="block max-w-[160px] sm:max-w-[420px] truncate font-mono text-[var(--st-text-secondary)]"
                        title={row.value ?? ''}
                      >
                        {row.value ?? ''}
                      </span>
                    )}
                  </Td>
                  <Td className="hidden sm:table-cell text-[var(--st-text-tertiary)]">
                    {formatTime(row.updatedAt)}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label={`Edit ${row.key}`}
                        icon={Pencil}
                        size="sm"
                        onClick={() => openEdit(row)}
                      />
                      <IconButton
                        label={`Delete ${row.key}`}
                        icon={Trash2}
                        size="sm"
                        onClick={() => setConfirmDelete(row)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {modalOpen && (
        <EnvVarModal
          editing={editing}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmModal
          envVar={confirmDelete}
          deleting={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

/* --------------------------- modal: create / edit --------------------------- */

interface EnvVarModalProps {
  editing: EnvVarRow | null;
  onClose: () => void;
  onSaved: (row: EnvVarRow) => void;
}

function EnvVarModal({ editing, onClose, onSaved }: EnvVarModalProps) {
  const isEditing = editing !== null;
  const [key, setKey] = useState(editing?.key ?? '');
  // For secrets when editing we do not know the value, so start empty and treat
  // empty submission as "no change". Non-secret values arrive in full.
  const [value, setValue] = useState(
    editing && !editing.isSecret ? (editing.value ?? '') : '',
  );
  const [isSecret, setIsSecret] = useState(editing?.isSecret ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const keyValid = KEY_RE.test(key);
  const keyError =
    key.length === 0
      ? null
      : !keyValid
        ? KEY_HINT
        : key.length > 64
          ? 'Key too long (max 64 chars)'
          : null;

  const submit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);

      if (!key.trim()) {
        setFormError('Key is required');
        return;
      }
      if (!keyValid || key.length > 64) {
        setFormError(KEY_HINT);
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/sabflow/env-vars', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value, isSecret }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Failed to save (${res.status})`);
        }
        const json = (await res.json()) as { var: EnvVarRow };
        onSaved(json.var);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSubmitting(false);
      }
    },
    [key, keyValid, value, isSecret, onSaved],
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={isEditing ? 'Edit variable' : 'Add variable'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="env-var-form"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!keyValid}
          >
            {isEditing ? 'Save changes' : 'Add variable'}
          </Button>
        </div>
      }
    >
      <form id="env-var-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Key"
          error={keyError ?? undefined}
          help={keyError ? undefined : KEY_HINT}
        >
          <Input
            inputSize="sm"
            type="text"
            autoFocus={!isEditing}
            disabled={isEditing}
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="MY_API_KEY"
            className="font-mono"
          />
        </Field>

        <Field
          label={
            <span className="inline-flex items-center gap-2">
              Value
              {isEditing && isSecret && (
                <span className="normal-case tracking-normal text-[10.5px] font-normal text-[var(--st-text-secondary)]">
                  (leave blank to keep current secret)
                </span>
              )}
            </span>
          }
        >
          <Textarea
            rows={4}
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              isSecret ? 'sk_live_...' : 'https://example.com/webhook'
            }
            className="font-mono resize-y"
          />
        </Field>

        <Checkbox
          size="sm"
          checked={isSecret}
          onChange={(e) => setIsSecret(e.target.checked)}
          label={
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--st-text-secondary)]">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Treat as secret (value hidden in the UI)
            </span>
          }
        />

        {formError && (
          <Alert tone="danger">{formError}</Alert>
        )}
      </form>
    </Modal>
  );
}

/* --------------------------- modal: delete confirm --------------------------- */

interface DeleteConfirmModalProps {
  envVar: EnvVarRow;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({
  envVar,
  deleting,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title="Delete variable?"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={deleting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleting}
            onClick={onConfirm}
          >
            Delete
          </Button>
        </div>
      }
    >
      <p className="text-[12px] text-[var(--st-text-secondary)]">
        Flows referencing{' '}
        <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[11px] text-[var(--st-text)]">
          $env.{envVar.key}
        </code>{' '}
        will get an empty string at runtime. This cannot be undone.
      </p>
      <div className="mt-2">
        <Badge tone="warning" dot>
          Destructive action
        </Badge>
      </div>
    </Modal>
  );
}

/* --------------------------- helpers --------------------------- */

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
