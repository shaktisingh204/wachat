'use client';

/**
 * SabCRM — API Keys settings (`/dashboard/settings/crm/api`).
 *
 * Lists the active project's API keys (label, masked key, created, last used)
 * and supports issuing a new key (secret shown exactly once) and revoking an
 * existing key with confirmation. All three operations go through the
 * admin-gated server actions, each of which independently re-runs the
 * session, project, RBAC (`sabcrm:admin`), plan pipeline, so the page fails
 * closed even when the layout guard passes.
 *
 * Project scope comes from `useProject()`. States: skeleton while project /
 * data load, "no project" notice, empty list, error banner, and graceful
 * degradation when the backend is unreachable.
 *
 * Built entirely on the 20ui design system (`@/components/sabcrm/20ui`).
 */

import * as React from 'react';
import { KeyRound, Plus, Copy, Check, Info } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Card,
  Alert,
  Callout,
  EmptyState,
  Skeleton,
  Modal,
  Field,
  Input,
  Checkbox,
  Badge,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';

import { useProject } from '@/context/project-context';
import {
  listApiKeysAction,
  issueApiKeyAction,
  revokeApiKeyAction,
} from '@/app/actions/sabcrm.actions';
import type {
  SabcrmApiKey,
  IssuedSabcrmApiKey,
} from '@/lib/sabcrm/apikeys.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** A safe-to-display masked representation of a key from its public prefix. */
function maskedKey(prefix: string): string {
  return `${prefix}${'•'.repeat(8)}`;
}

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

/**
 * The scope catalogue offered in the Create-key dialog.
 *
 * NOTE on persistence: the backend `issueApiKeyAction(label, projectId)` action
 * (and the `issueApiKey` store beneath it) accepts ONLY a label, it has no
 * scopes column. Rather than silently dropping the operator's selection, we
 * encode the chosen scopes into the label using a machine-parseable suffix
 * (`[scopes: a,b,c]`). The suffix round-trips through the existing store, is
 * parsed back out for display as chips on each row, and is stripped from the
 * human label. Enforcement at the REST layer is not yet wired, so the dialog
 * shows an honest "display-only / enforcement coming" note.
 */
const SCOPE_OPTIONS = [
  { id: 'records:read', desc: 'Read records across objects.' },
  { id: 'records:write', desc: 'Create and update records.' },
  { id: 'records:delete', desc: 'Delete records.' },
  { id: 'objects:read', desc: 'Read object & field metadata.' },
  { id: 'webhooks:manage', desc: 'Create and manage webhooks.' },
  { id: 'views:manage', desc: 'Create and manage saved views.' },
] as const;

type ScopeId = (typeof SCOPE_OPTIONS)[number]['id'];

const ALL_SCOPE_IDS = SCOPE_OPTIONS.map((s) => s.id) as readonly ScopeId[];

/** Scopes pre-selected when the dialog opens. */
const DEFAULT_SCOPES: readonly ScopeId[] = ['records:read', 'records:write'];

/** Marker that carries the scope list inside the (label-only) backend field. */
const SCOPE_TAG_RE = /\s*\[scopes:\s*([^\]]*)\]\s*$/i;

/** Strip the encoded `[scopes: ...]` suffix, returning the human-readable label. */
function labelOf(rawLabel: string): string {
  return rawLabel.replace(SCOPE_TAG_RE, '').trim() || rawLabel.trim();
}

/** Parse the encoded scopes back out of a stored label. */
function scopesOf(rawLabel: string): ScopeId[] {
  const m = SCOPE_TAG_RE.exec(rawLabel);
  if (!m || !m[1]) return [];
  const valid = new Set<string>(ALL_SCOPE_IDS);
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ScopeId => valid.has(s));
}

/** Compose the backend label from a human name + selected scopes. */
function encodeLabel(name: string, scopes: readonly ScopeId[]): string {
  const clean = name.trim();
  if (scopes.length === 0) return clean;
  return `${clean} [scopes: ${scopes.join(',')}]`;
}

// ---------------------------------------------------------------------------
// Scope chips (key rows + created summary)
// ---------------------------------------------------------------------------

function ScopeChips({ scopes }: { scopes: ScopeId[] }): React.JSX.Element {
  if (scopes.length === 0) {
    return <Badge tone="neutral">No scopes</Badge>;
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {scopes.map((s) => (
        <Badge key={s} tone="accent">
          {s}
        </Badge>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Copyable code value (reveal-once secrets)
// ---------------------------------------------------------------------------

function CopyValue({ value }: { value: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable, no-op */
    }
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        value={value}
        aria-label="API key"
        className="font-mono"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button
        variant="secondary"
        iconLeft={copied ? Check : Copy}
        onClick={copy}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create-key dialog
// ---------------------------------------------------------------------------

interface CreateKeyDialogProps {
  projectId: string;
  onClose: () => void;
  onIssued: (issued: IssuedSabcrmApiKey) => void;
}

function CreateKeyDialog({
  projectId,
  onClose,
  onIssued,
}: CreateKeyDialogProps): React.JSX.Element {
  const { toast } = useToast();
  const [label, setLabel] = React.useState('');
  const [scopes, setScopes] = React.useState<ScopeId[]>([...DEFAULT_SCOPES]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<IssuedSabcrmApiKey | null>(null);

  const toggleScope = React.useCallback((id: ScopeId) => {
    setScopes((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }, []);

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!label.trim() || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        // The backend accepts only a label, so the selected scopes are encoded
        // into it (`name [scopes: a,b]`) and parsed back out for display.
        const res = await issueApiKeyAction(encodeLabel(label, scopes), projectId);
        if (res.ok) {
          setIssued(res.data);
          onIssued(res.data);
          toast.success('API key created');
        } else {
          setError(res.error);
        }
      } catch {
        setError('Failed to issue the key. The service may be unavailable.');
      } finally {
        setSubmitting(false);
      }
    },
    [label, scopes, submitting, projectId, onIssued, toast],
  );

  if (issued) {
    return (
      <Modal
        open
        onClose={onClose}
        title="API key created"
        size="md"
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <Field
          label="Your new API key"
          help="Copy this key now. For security it is shown only once and cannot be recovered afterwards."
        >
          <CopyValue value={issued.rawKey} />
        </Field>
        {scopes.length > 0 ? (
          <div className="mt-[var(--st-space-4)]">
            <p className="mb-2 text-[var(--st-text-secondary)] text-[length:var(--st-fs-sm)]">
              Scopes
            </p>
            <ScopeChips scopes={scopes} />
          </div>
        ) : null}
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create API key"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-api-key-form"
            variant="primary"
            loading={submitting}
            disabled={submitting || !label.trim()}
          >
            {submitting ? 'Creating' : 'Create key'}
          </Button>
        </>
      }
    >
      <form id="create-api-key-form" onSubmit={submit}>
        <Field label="Name" required>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Zapier production"
            autoFocus
            maxLength={80}
          />
        </Field>

        <div className="mt-[var(--st-space-4)]">
          <p
            id="api-key-scopes-label"
            className="mb-2 text-[var(--st-text)] text-[length:var(--st-fs-sm)] font-[var(--st-fw-medium)]"
          >
            Scopes
          </p>
          <div
            role="group"
            aria-labelledby="api-key-scopes-label"
            className="flex flex-col gap-2"
          >
            {SCOPE_OPTIONS.map((opt) => (
              <Checkbox
                key={opt.id}
                checked={scopes.includes(opt.id)}
                onChange={() => toggleScope(opt.id)}
                label={
                  <span className="flex flex-col">
                    <span className="font-[var(--st-fw-medium)] text-[var(--st-text)]">
                      {opt.id}
                    </span>
                    <span className="text-[var(--st-text-secondary)] text-[length:var(--st-fs-sm)]">
                      {opt.desc}
                    </span>
                  </span>
                }
              />
            ))}
          </div>
          <div className="mt-[var(--st-space-3)]">
            <Callout tone="info" icon={Info}>
              Scopes are recorded with the key and shown on each row, but
              REST-layer enforcement is not yet wired, so for now they are
              display-only metadata. Enforcement is coming.
            </Callout>
          </div>
        </div>

        {error ? (
          <div className="mt-[var(--st-space-3)]">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Revoke confirmation dialog
// ---------------------------------------------------------------------------

interface RevokeDialogProps {
  apiKey: SabcrmApiKey;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}

function RevokeDialog({
  apiKey,
  onCancel,
  onConfirm,
  busy,
}: RevokeDialogProps): React.JSX.Element {
  return (
    <Modal
      open
      onClose={onCancel}
      title="Revoke API key"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy} disabled={busy}>
            {busy ? 'Revoking' : 'Revoke key'}
          </Button>
        </>
      }
    >
      <p className="m-0 text-[var(--st-text-secondary)]">
        Revoke{' '}
        <strong className="text-[var(--st-text)]">{labelOf(apiKey.label)}</strong>?
        Any integration using this key will immediately stop working. This cannot
        be undone.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function KeysSkeleton(): React.JSX.Element {
  return (
    <Card padding="md">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={40} radius={8} />
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmApiKeysSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [keys, setKeys] = React.useState<SabcrmApiKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [revokeTarget, setRevokeTarget] = React.useState<SabcrmApiKey | null>(null);
  const [revoking, setRevoking] = React.useState(false);

  const load = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listApiKeysAction(undefined, projectId);
      if (res.ok) {
        setKeys(res.data.filter((k) => !k.revoked));
      } else {
        setError(res.error);
      }
    } catch {
      setError('API keys could not be loaded. The service may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    void load(activeProjectId);
  }, [activeProjectId, isLoadingProject, load]);

  const confirmRevoke = React.useCallback(async () => {
    if (!revokeTarget || !activeProjectId) return;
    setRevoking(true);
    try {
      const res = await revokeApiKeyAction(revokeTarget.id, activeProjectId);
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== revokeTarget.id));
        setRevokeTarget(null);
        toast.success('API key revoked');
      } else {
        setError(res.error);
        setRevokeTarget(null);
      }
    } catch {
      setError('Failed to revoke the key. The service may be unavailable.');
      setRevokeTarget(null);
    } finally {
      setRevoking(false);
    }
  }, [revokeTarget, activeProjectId, toast]);

  return (
    <div className="20ui">
      <div className="mx-auto flex max-w-5xl flex-col gap-[var(--st-space-5)] p-[var(--st-space-6)]">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>API Keys</PageTitle>
            <PageDescription>
              Bearer tokens for the SabCRM REST API, scoped to this project.
              Issuing and revoking keys requires the{' '}
              <code className="font-mono text-[var(--st-text)]">sabcrm:admin</code>{' '}
              capability.
            </PageDescription>
          </PageHeaderHeading>
          {activeProjectId ? (
            <PageActions>
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => setCreateOpen(true)}
              >
                Create key
              </Button>
            </PageActions>
          ) : null}
        </PageHeader>

        {error ? (
          <Alert tone="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        {isLoadingProject || loading ? (
          <KeysSkeleton />
        ) : !activeProjectId ? (
          <Card padding="lg">
            <EmptyState
              icon={KeyRound}
              tone="warning"
              title="No project selected"
              description="Select a project to manage its API keys."
            />
          </Card>
        ) : keys.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={KeyRound}
              title="No API keys yet"
              description="Create a key to authenticate requests to the SabCRM REST API."
              action={
                <Button
                  variant="secondary"
                  iconLeft={Plus}
                  onClick={() => setCreateOpen(true)}
                >
                  Create key
                </Button>
              }
            />
          </Card>
        ) : (
          <Card padding="none">
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Key</Th>
                  <Th>Scopes</Th>
                  <Th>Created</Th>
                  <Th>Last used</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {keys.map((key) => (
                  <Tr key={key.id}>
                    <Td className="font-[var(--st-fw-medium)]">
                      {labelOf(key.label)}
                    </Td>
                    <Td className="font-mono">{maskedKey(key.prefix)}</Td>
                    <Td>
                      <ScopeChips scopes={scopesOf(key.label)} />
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {formatDate(key.createdAt)}
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {key.lastUsedAt ? (
                        formatDate(key.lastUsedAt)
                      ) : (
                        <span className="text-[var(--st-text-tertiary)]">Never</span>
                      )}
                    </Td>
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokeTarget(key)}
                        className="text-[var(--st-danger)]"
                      >
                        Revoke
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </div>

      {createOpen && activeProjectId ? (
        <CreateKeyDialog
          projectId={activeProjectId}
          onClose={() => setCreateOpen(false)}
          onIssued={(issued) =>
            setKeys((prev) => [
              issued.key,
              ...prev.filter((k) => k.id !== issued.key.id),
            ])
          }
        />
      ) : null}

      {revokeTarget ? (
        <RevokeDialog
          apiKey={revokeTarget}
          busy={revoking}
          onCancel={() => setRevokeTarget(null)}
          onConfirm={confirmRevoke}
        />
      ) : null}
    </div>
  );
}
