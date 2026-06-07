'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe,
  Shield,
  Copy,
  Check,
  Clock,
  X,
  Trash2,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Spinner,
  useToast,
} from '@/components/sabcrm/20ui';
import type {
  CustomDomain,
  DomainStatus,
  SslStatus,
} from '@/lib/sabflow/domains/types';

/* Constants */

/** Host users must point their CNAME to. Override via NEXT_PUBLIC_* at build. */
const CNAME_TARGET =
  process.env.NEXT_PUBLIC_SABFLOW_CNAME_TARGET ?? 'flow.sabnode.com';

/* Props */

export interface DomainsPanelProps {
  /** Optional: scope new domains to a specific flow. */
  flowId?: string;
  /** Optional friendly name shown in the header. */
  flowName?: string;
}

/* API helpers (client) */

interface ApiDomain extends Omit<CustomDomain, 'createdAt' | 'lastCheckedAt'> {
  createdAt: string;
  lastCheckedAt?: string;
}

function hydrate(d: ApiDomain): CustomDomain {
  return {
    ...d,
    createdAt: new Date(d.createdAt),
    lastCheckedAt: d.lastCheckedAt ? new Date(d.lastCheckedAt) : undefined,
  };
}

async function apiList(): Promise<CustomDomain[]> {
  const res = await fetch('/api/sabflow/domains', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load domains');
  const json = (await res.json()) as { domains: ApiDomain[] };
  return json.domains.map(hydrate);
}

async function apiCreate(domain: string, flowId?: string): Promise<CustomDomain> {
  const res = await fetch('/api/sabflow/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, flowId }),
  });
  const json = (await res.json()) as { domain?: ApiDomain; error?: string };
  if (!res.ok || !json.domain) {
    throw new Error(json.error ?? 'Failed to add domain');
  }
  return hydrate(json.domain);
}

async function apiVerify(
  id: string,
): Promise<{ verified: boolean; reason?: string; domain: CustomDomain }> {
  const res = await fetch(`/api/sabflow/domains/${id}/verify`, {
    method: 'POST',
  });
  const json = (await res.json()) as {
    verified?: boolean;
    reason?: string;
    domain?: ApiDomain;
    error?: string;
  };
  if (!res.ok || !json.domain) {
    throw new Error(json.error ?? 'Verification failed');
  }
  return {
    verified: !!json.verified,
    reason: json.reason,
    domain: hydrate(json.domain),
  };
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`/api/sabflow/domains/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Failed to delete domain');
  }
}

/* Copy button */

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed silently
    }
  }, [text]);

  return (
    <Button
      size="sm"
      variant={copied ? 'primary' : 'secondary'}
      iconLeft={copied ? Check : Copy}
      onClick={handleCopy}
      className="shrink-0"
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

/* Status pill */

function StatusPill({ status }: { status: DomainStatus }) {
  const { Icon, label, tone } = useMemo(() => {
    if (status === 'verified') {
      return { Icon: Check, label: 'Verified', tone: 'success' as const };
    }
    if (status === 'failed') {
      return { Icon: X, label: 'Failed', tone: 'danger' as const };
    }
    return { Icon: Clock, label: 'Pending', tone: 'warning' as const };
  }, [status]);

  return (
    <Badge tone={tone} kind="soft">
      <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
      {label}
    </Badge>
  );
}

function SslPill({ status }: { status: SslStatus }) {
  const { label, tone } = useMemo(() => {
    if (status === 'issued') {
      return { label: 'SSL issued', tone: 'success' as const };
    }
    if (status === 'failed') {
      return { label: 'SSL failed', tone: 'danger' as const };
    }
    return { label: 'SSL pending', tone: 'neutral' as const };
  }, [status]);

  return (
    <Badge tone={tone} kind="soft">
      <Shield className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
      {label}
    </Badge>
  );
}

/* DNS record row */

function DnsRecordRow({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
          {label}
        </span>
      </div>
      <dl className="space-y-2 text-[12px]">
        <div className="flex items-center gap-2">
          <dt className="w-16 shrink-0 text-[var(--st-text-tertiary)]">Name</dt>
          <dd className="flex-1 truncate font-mono text-[var(--st-text)]">
            {name}
          </dd>
          <CopyButton text={name} />
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-16 shrink-0 text-[var(--st-text-tertiary)]">Value</dt>
          <dd className="flex-1 truncate font-mono text-[var(--st-text)]">
            {value}
          </dd>
          <CopyButton text={value} />
        </div>
      </dl>
    </div>
  );
}

/* Domain row */

function DomainRow({
  domain,
  onVerified,
  onDeleted,
}: {
  domain: CustomDomain;
  onVerified: (updated: CustomDomain) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(domain.status !== 'verified');
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    setMessage(null);
    try {
      const res = await apiVerify(domain.id);
      onVerified(res.domain);
      setMessage({
        kind: res.verified ? 'success' : 'error',
        text: res.verified
          ? 'Domain verified successfully.'
          : res.reason ?? 'Verification failed.',
      });
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Verification failed',
      });
    } finally {
      setVerifying(false);
    }
  }, [domain.id, onVerified]);

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        `Delete custom domain "${domain.domain}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setMessage(null);
    try {
      await apiDelete(domain.id);
      onDeleted(domain.id);
      toast.success('Domain deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }, [domain.domain, domain.id, onDeleted, toast]);

  return (
    <li>
      <Card variant="outlined" padding="none" className="overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Globe
            className="h-4 w-4 shrink-0 text-[var(--st-text-tertiary)]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-[var(--st-text)]">
                {domain.domain}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill status={domain.status} />
              <SslPill status={domain.sslStatus} />
              {domain.flowId ? (
                <Badge tone="neutral" kind="soft">
                  Flow-scoped
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              iconLeft={RefreshCw}
              loading={verifying}
              disabled={verifying || deleting}
              onClick={handleVerify}
            >
              Verify now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={Trash2}
              loading={deleting}
              disabled={verifying || deleting}
              onClick={handleDelete}
              aria-label="Delete domain"
              title="Delete domain"
            />
            <IconButton
              label={expanded ? 'Hide DNS records' : 'Show DNS records'}
              icon={expanded ? ChevronUp : ChevronDown}
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            />
          </div>
        </div>

        {/* Expanded: DNS instructions */}
        {expanded && (
          <div className="space-y-3 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-4">
            <p className="text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
              Add the following DNS records at your registrar. Both are required.
              The <span className="font-semibold">TXT</span> record proves
              ownership, and the <span className="font-semibold">CNAME</span>{' '}
              record routes live traffic to SabFlow.
            </p>

            <DnsRecordRow
              label="TXT record (verification)"
              name={`_sabflow.${domain.domain}`}
              value={domain.verificationToken}
            />
            <DnsRecordRow
              label="CNAME record (routing)"
              name={domain.domain}
              value={CNAME_TARGET}
            />

            {message && (
              <Alert
                tone={message.kind === 'error' ? 'danger' : 'success'}
                icon={message.kind === 'error' ? TriangleAlert : Check}
              >
                {message.text}
              </Alert>
            )}

            {domain.lastCheckedAt && (
              <p className="text-[11px] text-[var(--st-text-tertiary)]">
                Last checked {domain.lastCheckedAt.toLocaleString()}
              </p>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}

/* Add-domain form */

function AddDomainForm({
  flowId,
  onCreated,
}: {
  flowId?: string;
  onCreated: (d: CustomDomain) => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!value.trim() || loading) return;
      setLoading(true);
      setError(null);
      try {
        const created = await apiCreate(value.trim(), flowId);
        onCreated(created);
        setValue('');
        toast.success('Domain added.');
      } catch (err) {
        const text = err instanceof Error ? err.message : 'Failed to add domain';
        setError(text);
        toast.error(text);
      } finally {
        setLoading(false);
      }
    },
    [value, loading, flowId, onCreated, toast],
  );

  return (
    <Card variant="outlined" padding="md">
      <form onSubmit={handleSubmit}>
        <Field label="Add a custom domain" error={error ?? undefined}>
          <div className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="chat.mysite.com"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading || !value.trim()}
              className="shrink-0"
            >
              Add domain
            </Button>
          </div>
        </Field>
      </form>
    </Card>
  );
}

/* Main panel */

export function DomainsPanel({ flowId, flowName }: DomainsPanelProps) {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiList()
      .then((list) => {
        if (!cancelled) setDomains(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scoped = useMemo(
    () =>
      flowId
        ? domains.filter((d) => !d.flowId || d.flowId === flowId)
        : domains,
    [domains, flowId],
  );

  const handleCreated = useCallback((d: CustomDomain) => {
    setDomains((prev) => [d, ...prev]);
  }, []);

  const handleVerified = useCallback((updated: CustomDomain) => {
    setDomains((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setDomains((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return (
    <div className="ui20 mx-auto flex max-w-2xl flex-col gap-6 p-6">
      {/* Page heading */}
      <PageHeader bordered={false} className="items-center">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
          aria-hidden="true"
        >
          <Globe className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <PageHeaderHeading>
          <PageTitle>Custom domains</PageTitle>
          <PageDescription>
            {flowName ?? 'Serve your flows from your own domain'}
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* Info callout */}
      <Callout icon={Info} tone="info">
        <span className="space-y-1 leading-relaxed">
          <span className="block">
            Point your own domain (e.g.{' '}
            <span className="font-mono text-[var(--st-text)]">
              chat.mysite.com
            </span>
            ) at SabFlow to serve this flow under your brand.
          </span>
          <span className="block text-[var(--st-text-tertiary)]">
            DNS changes can take up to 48 hours to propagate. If verification
            fails on the first try, wait a few minutes and try again.
          </span>
        </span>
      </Callout>

      {/* Add form */}
      <AddDomainForm flowId={flowId} onCreated={handleCreated} />

      {/* Domain list */}
      {loading ? (
        <Card
          variant="ghost"
          padding="lg"
          className="flex items-center justify-center gap-2 border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[12.5px] text-[var(--st-text-tertiary)]"
        >
          <Spinner size="sm" label="Loading domains" />
          Loading domains
        </Card>
      ) : loadError ? (
        <Alert tone="danger" title="Could not load domains">
          {loadError}
        </Alert>
      ) : scoped.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No custom domains yet"
          description="Add a domain above to serve your flow under your own brand."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {scoped.map((d) => (
            <DomainRow
              key={d.id}
              domain={d}
              onVerified={handleVerified}
              onDeleted={handleDeleted}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default DomainsPanel;
