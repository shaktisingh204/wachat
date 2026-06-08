'use client';

/**
 * ApiKeysClient
 *
 * Manage SabFlow API keys. Lists existing keys (prefix, label, created,
 * last used) with per-row revoke, and provides a "Create API key" flow that
 * mints a key and shows the raw value exactly once with a copy-to-clipboard
 * affordance and a strong warning. Reads/writes via:
 *
 *   GET    /api/sabflow/api-keys             -> { keys: ApiKey[] }
 *   POST   /api/sabflow/api-keys   { label } -> { id, rawKey, prefix }
 *   DELETE /api/sabflow/api-keys/[keyId]
 *
 * Pure 20ui: PageHeader, Table primitives, Modal, Field/Input, Alert,
 * EmptyState, Spinner, Button, and toast feedback.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Key,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Spinner,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';

type ApiKeyRow = {
  _id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  requestCount?: number;
  lastEndpoint?: string;
  lastStatus?: number;
};

type MintedKey = {
  id: string;
  rawKey: string;
  prefix: string;
  label: string;
};

export function ApiKeysClient() {
  const { toast } = useToast();

  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createLabel, setCreateLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Raw-key reveal modal state
  const [minted, setMinted] = useState<MintedKey | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke state. id currently in-flight, prevents double-clicks.
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sabflow/api-keys', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load keys (${res.status})`);
      const json = (await res.json()) as { keys: ApiKeyRow[] };
      setKeys(json.keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = useCallback(() => {
    setCreateLabel('');
    setCreateError(null);
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError(null);
  }, [creating]);

  const handleCreate = useCallback(async () => {
    const label = createLabel.trim();
    if (!label) {
      setCreateError('Please enter a label so you can identify this key later.');
      return;
    }
    if (label.length > 80) {
      setCreateError('Label too long (max 80 chars).');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/sabflow/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        rawKey?: string;
        prefix?: string;
        error?: string;
      };
      if (!res.ok || !json.rawKey || !json.id || !json.prefix) {
        throw new Error(json.error || `Failed to create key (${res.status})`);
      }
      setMinted({
        id: json.id,
        rawKey: json.rawKey,
        prefix: json.prefix,
        label,
      });
      setCreateOpen(false);
      setCreateLabel('');
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  }, [createLabel]);

  const handleCopy = useCallback(async () => {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(minted.rawKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can fail on insecure contexts. Fall through silently;
      // user can still select + copy manually.
    }
  }, [minted]);

  const dismissMinted = useCallback(() => {
    setMinted(null);
    setCopied(false);
    void load();
  }, [load]);

  const handleRevoke = useCallback(
    async (row: ApiKeyRow) => {
      const confirmed = window.confirm(
        `Revoke key ${row.prefix} ("${row.label}")? This cannot be undone. Any code using this key will stop working immediately.`,
      );
      if (!confirmed) return;
      setRevokingId(row._id);
      try {
        const res = await fetch(`/api/sabflow/api-keys/${row._id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error || `Failed to revoke (${res.status})`);
        }
        toast.success('API key revoked');
        await load();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to revoke key';
        setError(message);
        toast.error(message);
      } finally {
        setRevokingId(null);
      }
    },
    [load, toast],
  );

  return (
    <div className="20ui flex h-full flex-col">
      <PageHeader>
        <PageHeaderHeading>
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
              <Key className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
            </span>
            <PageTitle>API keys</PageTitle>
          </span>
          <PageDescription>
            Personal tokens for the SabFlow API. Keep them secret.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            disabled={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openCreate}
            iconLeft={Plus}
          >
            Create API key
          </Button>
        </PageActions>
      </PageHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && keys.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Loading keys" />
            <span className="text-[12px]">Loading keys...</span>
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert tone="danger" title="Something went wrong">
              {error}
            </Alert>
          </div>
        ) : keys.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <EmptyState
              icon={Key}
              title="No API keys yet"
              description="Create a key to authenticate calls to the SabFlow API."
              action={
                <Button variant="primary" size="sm" onClick={openCreate} iconLeft={Plus}>
                  Create your first key
                </Button>
              }
            />
          </div>
        ) : (
          <Table density="compact" hover>
            <THead>
              <Tr>
                <Th className="hidden sm:table-cell">Prefix</Th>
                <Th>Label</Th>
                <Th className="hidden md:table-cell">Created</Th>
                <Th className="hidden sm:table-cell">Last used</Th>
                <Th className="hidden lg:table-cell" align="right">
                  Requests
                </Th>
                <Th className="hidden lg:table-cell">Last endpoint</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {keys.map((row) => (
                <Tr key={row._id}>
                  <Td className="hidden sm:table-cell">
                    <code className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-1.5 py-0.5 font-[var(--st-font-mono)] text-[11.5px] text-[var(--st-text)]">
                      {row.prefix}...
                    </code>
                  </Td>
                  <Td>
                    <span className="font-medium text-[var(--st-text)]">
                      {row.label || '-'}
                    </span>
                    <code className="ml-2 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-1.5 py-0.5 font-[var(--st-font-mono)] text-[10.5px] text-[var(--st-text-secondary)] sm:hidden">
                      {row.prefix}...
                    </code>
                  </Td>
                  <Td className="hidden text-[var(--st-text-secondary)] md:table-cell">
                    {formatTime(row.createdAt)}
                  </Td>
                  <Td className="hidden text-[var(--st-text-secondary)] sm:table-cell">
                    {row.lastUsedAt ? formatTime(row.lastUsedAt) : 'Never'}
                  </Td>
                  <Td align="right" className="hidden tabular-nums text-[var(--st-text)] lg:table-cell">
                    {(row.requestCount ?? 0).toLocaleString()}
                  </Td>
                  <Td className="hidden text-[var(--st-text-secondary)] lg:table-cell">
                    {row.lastEndpoint ? (
                      <code
                        title={row.lastEndpoint}
                        className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-1.5 py-0.5 font-[var(--st-font-mono)] text-[11px] text-[var(--st-text-secondary)]"
                      >
                        {truncate(row.lastEndpoint, 32)}
                      </code>
                    ) : (
                      <span className="text-[var(--st-text-tertiary)]">-</span>
                    )}
                  </Td>
                  <Td align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(row)}
                      disabled={revokingId === row._id}
                      loading={revokingId === row._id}
                      iconLeft={revokingId === row._id ? undefined : Trash2}
                    >
                      Revoke
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Create API key"
        description="Generate a personal token for the SabFlow API."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeCreate} disabled={creating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleCreate()}
              disabled={creating || !createLabel.trim()}
              loading={creating}
              iconLeft={creating ? undefined : Plus}
            >
              {creating ? 'Creating...' : 'Create key'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Label"
            help="Used to identify the key in this list. Max 80 characters."
          >
            <Input
              autoFocus
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && createLabel.trim() && !creating) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder="e.g. Production backend"
              maxLength={80}
              disabled={creating}
            />
          </Field>

          {createError ? (
            <Alert tone="danger">{createError}</Alert>
          ) : null}
        </div>
      </Modal>

      {/* Raw key reveal modal. Shown exactly once. */}
      <Modal
        open={Boolean(minted)}
        onClose={dismissMinted}
        title="Save your API key"
        description={minted ? `Created "${minted.label}".` : undefined}
        size="sm"
        footer={
          <Button variant="primary" size="sm" onClick={dismissMinted}>
            I have saved it
          </Button>
        }
      >
        {minted ? (
          <div className="flex flex-col gap-3">
            <Alert
              tone="warning"
              icon={ShieldAlert}
              title="This key will not be shown again."
            >
              Copy it now and store it somewhere safe. If you lose it, you will
              need to revoke it and create a new one.
            </Alert>

            <div className="flex items-stretch overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
              <code className="flex-1 truncate px-3 py-2 font-[var(--st-font-mono)] text-[12px] text-[var(--st-text)]">
                {minted.rawKey}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                iconLeft={copied ? Check : Copy}
                className="rounded-none border-l border-[var(--st-border)]"
                aria-label="Copy API key"
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* helpers */

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  // Keep the tail of the path. It is usually the most identifying part
  // (e.g. ".../flows/abc123/run").
  return `...${s.slice(-(max - 1))}`;
}

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
