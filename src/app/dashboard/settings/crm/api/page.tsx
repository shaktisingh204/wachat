'use client';

/**
 * SabCRM — API Keys settings (`/dashboard/settings/crm/api`), Twenty-style.
 *
 * Lists the active project's API keys (label, masked key, created, last used)
 * and supports issuing a new key (secret shown exactly once) and revoking an
 * existing key with confirmation. All three operations go through the
 * admin-gated server actions, each of which independently re-runs the
 * session → project → RBAC (`sabcrm:admin`) → plan pipeline, so the page fails
 * closed even when the layout guard passes.
 *
 * Project scope comes from `useProject()`. States: skeleton while project /
 * data load, "no project" notice, empty list, error banner, and graceful
 * degradation when the backend is unreachable.
 */

import * as React from 'react';
import {
  KeyRound,
  Plus,
  X,
  Copy,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
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

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../settings-twenty.css';
import './api-scopes.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
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
 * (and the `issueApiKey` store beneath it) accepts ONLY a label — it has no
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

/** Strip the encoded `[scopes: …]` suffix, returning the human-readable label. */
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
    return (
      <div className="st-scope-chips">
        <span className="st-scope-chip st-scope-chip--empty">No scopes</span>
      </div>
    );
  }
  return (
    <div className="st-scope-chips">
      {scopes.map((s) => (
        <span key={s} className="st-scope-chip">
          {s}
        </span>
      ))}
    </div>
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
      /* clipboard unavailable — no-op */
    }
  }, [value]);

  return (
    <div className="st-secret__value">
      <code className="st-secret__code">{value}</code>
      <TwentyButton
        variant="secondary"
        icon={copied ? Check : Copy}
        onClick={copy}
      >
        {copied ? 'Copied' : 'Copy'}
      </TwentyButton>
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
        } else {
          setError(res.error);
        }
      } catch {
        setError('Failed to issue the key. The service may be unavailable.');
      } finally {
        setSubmitting(false);
      }
    },
    [label, scopes, submitting, projectId, onIssued],
  );

  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Create API key"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !issued) onClose();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">
            {issued ? 'API key created' : 'Create API key'}
          </h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {issued ? (
          <>
            <div className="st-dialog__body">
              <div className="st-secret">
                <span className="st-secret__label">Your new API key</span>
                <CopyValue value={issued.rawKey} />
                <span className="st-secret__hint">
                  Copy this key now — for security it is shown only once and
                  cannot be recovered afterwards.
                </span>
              </div>
              {scopes.length > 0 ? (
                <div className="st-field" style={{ marginTop: 'var(--st-space-3)' }}>
                  <span className="st-field__label">Scopes</span>
                  <ScopeChips scopes={scopes} />
                </div>
              ) : null}
            </div>
            <div className="st-dialog__footer">
              <TwentyButton variant="primary" onClick={onClose}>
                Done
              </TwentyButton>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="st-dialog__body">
              <div className="st-field">
                <label className="st-field__label" htmlFor="api-key-label">
                  Name
                  <span className="st-field__req" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="api-key-label"
                  className="st-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Zapier production"
                  autoFocus
                  maxLength={80}
                />
              </div>

              <div
                className="st-field"
                style={{ marginTop: 'var(--st-space-4)' }}
              >
                <span className="st-field__label" id="api-key-scopes-label">
                  Scopes
                </span>
                <div
                  className="st-scopes"
                  role="group"
                  aria-labelledby="api-key-scopes-label"
                >
                  <div className="st-scopes__list">
                    {SCOPE_OPTIONS.map((opt) => {
                      const on = scopes.includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`st-scope${on ? ' st-scope--on' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="st-scope__check"
                            checked={on}
                            onChange={() => toggleScope(opt.id)}
                          />
                          <span className="st-scope__text">
                            <span className="st-scope__name">{opt.id}</span>
                            <span className="st-scope__desc">{opt.desc}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="st-scopes__note">
                    <Info className="st-scopes__note-icon" size={13} />
                    <span>
                      Scopes are recorded with the key and shown on each row, but
                      REST-layer enforcement is not yet wired — for now they are
                      display-only metadata. Enforcement is coming.
                    </span>
                  </p>
                </div>
              </div>

              {error ? <p className="st-form-error">{error}</p> : null}
            </div>
            <div className="st-dialog__footer">
              <TwentyButton variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </TwentyButton>
              <TwentyButton
                type="submit"
                variant="primary"
                disabled={submitting || !label.trim()}
              >
                {submitting ? 'Creating…' : 'Create key'}
              </TwentyButton>
            </div>
          </form>
        )}
      </div>
    </div>
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
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Revoke API key"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Revoke API key</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Revoke <strong style={{ color: 'var(--st-text)' }}>{labelOf(apiKey.label)}</strong>
            ? Any integration using this key will immediately stop working. This
            cannot be undone.
          </p>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </TwentyButton>
          <TwentyButton
            variant="secondary"
            className="st-btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Revoking…' : 'Revoke key'}
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function KeysSkeleton(): React.JSX.Element {
  return (
    <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmApiKeysSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

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
  }, [revokeTarget, activeProjectId]);

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader
          title="API Keys"
          icon={KeyRound}
          actions={
            activeProjectId ? (
              <TwentyButton
                variant="primary"
                icon={Plus}
                onClick={() => setCreateOpen(true)}
              >
                Create key
              </TwentyButton>
            ) : null
          }
        />
        <p className="st-settings__intro">
          Bearer tokens for the SabCRM REST API, scoped to this project. Issuing
          and revoking keys requires the <code>sabcrm:admin</code> capability.
        </p>

        {error ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {isLoadingProject || loading ? (
          <KeysSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to manage its API keys.
            </p>
          </div>
        ) : keys.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <KeyRound size={20} />
            </span>
            <h2 className="st-empty__title">No API keys yet</h2>
            <p className="st-empty__desc">
              Create a key to authenticate requests to the SabCRM REST API.
            </p>
            <TwentyButton
              variant="secondary"
              icon={Plus}
              onClick={() => setCreateOpen(true)}
            >
              Create key
            </TwentyButton>
          </div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Scopes</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} className="st-row">
                    <td style={{ fontWeight: 'var(--st-fw-medium)' }}>
                      {labelOf(key.label)}
                    </td>
                    <td className="st-mono">{maskedKey(key.prefix)}</td>
                    <td>
                      <ScopeChips scopes={scopesOf(key.label)} />
                    </td>
                    <td style={{ color: 'var(--st-text-secondary)' }}>
                      {formatDate(key.createdAt)}
                    </td>
                    <td style={{ color: 'var(--st-text-secondary)' }}>
                      {key.lastUsedAt ? (
                        formatDate(key.lastUsedAt)
                      ) : (
                        <span className="st-muted">Never</span>
                      )}
                    </td>
                    <td className="st-cell-actions">
                      <TwentyButton
                        variant="ghost"
                        className="st-btn--danger"
                        onClick={() => setRevokeTarget(key)}
                      >
                        Revoke
                      </TwentyButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && activeProjectId ? (
        <CreateKeyDialog
          projectId={activeProjectId}
          onClose={() => setCreateOpen(false)}
          onIssued={(issued) =>
            setKeys((prev) => [issued.key, ...prev.filter((k) => k.id !== issued.key.id)])
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
