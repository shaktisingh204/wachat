'use client';

/**
 * SabCRM — API Settings client component.
 *
 * Interactive shell for:
 *   1. API Keys — issue / list / revoke bearer tokens that authenticate the
 *      SabCRM public REST API. Raw key is shown exactly once on issue.
 *   2. Webhooks — create / list / edit / delete outbound webhook subscriptions;
 *      rotate signing secrets.
 *   3. Base URL + example curl — read-only reference card.
 *
 * All mutations route through the gated server actions in
 * `src/app/actions/sabcrm.actions.ts`. Every action runs the full
 * session → project → RBAC → plan pipeline, so gating is never bypassed.
 *
 * ZoruUI primitives exclusively. No raw Tailwind accents outside --zoru-*
 * CSS variables.
 */

import * as React from 'react';
import {
  Copy,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  KeyRound,
  Webhook,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import {
  Button,
  Badge,
  Card,
  Input,
  Label,
  Separator,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Dialog,
  ZoruDialogTrigger,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogFooter,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogClose,
  ZoruAlertDialog,
  ZoruAlertDialogTrigger,
  ZoruAlertDialogContent,
  ZoruAlertDialogHeader,
  ZoruAlertDialogFooter,
  ZoruAlertDialogTitle,
  ZoruAlertDialogDescription,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  Switch,
  Checkbox,
  Tooltip,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  ZoruTooltipContent,
  Table,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
} from '@/components/zoruui';
import { useProject } from '@/context/project-context';
import {
  listApiKeysAction,
  issueApiKeyAction,
  revokeApiKeyAction,
  listWebhooksAction,
  createWebhookAction,
  updateWebhookAction,
  deleteWebhookAction,
  rotateWebhookSecretAction,
  type SabcrmApiKey,
  type IssuedSabcrmApiKey,
  type WebhookSubscription,
  type CreateWebhookInput,
  type UpdateWebhookPatch,
} from '@/app/actions/sabcrm.actions';
import { SABCRM_WEBHOOK_EVENTS, type SabcrmWebhookEvent } from '@/lib/sabcrm/webhook-events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard button
// ---------------------------------------------------------------------------

interface CopyButtonProps {
  value: string;
  label?: string;
}

function CopyButton({ value, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <ZoruTooltipProvider>
      <Tooltip>
        <ZoruTooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            aria-label={copied ? 'Copied!' : label}
            className="h-7 w-7 shrink-0"
          >
            {copied ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-zoru-ink-muted" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-zoru-ink-muted" />
            )}
          </Button>
        </ZoruTooltipTrigger>
        <ZoruTooltipContent side="top">{copied ? 'Copied!' : label}</ZoruTooltipContent>
      </Tooltip>
    </ZoruTooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Monospace value display (secret / key / URL)
// ---------------------------------------------------------------------------

interface MonoValueProps {
  value: string;
  obscured?: boolean;
  onToggleObscured?: () => void;
  copyLabel?: string;
}

function MonoValue({ value, obscured, onToggleObscured, copyLabel }: MonoValueProps) {
  const display = obscured ? '•'.repeat(Math.min(value.length, 32)) : value;
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-zoru-line bg-zoru-surface px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-zoru-ink">
        {display}
      </code>
      {onToggleObscured && (
        <button
          type="button"
          onClick={onToggleObscured}
          aria-label={obscured ? 'Reveal value' : 'Hide value'}
          className="shrink-0 text-zoru-ink-muted transition-colors hover:text-zoru-ink"
        >
          {obscured ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      )}
      <CopyButton value={value} label={copyLabel ?? 'Copy'} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

interface SectionHeadingProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function SectionHeading({ icon, title, description, action }: SectionHeadingProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zoru-line bg-zoru-bg text-zoru-ink">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-zoru-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-zoru-ink-muted">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ===========================================================================
// API KEYS
// ===========================================================================

// ---------------------------------------------------------------------------
// Issue-key dialog
// ---------------------------------------------------------------------------

interface IssueKeyDialogProps {
  projectId: string | undefined;
  onIssued: (issued: IssuedSabcrmApiKey) => void;
}

function IssueKeyDialog({ projectId, onIssued }: IssueKeyDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError('A key label is required.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await issueApiKeyAction(label.trim(), projectId ?? undefined);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onIssued(res.data);
    setLabel('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Issue key
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Issue API key</ZoruDialogTitle>
          <ZoruDialogDescription>
            The raw key is shown exactly once. Store it securely — it cannot be
            recovered after you close this dialog.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key-label">Label</Label>
            <Input
              id="api-key-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Zapier production"
              autoFocus
              disabled={loading}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <ZoruAlertTitle>Error</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          )}
          <ZoruDialogFooter>
            <ZoruDialogClose asChild>
              <Button type="button" variant="ghost" disabled={loading}>
                Cancel
              </Button>
            </ZoruDialogClose>
            <Button type="submit" disabled={loading || !label.trim()}>
              {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Issue key
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// New-key reveal banner (shown once after issue)
// ---------------------------------------------------------------------------

interface NewKeyBannerProps {
  issued: IssuedSabcrmApiKey;
  onDismiss: () => void;
}

function NewKeyBanner({ issued, onDismiss }: NewKeyBannerProps) {
  return (
    <div className="rounded-lg border border-zoru-line bg-zoru-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-zoru-ink">
          New key issued —{' '}
          <span className="font-mono text-xs text-zoru-ink-muted">
            {issued.prefix}…
          </span>
        </p>
        <Badge variant="warning" className="text-xs">
          Copy now — shown once
        </Badge>
      </div>
      <MonoValue
        value={issued.rawKey}
        copyLabel="Copy raw key"
      />
      <p className="mt-2 text-xs text-zoru-ink-muted">
        This key grants programmatic access to your CRM project. Treat it like a
        password — never commit it to source control.
      </p>
      <div className="mt-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={onDismiss}>
          I have saved the key
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single API key row
// ---------------------------------------------------------------------------

interface ApiKeyRowProps {
  apiKey: SabcrmApiKey;
  projectId: string | undefined;
  onRevoked: (id: string) => void;
}

function ApiKeyRow({ apiKey, projectId, onRevoked }: ApiKeyRowProps) {
  const [revoking, setRevoking] = React.useState(false);

  async function handleRevoke() {
    setRevoking(true);
    const res = await revokeApiKeyAction(apiKey.id, projectId ?? undefined);
    setRevoking(false);
    if (res.ok) {
      onRevoked(apiKey.id);
    }
  }

  return (
    <ZoruTableRow>
      <ZoruTableCell className="py-3 pl-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-zoru-ink">{apiKey.label}</span>
          <code className="font-mono text-xs text-zoru-ink-muted">{apiKey.prefix}…</code>
        </div>
      </ZoruTableCell>
      <ZoruTableCell className="py-3 text-xs text-zoru-ink-muted">
        {formatDate(apiKey.createdAt)}
      </ZoruTableCell>
      <ZoruTableCell className="py-3 text-xs text-zoru-ink-muted">
        {apiKey.lastUsedAt ? formatRelativeTime(apiKey.lastUsedAt) : 'Never'}
      </ZoruTableCell>
      <ZoruTableCell className="py-3 pr-4 text-right">
        {apiKey.revoked ? (
          <Badge variant="destructive" className="text-xs">
            Revoked
          </Badge>
        ) : (
          <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-zoru-ink-muted hover:text-red-600"
                disabled={revoking}
              >
                {revoking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Revoke</span>
              </Button>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
              <ZoruAlertDialogHeader>
                <ZoruAlertDialogTitle>Revoke API key?</ZoruAlertDialogTitle>
                <ZoruAlertDialogDescription>
                  This will immediately invalidate{' '}
                  <strong className="font-medium text-zoru-ink">{apiKey.label}</strong>{' '}
                  ({apiKey.prefix}…). Any integration using this key will stop
                  working. This action cannot be undone.
                </ZoruAlertDialogDescription>
              </ZoruAlertDialogHeader>
              <ZoruAlertDialogFooter>
                <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                <ZoruAlertDialogAction
                  onClick={handleRevoke}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Revoke key
                </ZoruAlertDialogAction>
              </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
          </ZoruAlertDialog>
        )}
      </ZoruTableCell>
    </ZoruTableRow>
  );
}

// ---------------------------------------------------------------------------
// API Keys section
// ---------------------------------------------------------------------------

interface ApiKeysSectionProps {
  initialKeys: SabcrmApiKey[];
  projectId: string | undefined;
}

function ApiKeysSection({ initialKeys, projectId }: ApiKeysSectionProps) {
  const [keys, setKeys] = React.useState<SabcrmApiKey[]>(initialKeys);
  const [newlyIssued, setNewlyIssued] = React.useState<IssuedSabcrmApiKey | null>(null);

  function handleIssued(issued: IssuedSabcrmApiKey) {
    setNewlyIssued(issued);
    setKeys((prev) => [issued.key, ...prev]);
  }

  function handleRevoked(id: string) {
    setKeys((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, revoked: true, revokedAt: new Date().toISOString() } : k,
      ),
    );
  }

  const activeKeys = keys.filter((k) => !k.revoked);
  const revokedKeys = keys.filter((k) => k.revoked);
  const [showRevoked, setShowRevoked] = React.useState(false);

  return (
    <section aria-label="API keys">
      <SectionHeading
        icon={<KeyRound className="h-4.5 w-4.5" />}
        title="API Keys"
        description="Bearer tokens for the SabCRM public REST API. Each key is scoped to this project."
        action={<IssueKeyDialog projectId={projectId} onIssued={handleIssued} />}
      />

      <div className="mt-4 flex flex-col gap-4">
        {/* New key reveal banner */}
        {newlyIssued && (
          <NewKeyBanner
            issued={newlyIssued}
            onDismiss={() => setNewlyIssued(null)}
          />
        )}

        {/* Active keys */}
        {activeKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zoru-line bg-zoru-surface py-10 text-center">
            <KeyRound className="mb-2 h-8 w-8 text-zoru-ink-muted" />
            <p className="text-sm font-medium text-zoru-ink">No active API keys</p>
            <p className="mt-1 text-xs text-zoru-ink-muted">
              Issue a key to authenticate REST API requests from external integrations.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zoru-line">
            <Table aria-label="Active API keys">
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="pl-4 text-xs font-medium">Label / Prefix</ZoruTableHead>
                  <ZoruTableHead className="text-xs font-medium">Created</ZoruTableHead>
                  <ZoruTableHead className="text-xs font-medium">Last used</ZoruTableHead>
                  <ZoruTableHead className="pr-4 text-right text-xs font-medium">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {activeKeys.map((k) => (
                  <ApiKeyRow
                    key={k.id}
                    apiKey={k}
                    projectId={projectId}
                    onRevoked={handleRevoked}
                  />
                ))}
              </ZoruTableBody>
            </Table>
          </div>
        )}

        {/* Revoked keys (collapsible) */}
        {revokedKeys.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowRevoked((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-zoru-ink-muted hover:text-zoru-ink"
            >
              {showRevoked ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showRevoked ? 'Hide' : 'Show'} {revokedKeys.length} revoked{' '}
              {revokedKeys.length === 1 ? 'key' : 'keys'}
            </button>
            {showRevoked && (
              <div className="mt-2 overflow-hidden rounded-lg border border-zoru-line opacity-60">
                <Table aria-label="Revoked API keys">
                  <ZoruTableHeader>
                    <ZoruTableRow>
                      <ZoruTableHead className="pl-4 text-xs font-medium">Label / Prefix</ZoruTableHead>
                      <ZoruTableHead className="text-xs font-medium">Created</ZoruTableHead>
                      <ZoruTableHead className="text-xs font-medium">Last used</ZoruTableHead>
                      <ZoruTableHead className="pr-4 text-right text-xs font-medium">Status</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {revokedKeys.map((k) => (
                      <ApiKeyRow
                        key={k.id}
                        apiKey={k}
                        projectId={projectId}
                        onRevoked={handleRevoked}
                      />
                    ))}
                  </ZoruTableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ===========================================================================
// WEBHOOKS
// ===========================================================================

// ---------------------------------------------------------------------------
// Event checkbox group
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<SabcrmWebhookEvent, string> = {
  'record.created': 'Record created',
  'record.updated': 'Record updated',
  'record.deleted': 'Record deleted',
  'activity.created': 'Activity created',
};

interface EventPickerProps {
  selected: SabcrmWebhookEvent[];
  onChange: (events: SabcrmWebhookEvent[]) => void;
  disabled?: boolean;
}

function EventPicker({ selected, onChange, disabled }: EventPickerProps) {
  function toggle(event: SabcrmWebhookEvent) {
    if (selected.includes(event)) {
      onChange(selected.filter((e) => e !== event));
    } else {
      onChange([...selected, event]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {SABCRM_WEBHOOK_EVENTS.map((event) => (
        <label
          key={event}
          className="flex cursor-pointer items-center gap-2.5 text-sm text-zoru-ink"
        >
          <Checkbox
            checked={selected.includes(event)}
            onCheckedChange={() => toggle(event)}
            disabled={disabled}
            id={`event-${event}`}
          />
          <span>{EVENT_LABELS[event]}</span>
          <code className="ml-auto font-mono text-xs text-zoru-ink-muted">
            {event}
          </code>
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create webhook dialog
// ---------------------------------------------------------------------------

interface CreateWebhookDialogProps {
  projectId: string | undefined;
  onCreated: (sub: WebhookSubscription) => void;
}

function CreateWebhookDialog({ projectId, onCreated }: CreateWebhookDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [events, setEvents] = React.useState<SabcrmWebhookEvent[]>([
    'record.created',
    'record.updated',
    'record.deleted',
  ]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [secretRevealed, setSecretRevealed] = React.useState<string | null>(null);

  function reset() {
    setUrl('');
    setDescription('');
    setEvents(['record.created', 'record.updated', 'record.deleted']);
    setError(null);
    setSecretRevealed(null);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError('Endpoint URL is required.');
      return;
    }
    if (events.length === 0) {
      setError('Select at least one event.');
      return;
    }
    setLoading(true);
    setError(null);

    const input: CreateWebhookInput = {
      url: url.trim(),
      events,
      description: description.trim() || undefined,
    };
    const res = await createWebhookAction(input, projectId ?? undefined);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSecretRevealed(res.data.secret ?? null);
    onCreated(res.data);

    if (!res.data.secret) {
      // No secret to reveal — close immediately.
      setOpen(false);
      reset();
    }
    // Otherwise keep open to show the secret banner; user closes manually.
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        setOpen(v);
      }}
    >
      <ZoruDialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add webhook
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="max-w-lg">
        <ZoruDialogHeader>
          <ZoruDialogTitle>
            {secretRevealed ? 'Webhook created — save your secret' : 'Add webhook'}
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            {secretRevealed
              ? 'Your signing secret is shown once. Copy it now — it cannot be recovered.'
              : 'SabCRM will POST a signed JSON envelope to this URL when the selected events fire.'}
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        {secretRevealed ? (
          <div className="mt-2 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Signing secret</Label>
              <MonoValue value={secretRevealed} copyLabel="Copy secret" />
            </div>
            <p className="text-xs text-zoru-ink-muted">
              Validate incoming payloads by verifying the{' '}
              <code className="font-mono">X-SabNode-Signature</code> header equals{' '}
              <code className="font-mono">sha256=HMAC(secret, body)</code>.
            </p>
            <ZoruDialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </ZoruDialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                type="url"
                placeholder="https://example.com/webhooks/crm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-description">
                Description{' '}
                <span className="text-xs font-normal text-zoru-ink-muted">(optional)</span>
              </Label>
              <Input
                id="wh-description"
                placeholder="e.g. Zapier CRM sync"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Events</Label>
              <EventPicker selected={events} onChange={setEvents} disabled={loading} />
            </div>

            {error && (
              <Alert variant="destructive">
                <ZoruAlertTitle>Error</ZoruAlertTitle>
                <ZoruAlertDescription>{error}</ZoruAlertDescription>
              </Alert>
            )}

            <ZoruDialogFooter>
              <ZoruDialogClose asChild>
                <Button type="button" variant="ghost" disabled={loading}>
                  Cancel
                </Button>
              </ZoruDialogClose>
              <Button type="submit" disabled={loading || !url.trim() || events.length === 0}>
                {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Create webhook
              </Button>
            </ZoruDialogFooter>
          </form>
        )}
      </ZoruDialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit webhook dialog (url / events / description / active)
// ---------------------------------------------------------------------------

interface EditWebhookDialogProps {
  sub: WebhookSubscription;
  projectId: string | undefined;
  onUpdated: (sub: WebhookSubscription) => void;
  trigger: React.ReactNode;
}

function EditWebhookDialog({ sub, projectId, onUpdated, trigger }: EditWebhookDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState(sub.url);
  const [description, setDescription] = React.useState(sub.description ?? '');
  const [events, setEvents] = React.useState<SabcrmWebhookEvent[]>(sub.events);
  const [active, setActive] = React.useState(sub.active);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset when dialog opens so a re-open reflects current server state.
  React.useEffect(() => {
    if (open) {
      setUrl(sub.url);
      setDescription(sub.description ?? '');
      setEvents(sub.events);
      setActive(sub.active);
      setError(null);
    }
  }, [open, sub]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const patch: UpdateWebhookPatch = {
      url: url.trim() || undefined,
      description: description.trim() || undefined,
      events: events.length > 0 ? events : undefined,
      active,
    };
    const res = await updateWebhookAction(sub._id, patch, projectId ?? undefined);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onUpdated(res.data);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>{trigger}</ZoruDialogTrigger>
      <ZoruDialogContent className="max-w-lg">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Edit webhook</ZoruDialogTitle>
          <ZoruDialogDescription>
            Update the endpoint, events, or active state. Rotate the secret
            separately.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-wh-url">Endpoint URL</Label>
            <Input
              id="edit-wh-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-wh-description">
              Description{' '}
              <span className="text-xs font-normal text-zoru-ink-muted">(optional)</span>
            </Label>
            <Input
              id="edit-wh-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Events</Label>
            <EventPicker selected={events} onChange={setEvents} disabled={loading} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zoru-line px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zoru-ink">Active</p>
              <p className="text-xs text-zoru-ink-muted">
                Inactive webhooks receive no deliveries.
              </p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={setActive}
              disabled={loading}
              aria-label="Webhook active"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <ZoruAlertTitle>Error</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          )}

          <ZoruDialogFooter>
            <ZoruDialogClose asChild>
              <Button type="button" variant="ghost" disabled={loading}>
                Cancel
              </Button>
            </ZoruDialogClose>
            <Button type="submit" disabled={loading || events.length === 0 || !url.trim()}>
              {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Rotate secret dialog
// ---------------------------------------------------------------------------

interface RotateSecretDialogProps {
  sub: WebhookSubscription;
  projectId: string | undefined;
  onRotated: (sub: WebhookSubscription) => void;
  trigger: React.ReactNode;
}

function RotateSecretDialog({ sub, projectId, onRotated, trigger }: RotateSecretDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newSecret, setNewSecret] = React.useState<string | null>(null);

  function resetState() {
    setLoading(false);
    setError(null);
    setNewSecret(null);
  }

  async function handleRotate() {
    setLoading(true);
    setError(null);
    const res = await rotateWebhookSecretAction(sub._id, projectId ?? undefined);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNewSecret(res.data.secret ?? null);
    onRotated(res.data);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        setOpen(v);
      }}
    >
      <ZoruDialogTrigger asChild>{trigger}</ZoruDialogTrigger>
      <ZoruDialogContent className="max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>
            {newSecret ? 'Secret rotated — save it now' : 'Rotate signing secret'}
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            {newSecret
              ? 'Your new signing secret is shown once. Update your integration before closing.'
              : 'Rotating invalidates the old secret immediately. Update your receiver before rotating.'}
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        {newSecret ? (
          <div className="mt-2 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>New signing secret</Label>
              <MonoValue value={newSecret} copyLabel="Copy secret" />
            </div>
            <p className="text-xs text-zoru-ink-muted">
              Verify incoming requests with{' '}
              <code className="font-mono">X-SabNode-Signature: sha256=HMAC(secret, body)</code>.
            </p>
            <ZoruDialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  resetState();
                }}
              >
                Done
              </Button>
            </ZoruDialogFooter>
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" className="mt-2">
                <ZoruAlertTitle>Error</ZoruAlertTitle>
                <ZoruAlertDescription>{error}</ZoruAlertDescription>
              </Alert>
            )}
            <ZoruDialogFooter className="mt-4">
              <ZoruDialogClose asChild>
                <Button variant="ghost" disabled={loading}>
                  Cancel
                </Button>
              </ZoruDialogClose>
              <Button
                variant="default"
                onClick={handleRotate}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Rotate secret
              </Button>
            </ZoruDialogFooter>
          </>
        )}
      </ZoruDialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Single webhook card
// ---------------------------------------------------------------------------

interface WebhookCardProps {
  sub: WebhookSubscription;
  projectId: string | undefined;
  onUpdated: (sub: WebhookSubscription) => void;
  onDeleted: (id: string) => void;
}

function WebhookCard({ sub, projectId, onUpdated, onDeleted }: WebhookCardProps) {
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteWebhookAction(sub._id, projectId ?? undefined);
    setDeleting(false);
    if (res.ok) onDeleted(sub._id);
  }

  const hasFailures = sub.failureCount > 0;
  const isDisabledByFailures = !sub.active && sub.failureCount > 0;

  return (
    <Card variant="soft" className="flex flex-col gap-0 overflow-hidden p-0">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-zoru-ink">
              {sub.description ?? sub.url}
            </p>
            <Badge
              variant={sub.active ? 'secondary' : 'outline'}
              className="shrink-0 text-xs"
            >
              {sub.active ? 'Active' : 'Inactive'}
            </Badge>
            {isDisabledByFailures && (
              <Badge variant="destructive" className="shrink-0 text-xs">
                Auto-disabled
              </Badge>
            )}
          </div>
          {sub.description && (
            <p className="mt-0.5 truncate text-xs text-zoru-ink-muted">{sub.url}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <EditWebhookDialog
            sub={sub}
            projectId={projectId}
            onUpdated={onUpdated}
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit webhook">
                <RefreshCw className="h-3.5 w-3.5 text-zoru-ink-muted" />
              </Button>
            }
          />
          <RotateSecretDialog
            sub={sub}
            projectId={projectId}
            onRotated={onUpdated}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Rotate signing secret"
              >
                <RotateCcw className="h-3.5 w-3.5 text-zoru-ink-muted" />
              </Button>
            }
          />
          <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Delete webhook"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-zoru-ink-muted" />
                )}
              </Button>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
              <ZoruAlertDialogHeader>
                <ZoruAlertDialogTitle>Delete webhook?</ZoruAlertDialogTitle>
                <ZoruAlertDialogDescription>
                  SabCRM will stop sending events to{' '}
                  <strong className="font-medium text-zoru-ink break-all">{sub.url}</strong>.
                  This action cannot be undone.
                </ZoruAlertDialogDescription>
              </ZoruAlertDialogHeader>
              <ZoruAlertDialogFooter>
                <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                <ZoruAlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete webhook
                </ZoruAlertDialogAction>
              </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
          </ZoruAlertDialog>
        </div>
      </div>

      <Separator />

      {/* Detail row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-xs text-zoru-ink-muted">
        {/* Events */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-zoru-ink-muted">Events:</span>
          {sub.events.map((ev) => (
            <Badge key={ev} variant="secondary" className="text-[10px]">
              {ev}
            </Badge>
          ))}
        </div>

        {/* Last delivery */}
        {sub.lastDeliveryAt && (
          <div className="flex items-center gap-1.5">
            {sub.lastStatus && sub.lastStatus >= 200 && sub.lastStatus < 300 ? (
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            ) : (
              <XCircle className="h-3 w-3 text-red-500" />
            )}
            <span>
              Last: {sub.lastStatus ?? 'n/a'} &mdash;{' '}
              {formatRelativeTime(sub.lastDeliveryAt)}
            </span>
          </div>
        )}

        {/* Failure count */}
        {hasFailures && (
          <div className="flex items-center gap-1 text-red-500">
            <AlertTriangle className="h-3 w-3" />
            <span>{sub.failureCount} consecutive failure{sub.failureCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Created */}
        <span className="ml-auto text-[11px]">Created {formatRelativeTime(sub.createdAt)}</span>
      </div>

      {/* Last error */}
      {sub.lastError && (
        <>
          <Separator />
          <div className="px-4 py-2 text-xs text-red-600">
            <strong>Last error:</strong> {sub.lastError}
          </div>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Webhooks section
// ---------------------------------------------------------------------------

interface WebhooksSectionProps {
  initialWebhooks: WebhookSubscription[];
  projectId: string | undefined;
}

function WebhooksSection({ initialWebhooks, projectId }: WebhooksSectionProps) {
  const [webhooks, setWebhooks] = React.useState<WebhookSubscription[]>(initialWebhooks);

  function handleCreated(sub: WebhookSubscription) {
    setWebhooks((prev) => [sub, ...prev]);
  }

  function handleUpdated(sub: WebhookSubscription) {
    setWebhooks((prev) => prev.map((w) => (w._id === sub._id ? sub : w)));
  }

  function handleDeleted(id: string) {
    setWebhooks((prev) => prev.filter((w) => w._id !== id));
  }

  return (
    <section aria-label="Webhooks">
      <SectionHeading
        icon={<Webhook className="h-4.5 w-4.5" />}
        title="Webhooks"
        description="Receive HTTP POST payloads when SabCRM events occur. Each delivery is HMAC-SHA-256 signed."
        action={<CreateWebhookDialog projectId={projectId} onCreated={handleCreated} />}
      />

      <div className="mt-4 flex flex-col gap-3">
        {webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zoru-line bg-zoru-surface py-10 text-center">
            <Webhook className="mb-2 h-8 w-8 text-zoru-ink-muted" />
            <p className="text-sm font-medium text-zoru-ink">No webhooks configured</p>
            <p className="mt-1 text-xs text-zoru-ink-muted">
              Add a webhook to forward CRM events to an external endpoint.
            </p>
          </div>
        ) : (
          webhooks.map((sub) => (
            <WebhookCard
              key={sub._id}
              sub={sub}
              projectId={projectId}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))
        )}
      </div>
    </section>
  );
}

// ===========================================================================
// BASE URL + CURL REFERENCE
// ===========================================================================

function ApiReferenceSection() {
  const baseUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/sabcrm`;
  const exampleCurl = `curl -X GET "${baseUrl}/records?object=companies&limit=20" \\
  -H "Authorization: Bearer sk_crm_<YOUR_KEY>" \\
  -H "Content-Type: application/json"`;

  const [obscureUrl, setObscureUrl] = React.useState(false);

  return (
    <section aria-label="API reference">
      <SectionHeading
        icon={<ExternalLink className="h-4.5 w-4.5" />}
        title="REST API Reference"
        description="Integrate with SabCRM programmatically using Bearer authentication."
      />

      <div className="mt-4 flex flex-col gap-4">
        <Card variant="soft" className="p-4">
          <div className="flex flex-col gap-3">
            {/* Base URL */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wide">
                Base URL
              </Label>
              <MonoValue value={baseUrl} copyLabel="Copy base URL" />
            </div>

            <Separator />

            {/* Auth header */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wide">
                Authentication
              </Label>
              <p className="text-sm text-zoru-ink-muted">
                Include an API key as a Bearer token or in the{' '}
                <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono text-xs">
                  X-Api-Key
                </code>{' '}
                header on every request.
              </p>
              <div className="flex flex-col gap-1">
                <MonoValue
                  value="Authorization: Bearer sk_crm_<YOUR_KEY>"
                  copyLabel="Copy header"
                />
                <MonoValue value="X-Api-Key: sk_crm_<YOUR_KEY>" copyLabel="Copy header" />
              </div>
            </div>

            <Separator />

            {/* Example curl */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wide">
                  Example request
                </Label>
                <CopyButton value={exampleCurl} label="Copy curl" />
              </div>
              <pre className="overflow-x-auto rounded-md border border-zoru-line bg-zoru-surface px-3 py-3 font-mono text-xs leading-relaxed text-zoru-ink">
                {exampleCurl}
              </pre>
            </div>

            <Separator />

            {/* Event payload shape */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wide">
                Webhook payload shape
              </Label>
              <pre className="overflow-x-auto rounded-md border border-zoru-line bg-zoru-surface px-3 py-3 font-mono text-xs leading-relaxed text-zoru-ink">
                {JSON.stringify(
                  {
                    event: 'record.created',
                    projectId: '<project-id>',
                    timestamp: '2025-01-01T00:00:00.000Z',
                    data: { _id: '<record-id>', object: 'companies', data: {} },
                  },
                  null,
                  2,
                )}
              </pre>
            </div>

            {/* Signature verification */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wide">
                Signature verification
              </Label>
              <p className="text-sm text-zoru-ink-muted">
                Every webhook delivery includes an{' '}
                <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono text-xs">
                  X-SabNode-Signature
                </code>{' '}
                header containing{' '}
                <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono text-xs">
                  sha256=HMAC-SHA256(secret, rawBody)
                </code>
                . Compare it against your computed signature using a constant-time
                comparison to prevent timing attacks.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

// ===========================================================================
// Top-level client component
// ===========================================================================

export interface ApiSettingsClientProps {
  initialKeys: SabcrmApiKey[];
  initialWebhooks: WebhookSubscription[];
}

export function ApiSettingsClient({ initialKeys, initialWebhooks }: ApiSettingsClientProps) {
  const { activeProjectId } = useProject();

  return (
    <div className="flex flex-col gap-10">
      {/* 1. API Keys */}
      <ApiKeysSection
        initialKeys={initialKeys}
        projectId={activeProjectId ?? undefined}
      />

      <Separator />

      {/* 2. Webhooks */}
      <WebhooksSection
        initialWebhooks={initialWebhooks}
        projectId={activeProjectId ?? undefined}
      />

      <Separator />

      {/* 3. API Reference */}
      <ApiReferenceSection />
    </div>
  );
}
