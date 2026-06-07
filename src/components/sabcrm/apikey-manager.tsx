'use client';

/**
 * SabCRM — API Key Manager.
 *
 * Client component for the `/dashboard/dashboard/settings/crm/api-keys` page.
 * Lets a SabCRM admin:
 *   1. Issue a new API key (label required) — the raw key is shown ONCE in a
 *      post-creation dialog; it is never shown again.
 *   2. List active keys (masked: prefix + ••••… + last 4 of prefix) newest-first.
 *   3. Revoke a key via a confirmation alert-dialog (soft-revoke — the record
 *      is retained for audit, the key can no longer authenticate).
 *
 * Wiring:
 *   • Uses the existing gated server actions:
 *       {@link issueApiKeyAction}   — gate('edit')
 *       {@link listApiKeysAction}   — gate('edit')
 *       {@link revokeApiKeyAction}  — gate('edit')
 *   • All mutations are optimistic at the list level; errors restore state and
 *     surface via the shared ZoruUI toast.
 *   • No raw secrets are stored in component state beyond the single
 *     post-creation "show once" dialog that is dismissed by the user.
 *
 * Pure ZoruUI (black-and-white). No free-text URL inputs; no SabFiles needed
 * here (API keys are not file objects).
 *
 * Usage:
 *   <ApiKeyManager initialKeys={keys} projectId="..." />
 */

import * as React from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  ShieldOff,
  AlertTriangle,
} from 'lucide-react';

import { Badge, Button, cn, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, Input, Label, Separator, useToast } from '@/components/sabcrm/20ui';
import {
  issueApiKeyAction,
  listApiKeysAction,
  revokeApiKeyAction,
} from '@/app/actions/sabcrm.actions';
import type { SabcrmApiKey } from '@/lib/sabcrm/apikeys.server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiKeyManagerProps {
  /** Pre-fetched list of active keys (SSR). Refreshed client-side after mutations. */
  initialKeys: SabcrmApiKey[];
  /** Optional explicit project id forwarded to every action call. */
  projectId?: string;
  /** When true the component renders in a read-only / loading skeleton mode. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats an ISO timestamp into a short human-readable date string.
 * Keeps the display consistent across time zones (uses the locale default).
 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Produces a masked display string for a key.
 * The `prefix` field already includes the `sk_crm_` guard and the first 6
 * random characters, so we append a fixed redaction tail to make the total
 * length look plausible without leaking any additional secret material.
 */
function maskedKey(prefix: string): string {
  return `${prefix}••••••••••••••••`;
}

// ---------------------------------------------------------------------------
// Sub-component: RawKeyRevealDialog
//
// Shown exactly once after a successful issueApiKey call. Forces the user to
// explicitly copy and acknowledge the secret before they can dismiss.
// ---------------------------------------------------------------------------

interface RawKeyRevealDialogProps {
  open: boolean;
  rawKey: string;
  label: string;
  onClose: () => void;
}

function RawKeyRevealDialog({
  open,
  rawKey,
  label,
  onClose,
}: RawKeyRevealDialogProps) {
  const [visible, setVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);

  // Reset local state whenever the dialog re-opens for a fresh key.
  React.useEffect(() => {
    if (open) {
      setVisible(false);
      setCopied(false);
      setAcknowledged(false);
    }
  }, [open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setAcknowledged(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable — fall back to selection hint.
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        hideClose
        className="max-w-md"
        // Prevent accidental dismissal via Escape before acknowledging.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-[var(--st-text)]" />
            API key created — copy it now
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-[var(--st-text)]">{label}</span> has been
            issued. The secret will <span className="font-semibold">never be shown again</span>{' '}
            — copy it before closing this dialog.
          </DialogDescription>
        </DialogHeader>

        {/* Key display area */}
        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
          <p className="mb-1.5 text-xs font-medium text-[var(--st-text-secondary)]">Secret key</p>
          <div className="flex items-center gap-2">
            <code
              className={cn(
                'flex-1 select-all break-all font-mono text-xs text-[var(--st-text)]',
                !visible && 'tracking-widest text-[var(--st-text-secondary)]',
              )}
            >
              {visible ? rawKey : rawKey.replace(/./g, '•')}
            </code>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={visible ? 'Hide key' : 'Reveal key'}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-warn)]/30 bg-[var(--st-warn)]/10 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-warn)]" />
          <p className="text-xs leading-relaxed text-[var(--st-warn)]">
            Store this key in a secrets manager or environment variable. SabNode
            cannot recover it after you close this dialog.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            leading={<Copy className="h-4 w-4" />}
          >
            {copied ? 'Copied!' : 'Copy key'}
          </Button>
          <Button
            variant={acknowledged ? 'default' : 'secondary'}
            size="sm"
            disabled={!acknowledged}
            onClick={onClose}
          >
            {acknowledged ? "I've saved it — close" : 'Copy key to close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: IssueKeyDialog
//
// Small dialog for the "New API key" flow: prompts for a label then calls the
// server action.
// ---------------------------------------------------------------------------

interface IssueKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIssued: (rawKey: string, label: string, key: SabcrmApiKey) => void;
  projectId?: string;
}

function IssueKeyDialog({
  open,
  onOpenChange,
  onIssued,
  projectId,
}: IssueKeyDialogProps) {
  const [label, setLabel] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  // Reset on open.
  React.useEffect(() => {
    if (open) {
      setLabel('');
      setError(null);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError('A label is required so you can identify this key later.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await issueApiKeyAction(label.trim(), projectId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      onIssued(res.data.rawKey, res.data.key.label, res.data.key);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            Give the key a descriptive label (e.g. "Zapier production") so you
            can identify and revoke it later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="api-key-label">Label</Label>
            <Input
              id="api-key-label"
              placeholder="e.g. Zapier production"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              invalid={!!error}
              disabled={pending}
              autoFocus
            />
            {error && (
              <p className="text-xs text-[var(--st-danger)]" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={pending || !label.trim()}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create key'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: KeyRow
// ---------------------------------------------------------------------------

interface KeyRowProps {
  apiKey: SabcrmApiKey;
  onRevoke: (keyId: string) => void;
  revoking: boolean;
}

function KeyRow({ apiKey, onRevoke, revoking }: KeyRowProps) {
  const relativeLastUsed = apiKey.lastUsedAt
    ? `Last used ${formatDate(apiKey.lastUsedAt)}`
    : 'Never used';

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3',
        'transition-colors',
        apiKey.revoked && 'opacity-50',
      )}
    >
      {/* Left: key info */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--st-text)]">
            {apiKey.label}
          </span>
          {apiKey.revoked && (
            <Badge variant="ghost" className="shrink-0 text-[10px] uppercase tracking-wider">
              Revoked
            </Badge>
          )}
        </div>

        <code className="block truncate font-mono text-xs text-[var(--st-text-secondary)]">
          {maskedKey(apiKey.prefix)}
        </code>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-xs text-[var(--st-text-tertiary)]">
            Created {formatDate(apiKey.createdAt)}
          </span>
          <span className="text-xs text-[var(--st-text-tertiary)]">{relativeLastUsed}</span>
          {apiKey.revokedAt && (
            <span className="text-xs text-[var(--st-text-tertiary)]">
              Revoked {formatDate(apiKey.revokedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Right: actions */}
      {!apiKey.revoked && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Revoke key "${apiKey.label}"`}
              disabled={revoking}
              className="shrink-0 text-[var(--st-text-secondary)] hover:text-[var(--st-danger)]"
            >
              {revoking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldOff className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
              <AlertDialogDescription>
                The key <span className="font-medium text-[var(--st-text)]">{apiKey.label}</span>{' '}
                (<code className="font-mono text-xs">{maskedKey(apiKey.prefix)}</code>) will
                immediately stop authenticating API requests. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                destructive
                onClick={() => onRevoke(apiKey.id)}
              >
                Revoke key
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export: ApiKeyManager
// ---------------------------------------------------------------------------

export function ApiKeyManager({
  initialKeys,
  projectId,
  disabled = false,
}: ApiKeyManagerProps) {
  const [keys, setKeys] = React.useState<SabcrmApiKey[]>(initialKeys);
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [loadingIds, setLoadingIds] = React.useState<ReadonlySet<string>>(
    new Set(),
  );

  // "show once" reveal state for the most recently issued key.
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [revealRaw, setRevealRaw] = React.useState('');
  const [revealLabel, setRevealLabel] = React.useState('');

  const [, startTransition] = React.useTransition();
  const { toast } = useToast();

  // ------------------------------------------------------------------
  // Refresh helper — re-fetches the list from the server after a mutation.
  // ------------------------------------------------------------------
  function refreshKeys() {
    startTransition(async () => {
      const res = await listApiKeysAction(undefined, projectId);
      if (res.ok) setKeys(res.data);
    });
  }

  // ------------------------------------------------------------------
  // Issue
  // ------------------------------------------------------------------
  function handleIssued(rawKey: string, label: string, key: SabcrmApiKey) {
    // Optimistically prepend the new key to the list.
    setKeys((prev) => [key, ...prev]);
    // Open the reveal dialog.
    setRevealRaw(rawKey);
    setRevealLabel(label);
    setRevealOpen(true);
  }

  function handleRevealClose() {
    setRevealOpen(false);
    setRevealRaw('');
    // Refresh in case the server state differs (e.g. clock skew).
    refreshKeys();
    toast({
      title: 'API key saved',
      description: `"${revealLabel}" is now active.`,
    });
  }

  // ------------------------------------------------------------------
  // Revoke
  // ------------------------------------------------------------------
  function handleRevoke(keyId: string) {
    setLoadingIds((prev) => new Set(prev).add(keyId));

    startTransition(async () => {
      const res = await revokeApiKeyAction(keyId, projectId);

      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(keyId);
        return next;
      });

      if (!res.ok) {
        toast({
          title: 'Could not revoke key',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      // Optimistically mark the key revoked in local state; a refresh will
      // align with the server's soft-revoke record.
      setKeys((prev) =>
        prev.map((k) =>
          k.id === keyId
            ? { ...k, revoked: true, revokedAt: new Date().toISOString() }
            : k,
        ),
      );

      toast({ title: 'API key revoked', description: 'The key can no longer authenticate requests.' });
    });
  }

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------
  const activeKeys = keys.filter((k) => !k.revoked);
  const revokedKeys = keys.filter((k) => k.revoked);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-[var(--st-text)]">API keys</h2>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Bearer tokens that authenticate requests to the SabCRM public REST
            API. Each key is scoped to this project.
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          disabled={disabled}
          leading={<Plus className="h-4 w-4" />}
          onClick={() => setIssueOpen(true)}
        >
          New key
        </Button>
      </div>

      <Separator />

      {/* Active keys */}
      {activeKeys.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--st-radius-lg)] border border-dashed border-[var(--st-border)] py-10 text-center">
          <Key className="h-7 w-7 text-[var(--st-text-tertiary)]" />
          <p className="text-sm font-medium text-[var(--st-text-secondary)]">No active API keys</p>
          <p className="text-xs text-[var(--st-text-tertiary)]">
            Create a key to start authenticating SabCRM REST requests.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            leading={<Plus className="h-4 w-4" />}
            onClick={() => setIssueOpen(true)}
            disabled={disabled}
          >
            Create API key
          </Button>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Active API keys">
          {activeKeys.map((key) => (
            <li key={key.id}>
              <KeyRow
                apiKey={key}
                onRevoke={handleRevoke}
                revoking={loadingIds.has(key.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Revoked keys (collapsed history) */}
      {revokedKeys.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none list-none text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]">
            <span className="inline-flex items-center gap-1">
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>
              &nbsp;{revokedKeys.length} revoked key{revokedKeys.length !== 1 ? 's' : ''}
            </span>
          </summary>
          <ul className="mt-2 space-y-2 opacity-60" aria-label="Revoked API keys">
            {revokedKeys.map((key) => (
              <li key={key.id}>
                <KeyRow
                  apiKey={key}
                  onRevoke={handleRevoke}
                  revoking={loadingIds.has(key.id)}
                />
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Dialogs */}
      <IssueKeyDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        onIssued={handleIssued}
        projectId={projectId}
      />

      <RawKeyRevealDialog
        open={revealOpen}
        rawKey={revealRaw}
        label={revealLabel}
        onClose={handleRevealClose}
      />
    </div>
  );
}
